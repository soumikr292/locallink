const { pool } = require("../config/database");


// Get inventory list
async function getInventory({
  page = 1,
  limit = 20,
  search = "",
  lowStockOnly = false
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`
        (
          p.name LIKE ?
          OR p.sku LIKE ?
        )
      `);

      const searchValue = `%${search}%`;

      params.push(searchValue, searchValue);
    }

    if (lowStockOnly) {
      conditions.push(`
        i.available_quantity <= i.low_stock_threshold
      `);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM inventory i
      INNER JOIN products p
        ON p.product_id = i.product_id
      ${whereClause}
      `,
      params
    );

    const total = Number(countResult[0].total);

    const rows = await connection.query(
      `
      SELECT
        i.inventory_id,
        i.product_id,

        p.name AS product_name,
        p.sku,
        p.status AS product_status,

        i.stock_quantity,
        i.reserved_quantity,
        i.available_quantity,
        i.low_stock_threshold,

        CASE
          WHEN i.available_quantity <= i.low_stock_threshold
          THEN TRUE
          ELSE FALSE
        END AS is_low_stock,

        i.created_at,
        i.updated_at

      FROM inventory i

      INNER JOIN products p
        ON p.product_id = i.product_id

      ${whereClause}

      ORDER BY i.updated_at DESC

      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      inventory: rows.map((item) => ({
        inventoryId: Number(item.inventory_id),
        productId: Number(item.product_id),

        productName: item.product_name,
        sku: item.sku,
        productStatus: item.product_status,

        stockQuantity: Number(item.stock_quantity),
        reservedQuantity: Number(item.reserved_quantity),
        availableQuantity: Number(item.available_quantity),
        lowStockThreshold: Number(item.low_stock_threshold),

        isLowStock: Boolean(item.is_low_stock),

        createdAt: item.created_at,
        updatedAt: item.updated_at
      })),

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } finally {
    if (connection) connection.release();
  }
}


// Get inventory for a single product
async function getInventoryByProductId(productId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `
      SELECT
        i.inventory_id,
        i.product_id,

        p.name AS product_name,
        p.sku,
        p.status AS product_status,

        i.stock_quantity,
        i.reserved_quantity,
        i.available_quantity,
        i.low_stock_threshold,

        CASE
          WHEN i.available_quantity <= i.low_stock_threshold
          THEN TRUE
          ELSE FALSE
        END AS is_low_stock,

        i.created_at,
        i.updated_at

      FROM inventory i

      INNER JOIN products p
        ON p.product_id = i.product_id

      WHERE i.product_id = ?

      LIMIT 1
      `,
      [productId]
    );

    if (rows.length === 0) {
      const error = new Error(
        "Inventory record not found"
      );

      error.statusCode = 404;

      throw error;
    }

    const item = rows[0];

    return {
      inventoryId: Number(item.inventory_id),
      productId: Number(item.product_id),

      productName: item.product_name,
      sku: item.sku,
      productStatus: item.product_status,

      stockQuantity: Number(item.stock_quantity),
      reservedQuantity: Number(item.reserved_quantity),
      availableQuantity: Number(item.available_quantity),
      lowStockThreshold: Number(item.low_stock_threshold),

      isLowStock: Boolean(item.is_low_stock),

      createdAt: item.created_at,
      updatedAt: item.updated_at
    };
  } finally {
    if (connection) connection.release();
  }
}


// Adjust stock
async function adjustStock({
  productId,
  quantityChange,
  reason,
  note,
  adjustedBy
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // Lock inventory row during the transaction
    const inventoryRows = await connection.query(
      `
      SELECT
        inventory_id,
        stock_quantity,
        reserved_quantity

      FROM inventory

      WHERE product_id = ?

      FOR UPDATE
      `,
      [productId]
    );

    if (inventoryRows.length === 0) {
      const error = new Error(
        "Inventory record not found"
      );

      error.statusCode = 404;

      throw error;
    }

    const inventory = inventoryRows[0];

    const currentStock =
      Number(inventory.stock_quantity);

    const reservedQuantity =
      Number(inventory.reserved_quantity);

    const newStock =
      currentStock + quantityChange;

    // Stock can never become negative
    if (newStock < 0) {
      const error = new Error(
        "Stock quantity cannot become negative"
      );

      error.statusCode = 400;

      throw error;
    }

    // Stock cannot become lower than reserved quantity
    if (newStock < reservedQuantity) {
      const error = new Error(
        "Stock cannot be lower than reserved quantity"
      );

      error.statusCode = 400;

      throw error;
    }

    // Update stock
    await connection.query(
      `
      UPDATE inventory

      SET stock_quantity = ?

      WHERE product_id = ?
      `,
      [newStock, productId]
    );

    // Keep products.stock_quantity synchronized
    await connection.query(
      `
      UPDATE products

      SET stock_quantity = ?

      WHERE product_id = ?
      `,
      [newStock, productId]
    );

    // Record adjustment
    const adjustmentResult =
      await connection.query(
        `
        INSERT INTO inventory_adjustments (
          inventory_id,
          product_id,
          quantity_change,
          reason,
          note,
          adjusted_by
        )

        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          Number(inventory.inventory_id),
          productId,
          quantityChange,
          reason,
          note || null,
          adjustedBy || null
        ]
      );

    await connection.commit();

    return {
      adjustmentId:
        Number(adjustmentResult.insertId),

      productId,

      previousStock: currentStock,

      quantityChange,

      newStock,

      reservedQuantity,

      availableQuantity:
        newStock - reservedQuantity,

      reason,

      note: note || null,

      adjustedBy:
        adjustedBy
          ? Number(adjustedBy)
          : null
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    throw error;
  } finally {
    if (connection) connection.release();
  }
}


// Get adjustment history
async function getAdjustmentHistory({
  productId = "",
  page = 1,
  limit = 20
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (productId) {
      conditions.push(
        "ia.product_id = ?"
      );

      params.push(productId);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await connection.query(
      `
      SELECT COUNT(*) AS total

      FROM inventory_adjustments ia

      ${whereClause}
      `,
      params
    );

    const total =
      Number(countResult[0].total);

    const rows = await connection.query(
      `
      SELECT
        ia.adjustment_id,
        ia.inventory_id,
        ia.product_id,

        p.name AS product_name,
        p.sku,

        ia.quantity_change,
        ia.reason,
        ia.note,

        ia.adjusted_by,
        u.name AS adjusted_by_name,

        ia.created_at

      FROM inventory_adjustments ia

      INNER JOIN products p
        ON p.product_id = ia.product_id

      LEFT JOIN users u
        ON u.user_id = ia.adjusted_by

      ${whereClause}

      ORDER BY ia.created_at DESC

      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      adjustments: rows.map((item) => ({
        adjustmentId:
          Number(item.adjustment_id),

        inventoryId:
          Number(item.inventory_id),

        productId:
          Number(item.product_id),

        productName:
          item.product_name,

        sku:
          item.sku,

        quantityChange:
          Number(item.quantity_change),

        reason:
          item.reason,

        note:
          item.note,

        adjustedBy:
          item.adjusted_by
            ? Number(item.adjusted_by)
            : null,

        adjustedByName:
          item.adjusted_by_name,

        createdAt:
          item.created_at
      })),

      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(total / limit)
      }
    };
  } finally {
    if (connection) connection.release();
  }
}


module.exports = {
  getInventory,
  getInventoryByProductId,
  adjustStock,
  getAdjustmentHistory
};