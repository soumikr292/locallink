const express = require("express");

const {
  listProducts,
  addProduct,
  editProduct,
  removeProduct
} = require("../controllers/adminProductController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();


// Get all products
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  listProducts
);


// Create product
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  addProduct
);


// Update product
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  editProduct
);
// Deactivate product
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  removeProduct
);

module.exports = router;