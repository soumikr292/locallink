
const { pool } = require("../config/database");

async function getCoupons({ page = 1, limit = 20, search = "", status = "" } = {}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push("(code LIKE ? OR description LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status && ["active", "inactive", "expired"].includes(status)) {
      conditions.push("status = ?");
      params.push(status);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const offset = (page - 1) * limit;

    const rows = await connection.query(
      `
      SELECT
        coupon_id,
        code,
        description,
        discount_type,
        discount_value,
        minimum_order_amount,
        maximum_discount,
        usage_limit,
        used_count,
        starts_at,
        expires_at,
        status,
        created_at
      FROM coupons
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const countRows = await connection.query(
      `SELECT COUNT(*) AS total FROM coupons ${whereClause}`,
      params
    );

    return {
      items: rows,
      pagination: {
        page,
        limit,
        total: Number(countRows[0].total),
        totalPages: Math.ceil(Number(countRows[0].total) / limit)
      }
    };
  } finally {
    if (connection) connection.release();
  }
}

async function createCoupon(data) {
  let connection;

  try {
    connection = await pool.getConnection();

    const {
      code,
      description,
      discount_type,
      discount_value,
      minimum_order_amount = 0,
      maximum_discount = null,
      usage_limit = null,
      starts_at = null,
      expires_at = null
    } = data;

    const result = await connection.query(
      `
      INSERT INTO coupons (
        code,
        description,
        discount_type,
        discount_value,
        minimum_order_amount,
        maximum_discount,
        usage_limit,
        starts_at,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        code,
        description || null,
        discount_type,
        discount_value,
        minimum_order_amount,
        maximum_discount,
        usage_limit,
        starts_at,
        expires_at
      ]
    );

    return {
      coupon_id: Number(result.insertId),
      code,
      status: "active"
    };
  } finally {
    if (connection) connection.release();
  }
}


async function getBanners() {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(`
      SELECT
        banner_id,
        title,
        subtitle,
        image_url,
        target_url,
        position,
        starts_at,
        expires_at,
        status,
        created_at
      FROM marketing_banners
      ORDER BY banner_id DESC
    `);

    return rows;
  } finally {
    if (connection) connection.release();
  }
}

async function createBanner(data) {
  let connection;

  try {
    connection = await pool.getConnection();

    const {
      title,
      subtitle = null,
      image_url = null,
      target_url = null,
      position = "homepage",
      starts_at = null,
      expires_at = null
    } = data;

    const result = await connection.query(
      `INSERT INTO marketing_banners
        (title, subtitle, image_url, target_url, position, starts_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        subtitle,
        image_url,
        target_url,
        position,
        starts_at,
        expires_at
      ]
    );

    return {
      banner_id: Number(result.insertId),
      title,
      status: "inactive"
    };
  } finally {
    if (connection) connection.release();
  }
}


async function getFlashSales() {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(`
      SELECT
        flash_sale_id,
        title,
        description,
        starts_at,
        expires_at,
        status,
        created_at
      FROM flash_sales
      ORDER BY flash_sale_id DESC
    `);

    return rows;
  } finally {
    if (connection) connection.release();
  }
}

async function createFlashSale(data) {
  let connection;

  try {
    connection = await pool.getConnection();

    const {
      title,
      description = null,
      starts_at,
      expires_at
    } = data;

    const result = await connection.query(
      `INSERT INTO flash_sales
        (title, description, starts_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [title, description, starts_at, expires_at]
    );

    return {
      flash_sale_id: Number(result.insertId),
      title,
      status: "inactive"
    };
  } finally {
    if (connection) connection.release();
  }
}

async function getAbandonedCarts
({ page = 1, limit = 20, search = "" } = {}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const conditions = [
      "c.cart_status = 'abandoned'",
      "EXISTS (SELECT 1 FROM cart_items ci WHERE ci.cart_id = c.cart_id)"
    ];

    const params = [];

    if (search) {
      conditions.push(
        "(u.name LIKE ? OR u.email LIKE ? OR CAST(c.cart_id AS CHAR) LIKE ?)"
      );

      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const offset = (page - 1) * limit;

    const rows = await connection.query(
      `
      SELECT
        c.cart_id,
        c.customer_id,
        u.name AS customer_name,
        u.email AS customer_email,
        c.last_activity_at,
        c.created_at,
        COUNT(ci.cart_item_id) AS item_count,
        COALESCE(SUM(ci.quantity * ci.unit_price), 0) AS cart_total
      FROM carts c
      INNER JOIN users u ON u.user_id = c.customer_id
      LEFT JOIN cart_items ci ON ci.cart_id = c.cart_id
      ${whereClause}
      GROUP BY
        c.cart_id,
        c.customer_id,
        u.name,
        u.email,
        c.last_activity_at,
        c.created_at
      ORDER BY c.last_activity_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const countRows = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM carts c
      INNER JOIN users u ON u.user_id = c.customer_id
      ${whereClause}
      `,
      params
    );

    return {
      items: rows,
      pagination: {
        page,
        limit,
        total: Number(countRows[0].total),
        totalPages: Math.ceil(Number(countRows[0].total) / limit)
      }
    };
  } finally {
    if (connection) connection.release();
  }
}


async function getAbandonedCarts({ page = 1, limit = 20, search = "" } = {}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const conditions = [
      "c.cart_status = 'abandoned'",
      "EXISTS (SELECT 1 FROM cart_items ci2 WHERE ci2.cart_id = c.cart_id)"
    ];

    const params = [];

    if (search) {
      conditions.push(
        "(u.name LIKE ? OR u.email LIKE ? OR CAST(c.cart_id AS CHAR) LIKE ?)"
      );
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const offset = (page - 1) * limit;

    const rows = await connection.query(
      `
      SELECT
        c.cart_id,
        c.customer_id,
        u.name AS customer_name,
        u.email AS customer_email,
        c.last_activity_at,
        c.created_at,
        COUNT(ci.cart_item_id) AS item_count,
        COALESCE(SUM(ci.quantity * ci.unit_price), 0) AS cart_total
      FROM carts c
      INNER JOIN users u ON u.user_id = c.customer_id
      LEFT JOIN cart_items ci ON ci.cart_id = c.cart_id
      ${whereClause}
      GROUP BY
        c.cart_id, c.customer_id, u.name, u.email,
        c.last_activity_at, c.created_at
      ORDER BY c.last_activity_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const countRows = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM carts c
      INNER JOIN users u ON u.user_id = c.customer_id
      ${whereClause}
      `,
      params
    );

    const total = Number(countRows[0].total);

    return {
      items: rows,
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


module.exports = {
  getCoupons,
  createCoupon,
  getBanners,
  createBanner,
  getFlashSales,
  createFlashSale,
  getAbandonedCarts
};
