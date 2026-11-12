const { pool } = require("../config/database");

// ==========================================
// Get all payments
// ==========================================

async function getPayments({
  page = 1,
  limit = 20,
  status = "",
  method = "",
  search = ""
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    // Filter by payment status
    if (status) {
      conditions.push("p.payment_status = ?");
      params.push(status);
    }

    // Filter by payment method
    if (method) {
      conditions.push("p.payment_method = ?");
      params.push(method);
    }

    // Search
    if (search) {
      conditions.push(`
        (
          p.payment_reference LIKE ?
          OR p.transaction_id LIKE ?
          OR o.order_number LIKE ?
          OR u.name LIKE ?
          OR u.email LIKE ?
        )
      `);

      const searchValue = `%${search}%`;

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    // Count
    const countResult = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM payments p

      INNER JOIN orders o
        ON o.order_id = p.order_id

      INNER JOIN users u
        ON u.user_id = p.customer_id

      ${whereClause}
      `,
      params
    );

    const total = Number(countResult[0].total);

    // Payments
    const rows = await connection.query(
      `
      SELECT
        p.payment_id,
        p.order_id,
        o.order_number,

        p.customer_id,
        u.name AS customer_name,
        u.email AS customer_email,

        p.payment_reference,
        p.payment_method,
        p.amount,
        p.payment_status,
        p.transaction_id,
        p.paid_at,
        p.refunded_at,
        p.failure_reason,

        p.created_at,
        p.updated_at

      FROM payments p

      INNER JOIN orders o
        ON o.order_id = p.order_id

      INNER JOIN users u
        ON u.user_id = p.customer_id

      ${whereClause}

      ORDER BY p.created_at DESC

      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      payments: rows.map((payment) => ({
        paymentId: Number(payment.payment_id),

        order: {
          orderId: Number(payment.order_id),
          orderNumber: payment.order_number
        },

        customer: {
          customerId: Number(payment.customer_id),
          name: payment.customer_name,
          email: payment.customer_email
        },

        paymentReference: payment.payment_reference,
        paymentMethod: payment.payment_method,

        amount: Number(payment.amount),

        paymentStatus: payment.payment_status,

        transactionId: payment.transaction_id,

        paidAt: payment.paid_at,
        refundedAt: payment.refunded_at,

        failureReason: payment.failure_reason,

        createdAt: payment.created_at,
        updatedAt: payment.updated_at
      })),

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// ==========================================
// Get payment by ID
// ==========================================

async function getPaymentById(paymentId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `
      SELECT
        p.payment_id,
        p.order_id,
        o.order_number,

        p.customer_id,
        u.name AS customer_name,
        u.email AS customer_email,
        u.phone AS customer_phone,

        p.payment_reference,
        p.payment_method,
        p.amount,
        p.payment_status,
        p.transaction_id,

        p.paid_at,
        p.refunded_at,

        p.failure_reason,

        p.created_at,
        p.updated_at

      FROM payments p

      INNER JOIN orders o
        ON o.order_id = p.order_id

      INNER JOIN users u
        ON u.user_id = p.customer_id

      WHERE p.payment_id = ?

      LIMIT 1
      `,
      [paymentId]
    );

    if (rows.length === 0) {
      const error = new Error("Payment not found");
      error.statusCode = 404;
      throw error;
    }

    const payment = rows[0];

    return {
      paymentId: Number(payment.payment_id),

      order: {
        orderId: Number(payment.order_id),
        orderNumber: payment.order_number
      },

      customer: {
        customerId: Number(payment.customer_id),
        name: payment.customer_name,
        email: payment.customer_email,
        phone: payment.customer_phone
      },

      paymentReference: payment.payment_reference,

      paymentMethod: payment.payment_method,

      amount: Number(payment.amount),

      paymentStatus: payment.payment_status,

      transactionId: payment.transaction_id,

      paidAt: payment.paid_at,

      refundedAt: payment.refunded_at,

      failureReason: payment.failure_reason,

      createdAt: payment.created_at,

      updatedAt: payment.updated_at
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// ==========================================
// Update payment status
// ==========================================

async function updatePaymentStatus(paymentId, paymentStatus) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      `
      UPDATE payments

      SET payment_status = ?

      WHERE payment_id = ?
      `,
      [paymentStatus, paymentId]
    );

    if (result.affectedRows === 0) {
      const error = new Error("Payment not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      paymentId: Number(paymentId),
      paymentStatus
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


module.exports = {
  getPayments,
  getPaymentById,
  updatePaymentStatus
};