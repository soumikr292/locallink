const express = require("express");

const {
  listInventory,
  getProductInventory,
  changeStock,
  listAdjustmentHistory
} = require("../controllers/adminInventoryController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();


// Get inventory list
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  listInventory
);


// Get adjustment history
router.get(
  "/adjustments",
  authenticateToken,
  requireAdmin,
  listAdjustmentHistory
);


// Get inventory for a specific product
router.get(
  "/product/:productId",
  authenticateToken,
  requireAdmin,
  getProductInventory
);


// Adjust product stock
router.patch(
  "/product/:productId/stock",
  authenticateToken,
  requireAdmin,
  changeStock
);


module.exports = router;