const { pool } = require("../config/database");

// Get customer reviews for this seller's products
async function getSellerReviews({
  sellerId,
  page = 1,
  limit = 20,
  rating = "",
  productId = "",
  status = "approved"
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * limit;
    const conditions = ["p.seller_id = ?"];
    const params = [Number(sellerId)];

    if (status) {
      conditions.push("r.review_status = ?");
      params.push(status);
    }

    if (rating) {
      conditions.push("r.rating = ?");
      params.push(Number(rating));
    }

    if (productId) {
      conditions.push("r.product_id = ?");
      params.push(Number(productId));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countResult = await connection.query(
      `SELECT COUNT(*) AS total
       FROM reviews r
       INNER JOIN products p ON r.product_id = p.product_id
       ${whereClause}`,
      params
    );

    const total = Number(countResult[0]?.total || 0);

    const rows = await connection.query(
      `SELECT
         r.review_id,
         r.product_id,
         p.name AS product_name,
         p.image_url AS product_image,
         r.customer_id,
         u.name AS customer_name,
         r.rating,
         r.title,
         r.review_text,
         r.review_status,
         r.is_reported,
         r.report_reason,
         r.seller_reply,
         r.seller_replied_at,
         r.created_at
       FROM reviews r
       INNER JOIN products p ON r.product_id = p.product_id
       INNER JOIN users u ON r.customer_id = u.user_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Summary statistics
    const ratingSummaryRows = await connection.query(
      `SELECT
         COUNT(*) AS totalReviews,
         COALESCE(AVG(r.rating), 0) AS averageRating,
         SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS fiveStar,
         SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS fourStar,
         SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS threeStar,
         SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS twoStar,
         SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS oneStar
       FROM reviews r
       INNER JOIN products p ON r.product_id = p.product_id
       WHERE p.seller_id = ? AND r.review_status = 'approved'`,
      [Number(sellerId)]
    );

    const summary = ratingSummaryRows[0] || {};

    return {
      reviews: rows.map((r) => ({
        reviewId: Number(r.review_id),
        productId: Number(r.product_id),
        productName: r.product_name,
        productImage: r.product_image,
        customerId: Number(r.customer_id),
        customerName: r.customer_name,
        rating: Number(r.rating),
        title: r.title,
        reviewText: r.review_text,
        reviewStatus: r.review_status,
        isReported: Boolean(r.is_reported),
        reportReason: r.report_reason,
        sellerReply: r.seller_reply,
        sellerRepliedAt: r.seller_replied_at,
        createdAt: r.created_at
      })),
      statistics: {
        totalReviews: Number(summary.totalReviews || 0),
        averageRating: Number(Number(summary.averageRating || 0).toFixed(1)),
        breakdown: {
          5: Number(summary.fiveStar || 0),
          4: Number(summary.fourStar || 0),
          3: Number(summary.threeStar || 0),
          2: Number(summary.twoStar || 0),
          1: Number(summary.oneStar || 0)
        }
      },
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

// Seller reply to a review
async function replyToReview(sellerId, reviewId, replyText) {
  let connection;

  if (!replyText || !replyText.trim()) {
    const error = new Error("Reply message cannot be empty");
    error.statusCode = 400;
    throw error;
  }

  try {
    connection = await pool.getConnection();

    // Verify review belongs to this seller's product
    const check = await connection.query(
      `SELECT r.review_id
       FROM reviews r
       INNER JOIN products p ON r.product_id = p.product_id
       WHERE r.review_id = ? AND p.seller_id = ?
       LIMIT 1`,
      [Number(reviewId), Number(sellerId)]
    );

    if (check.length === 0) {
      const error = new Error("Review not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    await connection.query(
      `UPDATE reviews
       SET seller_reply = ?, seller_replied_at = NOW()
       WHERE review_id = ?`,
      [replyText.trim(), Number(reviewId)]
    );

    return {
      message: "Reply posted successfully",
      reviewId: Number(reviewId),
      sellerReply: replyText.trim()
    };
  } finally {
    if (connection) connection.release();
  }
}

// Report an inappropriate review
async function reportReview(sellerId, reviewId, reason) {
  let connection;

  if (!reason || !reason.trim()) {
    const error = new Error("Reason for reporting is required");
    error.statusCode = 400;
    throw error;
  }

  try {
    connection = await pool.getConnection();

    // Verify review belongs to this seller's product
    const check = await connection.query(
      `SELECT r.review_id
       FROM reviews r
       INNER JOIN products p ON r.product_id = p.product_id
       WHERE r.review_id = ? AND p.seller_id = ?
       LIMIT 1`,
      [Number(reviewId), Number(sellerId)]
    );

    if (check.length === 0) {
      const error = new Error("Review not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    await connection.query(
      `UPDATE reviews
       SET is_reported = 1, report_reason = ?
       WHERE review_id = ?`,
      [reason.trim(), Number(reviewId)]
    );

    return {
      message: "Review reported to admin moderation team.",
      reviewId: Number(reviewId)
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getSellerReviews,
  replyToReview,
  reportReview
};
