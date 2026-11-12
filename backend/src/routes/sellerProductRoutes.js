const express = require("express");
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateStatus
} = require("../controllers/sellerProductController");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireSeller);

router.get("/", listProducts);
router.post("/", createProduct);
router.patch("/bulk-status", bulkUpdateStatus);
router.get("/:id", getProduct);
router.put("/:id", updateProduct);
router.patch("/:id", updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
