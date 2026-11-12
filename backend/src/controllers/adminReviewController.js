
const {
  getReviews,
  updateReviewStatus,
  updateReviewReport
} = require("../services/adminReviewService");

// Get reviews
async function listReviews(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : "";

    const reported =
      typeof req.query.reported === "string"
        ? req.query.reported.trim()
        : "";

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be greater than 0"
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100"
      });
    }

    if (
      status &&
      !["all", "pending", "approved", "rejected"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid review status"
      });
    }

    if (reported && !["true", "false"].includes(reported)) {
      return res.status(400).json({
        success: false,
        message: "reported must be true or false"
      });
    }

    const result = await getReviews({
      page,
      limit,
      status: status === "all" ? "" : status,
      reported,
      search
    });

    return res.status(200).json({
      success: true,
      message: "Reviews fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

// Approve or reject review
async function changeReviewStatus(req, res, next) {
  try {
    const reviewId = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid review ID is required"
      });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be approved or rejected"
      });
    }

    const result = await updateReviewStatus(reviewId, status);

    return res.status(200).json({
      success: true,
      message: `Review ${status} successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

// Mark or unmark a review as reported
async function changeReviewReport(req, res, next) {
  try {
    const reviewId = Number(req.params.id);
    const { isReported, reason } = req.body;

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid review ID is required"
      });
    }

    if (typeof isReported !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isReported must be true or false"
      });
    }

    if (
      reason !== undefined &&
      reason !== null &&
      typeof reason !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "reason must be text"
      });
    }

    const result = await updateReviewReport(
      reviewId,
      isReported,
      typeof reason === "string" ? reason.trim() : null
    );

    return res.status(200).json({
      success: true,
      message: "Review report updated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listReviews,
  changeReviewStatus,
  changeReviewReport
};
