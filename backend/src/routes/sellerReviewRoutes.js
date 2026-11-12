const express = require("express");
const {
  listReviews,
  replyReview,
  reportCustomerReview
} = require("../controllers/sellerReviewController");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireSeller);

router.get("/", listReviews);
router.post("/:id/reply", replyReview);
router.post("/:id/report", reportCustomerReview);

module.exports = router;
