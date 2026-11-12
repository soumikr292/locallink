const express = require("express");

const {
  listOrders,
  getOrderDetails,
  changeOrderStatus,
  changePaymentStatus
} = require("../controllers/adminOrderController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();


// Get all orders
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  listOrders
);


// Update order status
router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  changeOrderStatus
);


// Update payment status
router.patch(
  "/:id/payment-status",
  authenticateToken,
  requireAdmin,
  changePaymentStatus
);


// Get one order
router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  getOrderDetails
);


module.exports = router;