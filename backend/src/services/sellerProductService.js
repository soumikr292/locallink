const { pool } = require("../config/database");

// Helper to generate a clean slug
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Get seller's products
async function getSellerProducts({
  sellerId,
  page = 1,
  limit = 20,
  search = "",
  status = "",
  categoryId = ""
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * limit;
    const conditions = ["p.seller_id = ?"];
    const params = [Number(sellerId)];

    if (search) {
      conditions.push("(p.name LIKE ? OR p.sku LIKE ? OR p.brand LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (status) {
      conditions.push("p.status = ?");
      params.push(status);
    }

    if (categoryId) {
      conditions.push("p.category_id = ?");
      params.push(Number(categoryId));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countRows = await connection.query(
      `SELECT COUNT(*) AS total
       FROM products p
       ${whereClause}`,
      params
    );

    const total = Number(countRows[0].total);

    const rows = await connection.query(
      `SELECT
         p.product_id,
         p.seller_id,
         p.name,
         p.slug,
         p.description,
         p.sku,
         p.price,
         p.discount_price,
         p.stock_quantity,
         p.brand,
         p.category_id,
         c.name AS category_name,
         p.image_url,
         p.status,
         p.created_at,
         p.updated_at,
         COALESCE(i.available_quantity, p.stock_quantity) AS available_quantity,
         COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
         COALESCE(i.low_stock_threshold, 5) AS low_stock_threshold,
         CASE
           WHEN COALESCE(i.available_quantity, p.stock_quantity) <= COALESCE(i.low_stock_threshold, 5) THEN 1
           ELSE 0
         END AS is_low_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.category_id
       LEFT JOIN inventory i ON p.product_id = i.product_id
       ${whereClause}
       ORDER BY p.product_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      products: rows.map((p) => ({
        id: Number(p.product_id),
        sellerId: Number(p.seller_id),
        name: p.name,
        slug: p.slug,
        description: p.description,
        sku: p.sku,
        price: Number(p.price),
        discountPrice: p.discount_price !== null ? Number(p.discount_price) : null,
        stockQuantity: Number(p.stock_quantity),
        availableQuantity: Number(p.available_quantity),
        reservedQuantity: Number(p.reserved_quantity),
        lowStockThreshold: Number(p.low_stock_threshold),
        isLowStock: Boolean(p.is_low_stock),
        brand: p.brand,
        categoryId: p.category_id !== null ? Number(p.category_id) : null,
        categoryName: p.category_name,
        imageUrl: p.image_url,
        status: p.status,
        createdAt: p.created_at,
        updatedAt: p.updated_at
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

// Get single product for seller
async function getSellerProductById(sellerId, productId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `SELECT
         p.product_id,
         p.seller_id,
         p.name,
         p.slug,
         p.description,
         p.sku,
         p.price,
         p.discount_price,
         p.stock_quantity,
         p.brand,
         p.category_id,
         c.name AS category_name,
         p.image_url,
         p.status,
         p.created_at,
         p.updated_at,
         COALESCE(i.available_quantity, p.stock_quantity) AS available_quantity,
         COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
         COALESCE(i.low_stock_threshold, 5) AS low_stock_threshold
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.category_id
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.product_id = ? AND p.seller_id = ?
       LIMIT 1`,
      [Number(productId), Number(sellerId)]
    );

    if (rows.length === 0) {
      const error = new Error("Product not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    const p = rows[0];
    return {
      id: Number(p.product_id),
      sellerId: Number(p.seller_id),
      name: p.name,
      slug: p.slug,
      description: p.description,
      sku: p.sku,
      price: Number(p.price),
      discountPrice: p.discount_price !== null ? Number(p.discount_price) : null,
      stockQuantity: Number(p.stock_quantity),
      availableQuantity: Number(p.available_quantity),
      reservedQuantity: Number(p.reserved_quantity),
      lowStockThreshold: Number(p.low_stock_threshold),
      brand: p.brand,
      categoryId: p.category_id !== null ? Number(p.category_id) : null,
      categoryName: p.category_name,
      imageUrl: p.image_url,
      status: p.status,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    };
  } finally {
    if (connection) connection.release();
  }
}

// Create product
async function createSellerProduct(sellerId, data) {
  let {
    name,
    description = "",
    sku,
    price,
    discountPrice = null,
    stockQuantity = 0,
    brand = null,
    categoryId = null,
    imageUrl = null,
    status = "active",
    lowStockThreshold = 5
  } = data;

  let connection;

  try {
    connection = await pool.getConnection();

    // Check category if provided
    if (categoryId) {
      const cat = await connection.query(
        "SELECT category_id FROM categories WHERE category_id = ? AND status = 'active' LIMIT 1",
        [Number(categoryId)]
      );
      if (cat.length === 0) {
        const error = new Error("Active category not found");
        error.statusCode = 400;
        throw error;
      }
    }

    // Auto-generate SKU if not provided
    if (!sku) {
      sku = `SKU-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // Check duplicate SKU
    const existingSku = await connection.query(
      "SELECT product_id FROM products WHERE sku = ? LIMIT 1",
      [sku]
    );
    if (existingSku.length > 0) {
      const error = new Error("Product SKU already exists. Please choose a unique SKU.");
      error.statusCode = 409;
      throw error;
    }

    // Generate unique slug
    let baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;
    while (true) {
      const existingSlug = await connection.query(
        "SELECT product_id FROM products WHERE slug = ? LIMIT 1",
        [slug]
      );
      if (existingSlug.length === 0) break;
      slug = `${baseSlug}-${counter++}`;
    }

    await connection.beginTransaction();

    const insertResult = await connection.query(
      `INSERT INTO products (
         seller_id, name, slug, description, sku, price, discount_price,
         stock_quantity, brand, category_id, image_url, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(sellerId),
        name,
        slug,
        description,
        sku,
        price,
        discountPrice || null,
        Number(stockQuantity) || 0,
        brand || null,
        categoryId ? Number(categoryId) : null,
        imageUrl || null,
        status || "active"
      ]
    );

    const newProductId = Number(insertResult.insertId);

    // Create corresponding inventory row
    await connection.query(
      `INSERT INTO inventory (
         product_id, stock_quantity, reserved_quantity, low_stock_threshold
       ) VALUES (?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity)`,
      [newProductId, Number(stockQuantity) || 0, Number(lowStockThreshold) || 5]
    );

    // Initial inventory adjustment record
    if (Number(stockQuantity) > 0) {
      const invRow = await connection.query(
        "SELECT inventory_id FROM inventory WHERE product_id = ? LIMIT 1",
        [newProductId]
      );
      if (invRow.length > 0) {
        await connection.query(
          `INSERT INTO inventory_adjustments (
             inventory_id, product_id, quantity_change, reason, note, adjusted_by
           ) VALUES (?, ?, ?, 'restock', 'Initial stock on product creation', ?)`,
          [invRow[0].inventory_id, newProductId, Number(stockQuantity), Number(sellerId)]
        );
      }
    }

    await connection.commit();

    return {
      id: newProductId,
      sellerId: Number(sellerId),
      name,
      slug,
      sku,
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : null,
      stockQuantity: Number(stockQuantity),
      status
    };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Update product
async function updateSellerProduct(sellerId, productId, data) {
  let connection;

  try {
    connection = await pool.getConnection();

    // Verify ownership
    const existing = await connection.query(
      "SELECT product_id, sku, slug FROM products WHERE product_id = ? AND seller_id = ? LIMIT 1",
      [Number(productId), Number(sellerId)]
    );

    if (existing.length === 0) {
      const error = new Error("Product not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    // If SKU changed, verify uniqueness
    if (data.sku && data.sku !== existing[0].sku) {
      const skuCheck = await connection.query(
        "SELECT product_id FROM products WHERE sku = ? AND product_id != ? LIMIT 1",
        [data.sku, Number(productId)]
      );
      if (skuCheck.length > 0) {
        const error = new Error("Product SKU already taken");
        error.statusCode = 409;
        throw error;
      }
    }

    // Build update query dynamically
    const fields = [];
    const params = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      params.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push("description = ?");
      params.push(data.description);
    }
    if (data.sku !== undefined) {
      fields.push("sku = ?");
      params.push(data.sku);
    }
    if (data.price !== undefined) {
      fields.push("price = ?");
      params.push(Number(data.price));
    }
    if (data.discountPrice !== undefined) {
      fields.push("discount_price = ?");
      params.push(data.discountPrice === null || data.discountPrice === "" ? null : Number(data.discountPrice));
    }
    if (data.stockQuantity !== undefined) {
      fields.push("stock_quantity = ?");
      params.push(Number(data.stockQuantity));
    }
    if (data.brand !== undefined) {
      fields.push("brand = ?");
      params.push(data.brand);
    }
    if (data.categoryId !== undefined) {
      fields.push("category_id = ?");
      params.push(data.categoryId ? Number(data.categoryId) : null);
    }
    if (data.imageUrl !== undefined) {
      fields.push("image_url = ?");
      params.push(data.imageUrl);
    }
    if (data.status !== undefined) {
      fields.push("status = ?");
      params.push(data.status);
    }

    if (fields.length === 0) {
      return { message: "No changes provided" };
    }

    await connection.beginTransaction();

    await connection.query(
      `UPDATE products SET ${fields.join(", ")} WHERE product_id = ? AND seller_id = ?`,
      [...params, Number(productId), Number(sellerId)]
    );

    // Keep inventory in sync if stock quantity was passed
    if (data.stockQuantity !== undefined) {
      await connection.query(
        `INSERT INTO inventory (product_id, stock_quantity, reserved_quantity, low_stock_threshold)
         VALUES (?, ?, 0, 5)
         ON DUPLICATE KEY UPDATE stock_quantity = ?`,
        [Number(productId), Number(data.stockQuantity), Number(data.stockQuantity)]
      );
    }

    if (data.lowStockThreshold !== undefined) {
      await connection.query(
        "UPDATE inventory SET low_stock_threshold = ? WHERE product_id = ?",
        [Number(data.lowStockThreshold), Number(productId)]
      );
    }

    await connection.commit();

    return {
      message: "Product updated successfully",
      productId: Number(productId)
    };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Delete product
async function deleteSellerProduct(sellerId, productId) {
  let connection;

  try {
    connection = await pool.getConnection();

    // Verify ownership
    const existing = await connection.query(
      "SELECT product_id FROM products WHERE product_id = ? AND seller_id = ? LIMIT 1",
      [Number(productId), Number(sellerId)]
    );

    if (existing.length === 0) {
      const error = new Error("Product not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    // Check if product is in any active order items
    const orderItems = await connection.query(
      `SELECT oi.order_item_id
       FROM order_items oi
       INNER JOIN orders o ON oi.order_id = o.order_id
       WHERE oi.product_id = ?
         AND o.order_status NOT IN ('delivered', 'cancelled', 'refunded')
       LIMIT 1`,
      [Number(productId)]
    );

    if (orderItems.length > 0) {
      // Soft-delete / deactivate instead to protect order integrity
      await connection.query(
        "UPDATE products SET status = 'inactive' WHERE product_id = ?",
        [Number(productId)]
      );
      return { message: "Product is in active orders. Product has been deactivated." };
    }

    // Safe delete
    await connection.query("DELETE FROM products WHERE product_id = ? AND seller_id = ?", [
      Number(productId),
      Number(sellerId)
    ]);

    return { message: "Product deleted successfully" };
  } finally {
    if (connection) connection.release();
  }
}

// Bulk update status
async function bulkUpdateSellerProductStatus(sellerId, productIds, status) {
  let connection;

  try {
    connection = await pool.getConnection();

    if (!Array.isArray(productIds) || productIds.length === 0) {
      const error = new Error("No product IDs provided");
      error.statusCode = 400;
      throw error;
    }

    const placeholders = productIds.map(() => "?").join(",");
    const result = await connection.query(
      `UPDATE products
       SET status = ?
       WHERE product_id IN (${placeholders})
         AND seller_id = ?`,
      [status, ...productIds.map(Number), Number(sellerId)]
    );

    return {
      message: `Updated ${result.affectedRows} products`,
      affectedRows: Number(result.affectedRows)
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getSellerProducts,
  getSellerProductById,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  bulkUpdateSellerProductStatus
};
