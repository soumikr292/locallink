const express = require("express");
const {
  loginCustomer,
  registerCustomer,
  getProfile,
  updateProfile,
  listProducts,
  comparePrices,
  bargainChat,
  placeOrder,
  listOrders,
  trackOrder,
  addReview
} = require("../controllers/customerController");
const { authenticateToken, requireCustomer } = require("../middleware/authMiddleware");

const router = express.Router();

// Public Auth & Registration
router.post("/auth/login", loginCustomer);
router.post("/auth/register", registerCustomer);

// Public Marketplace Browsing, Price Compare & AI Bargain preview
router.get("/products", listProducts);
router.get("/compare", comparePrices);
router.post("/bargain", bargainChat);

// Protected Customer Account, Orders, Tracking & Reviews
router.get("/profile", authenticateToken, requireCustomer, getProfile);
router.put("/profile", authenticateToken, requireCustomer, updateProfile);
router.post("/orders", authenticateToken, requireCustomer, placeOrder);
router.get("/orders", authenticateToken, requireCustomer, listOrders);
router.get("/orders/:id/track", authenticateToken, requireCustomer, trackOrder);
router.post("/reviews", authenticateToken, requireCustomer, addReview);

module.exports = router;
