
const { pool } = require("../config/database");

// Get reviews with filters and pagination
async function getReviews({
  page = 1,
  limit = 20,
  status = "",
  reported = "",
  search = ""
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    page = Math.max(1, Number(page) || 1);
    limit = Math.min(100, Math.max(1, Number(limit) || 20));

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (["pending", "approved", "rejected"].includes(status)) {
      conditions.push("r.review_status = ?");
      params.push(status);
    }

    if (reported === "true") {
      conditions.push("r.is_reported = 1");
    } else if (reported === "false") {
      conditions.push("r.is_reported = 0");
    }

    if (search) {
      conditions.push(`(
        p.name LIKE ?
        OR u.name LIKE ?
        OR r.title LIKE ?
        OR r.review_text LIKE ?
      )`);

      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countRows = await connection.query(
      `SELECT COUNT(*) AS total
       FROM reviews r
       LEFT JOIN products p ON p.product_id = r.product_id
       LEFT JOIN users u ON u.user_id = r.customer_id
       ${whereClause}`,
      params
    );

    const total = Number(countRows[0].total);

    const rows = await connection.query(
      `SELECT
         r.review_id,
         r.product_id,
         p.name AS product_name,
         r.customer_id,
         u.name AS customer_name,
         r.rating,
         r.title,
         r.review_text,
         r.review_status,
         r.is_reported,
         r.report_reason,
         r.created_at,
         r.updated_at
       FROM reviews r
       LEFT JOIN products p ON p.product_id = r.product_id
       LEFT JOIN users u ON u.user_id = r.customer_id
       ${whereClause}
       ORDER BY r.review_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      reviews: rows.map((r) => ({
        id: Number(r.review_id),
        productId: Number(r.product_id),
        productName: r.product_name || "Unknown product",
        customerId: Number(r.customer_id),
        customerName: r.customer_name || "Unknown customer",
        rating: Number(r.rating),
        title: r.title,
        reviewText: r.review_text,
        status: r.review_status,
        isReported: Boolean(r.is_reported),
        reportReason: r.report_reason,
        createdAt: r.created_at,
        updatedAt: r.updated_at
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

// Approve or reject a review
async function updateReviewStatus(reviewId, status) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      `UPDATE reviews
       SET review_status = ?
       WHERE review_id = ?`,
      [status, reviewId]
    );

    if (Number(result.affectedRows) === 0) {
      const error = new Error("Review not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      id: Number(reviewId),
      status
    };
  } finally {
    if (connection) connection.release();
  }
}

// Mark or unmark a review as reported
async function updateReviewReport(reviewId, isReported, reason = null) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      `UPDATE reviews
       SET is_reported = ?, report_reason = ?
       WHERE review_id = ?`,
      [isReported ? 1 : 0, isReported ? reason : null, reviewId]
    );

    if (Number(result.affectedRows) === 0) {
      const error = new Error("Review not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      id: Number(reviewId),
      isReported
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getReviews,
  updateReviewStatus,
  updateReviewReport
};
