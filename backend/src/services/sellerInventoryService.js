const { pool } = require("../config/database");

// Get seller inventory
async function getSellerInventory({
  sellerId,
  page = 1,
  limit = 20,
  search = "",
  lowStockOnly = false
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * limit;
    const conditions = ["p.seller_id = ?"];
    const params = [Number(sellerId)];

    if (search) {
      conditions.push("(p.name LIKE ? OR p.sku LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term);
    }

    if (lowStockOnly) {
      conditions.push("i.available_quantity <= i.low_stock_threshold");
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countResult = await connection.query(
      `SELECT COUNT(*) AS total
       FROM inventory i
       INNER JOIN products p ON p.product_id = i.product_id
       ${whereClause}`,
      params
    );

    const total = Number(countResult[0]?.total || 0);

    const rows = await connection.query(
      `SELECT
         i.inventory_id,
         i.product_id,
         p.name AS product_name,
         p.sku,
         p.price,
         p.image_url,
         p.status AS product_status,
         i.stock_quantity,
         i.reserved_quantity,
         i.available_quantity,
         i.low_stock_threshold,
         CASE
           WHEN i.available_quantity <= i.low_stock_threshold THEN 1
           ELSE 0
         END AS is_low_stock,
         i.updated_at
       FROM inventory i
       INNER JOIN products p ON p.product_id = i.product_id
       ${whereClause}
       ORDER BY is_low_stock DESC, i.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      inventory: rows.map((item) => ({
        inventoryId: Number(item.inventory_id),
        productId: Number(item.product_id),
        productName: item.product_name,
        sku: item.sku,
        price: Number(item.price),
        imageUrl: item.image_url,
        productStatus: item.product_status,
        stockQuantity: Number(item.stock_quantity),
        reservedQuantity: Number(item.reserved_quantity),
        availableQuantity: Number(item.available_quantity),
        lowStockThreshold: Number(item.low_stock_threshold),
        isLowStock: Boolean(item.is_low_stock),
        updatedAt: item.updated_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit)
      }
    };
  } finally {
    if (connection) connection.release();
  }
}

// Adjust stock atomically for seller
async function adjustSellerStock({
  sellerId,
  productId,
  quantityChange,
  reason = "restock",
  note = ""
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // Verify ownership and lock product & inventory rows
    const productCheck = await connection.query(
      `SELECT p.product_id, p.name, p.seller_id,
              i.inventory_id, i.stock_quantity, i.reserved_quantity, i.low_stock_threshold
       FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.product_id = ? AND p.seller_id = ?
       FOR UPDATE`,
      [Number(productId), Number(sellerId)]
    );

    if (productCheck.length === 0) {
      const error = new Error("Product not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    const item = productCheck[0];
    let inventoryId = item.inventory_id;
    let currentStock = Number(item.stock_quantity || 0);
    const reservedQuantity = Number(item.reserved_quantity || 0);

    // If inventory row did not exist yet, create it
    if (!inventoryId) {
      const createInv = await connection.query(
        "INSERT INTO inventory (product_id, stock_quantity, reserved_quantity, low_stock_threshold) VALUES (?, ?, 0, 5)",
        [Number(productId), currentStock]
      );
      inventoryId = createInv.insertId;
    }

    const delta = Number(quantityChange);
    const newStock = currentStock + delta;

    if (newStock < 0) {
      const error = new Error("Stock cannot become negative");
      error.statusCode = 400;
      throw error;
    }

    if (newStock < reservedQuantity) {
      const error = new Error(`Cannot reduce stock below currently reserved quantity (${reservedQuantity})`);
      error.statusCode = 400;
      throw error;
    }

    // Update inventory
    await connection.query(
      "UPDATE inventory SET stock_quantity = ? WHERE product_id = ?",
      [newStock, Number(productId)]
    );

    // Keep products.stock_quantity synchronized
    await connection.query(
      "UPDATE products SET stock_quantity = ?, status = CASE WHEN ? = 0 THEN 'out_of_stock' ELSE status END WHERE product_id = ?",
      [newStock, newStock, Number(productId)]
    );

    // Record in inventory_adjustments
    await connection.query(
      `INSERT INTO inventory_adjustments (
         inventory_id, product_id, quantity_change, reason, note, adjusted_by
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(inventoryId),
        Number(productId),
        delta,
        reason,
        note || `Stock adjusted by seller #${sellerId}`,
        Number(sellerId)
      ]
    );

    await connection.commit();

    return {
      productId: Number(productId),
      productName: item.name,
      previousStock: currentStock,
      newStock,
      availableQuantity: newStock - reservedQuantity,
      quantityChange: delta,
      reason
    };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Get stock adjustment history for this seller
async function getSellerStockHistory(sellerId, productId = null) {
  let connection;

  try {
    connection = await pool.getConnection();

    const conditions = ["p.seller_id = ?"];
    const params = [Number(sellerId)];

    if (productId) {
      conditions.push("ia.product_id = ?");
      params.push(Number(productId));
    }

    const rows = await connection.query(
      `SELECT
         ia.adjustment_id,
         ia.product_id,
         p.name AS product_name,
         p.sku,
         ia.quantity_change,
         ia.reason,
         ia.note,
         ia.created_at,
         u.name AS adjusted_by_name
       FROM inventory_adjustments ia
       INNER JOIN products p ON ia.product_id = p.product_id
       LEFT JOIN users u ON ia.adjusted_by = u.user_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ia.created_at DESC
       LIMIT 50`,
      params
    );

    return rows.map((r) => ({
      adjustmentId: Number(r.adjustment_id),
      productId: Number(r.product_id),
      productName: r.product_name,
      sku: r.sku,
      quantityChange: Number(r.quantity_change),
      reason: r.reason,
      note: r.note,
      createdAt: r.created_at,
      adjustedByName: r.adjusted_by_name
    }));
  } finally {
    if (connection) connection.release();
  }
}

// Update low stock threshold
async function updateSellerStockThreshold(sellerId, productId, threshold) {
  let connection;

  try {
    connection = await pool.getConnection();

    // Verify ownership
    const pCheck = await connection.query(
      "SELECT product_id FROM products WHERE product_id = ? AND seller_id = ? LIMIT 1",
      [Number(productId), Number(sellerId)]
    );

    if (pCheck.length === 0) {
      const error = new Error("Product not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    await connection.query(
      `INSERT INTO inventory (product_id, stock_quantity, reserved_quantity, low_stock_threshold)
       VALUES (?, 0, 0, ?)
       ON DUPLICATE KEY UPDATE low_stock_threshold = ?`,
      [Number(productId), Number(threshold), Number(threshold)]
    );

    return {
      message: "Low stock threshold updated",
      productId: Number(productId),
      lowStockThreshold: Number(threshold)
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getSellerInventory,
  adjustSellerStock,
  getSellerStockHistory,
  updateSellerStockThreshold
};
