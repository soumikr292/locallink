const { pool } = require("../config/database");

// Get products
async function getProducts({
  page = 1,
  limit = 20,
  search = "",
  status = "",
  sellerId = ""
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
          OR p.slug LIKE ?
        )
      `);

      const searchValue = `%${search}%`;

      params.push(
        searchValue,
        searchValue,
        searchValue
      );
    }

    if (status) {
      conditions.push("p.status = ?");
      params.push(status);
    }

    if (sellerId) {
      conditions.push("p.seller_id = ?");
      params.push(Number(sellerId));
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countRows = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM products p
      ${whereClause}
      `,
      params
    );

    const total = Number(countRows[0].total);

    const rows = await connection.query(
      `
      SELECT
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
        p.updated_at
      FROM products p
      LEFT JOIN categories c
        ON p.category_id = c.category_id
      ${whereClause}
      ORDER BY p.product_id DESC
      LIMIT ? OFFSET ?
      `,
      [
        ...params,
        limit,
        offset
      ]
    );

    return {
      products: rows.map((product) => ({
        id: Number(product.product_id),
        sellerId: Number(product.seller_id),
        name: product.name,
        slug: product.slug,
        description: product.description,
        sku: product.sku,
        price: Number(product.price),
        discountPrice:
          product.discount_price === null
            ? null
            : Number(product.discount_price),
        stockQuantity: Number(product.stock_quantity),
        brand: product.brand,

        categoryId:
          product.category_id === null
            ? null
            : Number(product.category_id),

        categoryName: product.category_name,

        imageUrl: product.image_url,
        status: product.status,
        createdAt: product.created_at,
        updatedAt: product.updated_at
      })),

      pagination: {
        page,
        limit,
        total,
        totalPages:
          total === 0
            ? 0
            : Math.ceil(total / limit)
      }
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Create product
async function createProduct({
  sellerId,
  name,
  slug,
  description,
  sku,
  price,
  discountPrice,
  stockQuantity,
  brand,
  categoryId,
  imageUrl,
  status = "draft"
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    // Check seller
    const sellerRows = await connection.query(
      `
      SELECT user_id
      FROM users
      WHERE user_id = ?
        AND role = 'seller'
        AND status = 'active'
      LIMIT 1
      `,
      [sellerId]
    );

    if (sellerRows.length === 0) {
      const error = new Error(
        "Active seller not found"
      );

      error.statusCode = 404;
      throw error;
    }

    // Check category if provided
    if (categoryId !== null && categoryId !== undefined && categoryId !== "") {
      const categoryRows = await connection.query(
        `
        SELECT category_id
        FROM categories
        WHERE category_id = ?
          AND status = 'active'
        LIMIT 1
        `,
        [categoryId]
      );

      if (categoryRows.length === 0) {
        const error = new Error(
          "Active category not found"
        );

        error.statusCode = 404;
        throw error;
      }
    }

    // Check duplicate SKU
    const skuRows = await connection.query(
      `
      SELECT product_id
      FROM products
      WHERE sku = ?
      LIMIT 1
      `,
      [sku]
    );

    if (skuRows.length > 0) {
      const error = new Error(
        "Product SKU already exists"
      );

      error.statusCode = 409;
      throw error;
    }

    // Check duplicate slug
    const slugRows = await connection.query(
      `
      SELECT product_id
      FROM products
      WHERE slug = ?
      LIMIT 1
      `,
      [slug]
    );

    if (slugRows.length > 0) {
      const error = new Error(
        "Product slug already exists"
      );

      error.statusCode = 409;
      throw error;
    }

    const result = await connection.query(
      `
      INSERT INTO products (
        seller_id,
        name,
        slug,
        description,
        sku,
        price,
        discount_price,
        stock_quantity,
        brand,
        category_id,
        image_url,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        sellerId,
        name,
        slug,
        description,
        sku,
        price,
        discountPrice,
        stockQuantity,
        brand,
        categoryId,
        imageUrl,
        status
      ]
    );

    return {
      id: Number(result.insertId),
      sellerId,
      name,
      slug,
      description,
      sku,
      price,
      discountPrice,
      stockQuantity,
      brand,
      categoryId,
      imageUrl,
      status
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Update product
async function updateProduct({
  productId,
  name,
  slug,
  description,
  sku,
  price,
  discountPrice,
  stockQuantity,
  brand,
  categoryId,
  imageUrl,
  status
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    // Check product exists
    const productRows = await connection.query(
      `
      SELECT product_id
      FROM products
      WHERE product_id = ?
      LIMIT 1
      `,
      [productId]
    );

    if (productRows.length === 0) {
      const error = new Error(
        "Product not found"
      );

      error.statusCode = 404;
      throw error;
    }

    // Check category if provided
    if (categoryId !== null && categoryId !== undefined && categoryId !== "") {
      const categoryRows = await connection.query(
        `
        SELECT category_id
        FROM categories
        WHERE category_id = ?
          AND status = 'active'
        LIMIT 1
        `,
        [categoryId]
      );

      if (categoryRows.length === 0) {
        const error = new Error(
          "Active category not found"
        );

        error.statusCode = 404;
        throw error;
      }
    }

    // Check duplicate SKU
    const skuRows = await connection.query(
      `
      SELECT product_id
      FROM products
      WHERE sku = ?
        AND product_id <> ?
      LIMIT 1
      `,
      [sku, productId]
    );

    if (skuRows.length > 0) {
      const error = new Error(
        "Product SKU already exists"
      );

      error.statusCode = 409;
      throw error;
    }

    // Check duplicate slug
    const slugRows = await connection.query(
      `
      SELECT product_id
      FROM products
      WHERE slug = ?
        AND product_id <> ?
      LIMIT 1
      `,
      [slug, productId]
    );

    if (slugRows.length > 0) {
      const error = new Error(
        "Product slug already exists"
      );

      error.statusCode = 409;
      throw error;
    }

    await connection.query(
      `
      UPDATE products
      SET
        name = ?,
        slug = ?,
        description = ?,
        sku = ?,
        price = ?,
        discount_price = ?,
        stock_quantity = ?,
        brand = ?,
        category_id = ?,
        image_url = ?,
        status = ?
      WHERE product_id = ?
      `,
      [
        name,
        slug,
        description,
        sku,
        price,
        discountPrice,
        stockQuantity,
        brand,
        categoryId,
        imageUrl,
        status,
        productId
      ]
    );

    const updatedRows = await connection.query(
      `
      SELECT
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
        p.updated_at
      FROM products p
      LEFT JOIN categories c
        ON p.category_id = c.category_id
      WHERE p.product_id = ?
      LIMIT 1
      `,
      [productId]
    );

    const product = updatedRows[0];

    return {
      id: Number(product.product_id),
      sellerId: Number(product.seller_id),
      name: product.name,
      slug: product.slug,
      description: product.description,
      sku: product.sku,
      price: Number(product.price),
      discountPrice:
        product.discount_price === null
          ? null
          : Number(product.discount_price),
      stockQuantity: Number(product.stock_quantity),
      brand: product.brand,

      categoryId:
        product.category_id === null
          ? null
          : Number(product.category_id),

      categoryName: product.category_name,

      imageUrl: product.image_url,
      status: product.status,
      createdAt: product.created_at,
      updatedAt: product.updated_at
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


async function deleteProduct(productId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const productRows = await connection.query(
      `
      SELECT product_id, status
      FROM products
      WHERE product_id = ?
      LIMIT 1
      `,
      [productId]
    );

    if (productRows.length === 0) {
      const error = new Error(
        "Product not found"
      );

      error.statusCode = 404;
      throw error;
    }

    await connection.query(
      `
      UPDATE products
      SET status = 'inactive'
      WHERE product_id = ?
      `,
      [productId]
    );

    return {
      id: Number(productId),
      status: "inactive"
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


module.exports = {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct
};