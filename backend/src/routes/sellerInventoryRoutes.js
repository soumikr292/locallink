const express = require("express");
const {
  listInventory,
  adjustStock,
  getStockHistory,
  updateThreshold
} = require("../controllers/sellerInventoryController");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireSeller);

router.get("/", listInventory);
router.post("/adjust", adjustStock);
router.get("/history", getStockHistory);
router.post("/threshold", updateThreshold);

module.exports = router;
