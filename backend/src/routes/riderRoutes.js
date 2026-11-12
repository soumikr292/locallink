const express = require("express");
const {
  loginRider,
  registerRider,
  getProfile,
  getActiveDelivery,
  getAvailableOrders,
  acceptOrder,
  updateStatus,
  updateLocation,
  getEarnings
} = require("../controllers/riderController");
const { authenticateToken, requireRider } = require("../middleware/authMiddleware");

const router = express.Router();

// Public Auth & Registration
router.post("/auth/login", loginRider);
router.post("/auth/register", registerRider);

// Protected Delivery Partner Console Routes
router.use(authenticateToken, requireRider);

router.get("/profile", getProfile);
router.get("/active-delivery", getActiveDelivery);
router.get("/available-orders", getAvailableOrders);
router.post("/accept/:id", acceptOrder);
router.post("/status/:id", updateStatus);
router.post("/location", updateLocation);
router.get("/earnings", getEarnings);

module.exports = router;
