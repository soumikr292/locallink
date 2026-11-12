const express = require("express");

const {
  listPayments,
  getPaymentDetails,
  changePaymentStatus
} = require("../controllers/adminPaymentController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();

// Get all payments
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  listPayments
);

// Update payment status
router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  changePaymentStatus
);

// Get one payment
router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  getPaymentDetails
);

module.exports = router;