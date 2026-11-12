
const express = require("express");

const {
  listReviews,
  changeReviewStatus,
  changeReviewReport
} = require("../controllers/adminReviewController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();

// Get reviews and apply filters
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  listReviews
);

// Approve or reject a review
router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  changeReviewStatus
);

// Mark or unmark a reported review
router.patch(
  "/:id/report",
  authenticateToken,
  requireAdmin,
  changeReviewReport
);

module.exports = router;
