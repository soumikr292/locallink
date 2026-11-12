const express = require("express");
const {
  listOrders,
  getOrder,
  updateStatus
} = require("../controllers/sellerOrderController");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireSeller);

router.get("/", listOrders);
router.get("/:id", getOrder);
router.patch("/:id/status", updateStatus);

module.exports = router;
