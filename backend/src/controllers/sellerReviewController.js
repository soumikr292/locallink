const {
  getSellerReviews,
  replyToReview,
  reportReview
} = require("../services/sellerReviewService");

async function listReviews(req, res, next) {
  try {
    const { page = 1, limit = 20, rating = "", productId = "", status = "approved" } = req.query;
    const result = await getSellerReviews({
      sellerId: req.user.userId,
      page: Number(page),
      limit: Number(limit),
      rating: rating ? Number(rating) : "",
      productId: productId ? Number(productId) : "",
      status
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function replyReview(req, res, next) {
  try {
    const { id } = req.params;
    const { replyText } = req.body;
    const result = await replyToReview(req.user.userId, id, replyText);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function reportCustomerReview(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const result = await reportReview(req.user.userId, id, reason);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listReviews,
  replyReview,
  reportCustomerReview
};
