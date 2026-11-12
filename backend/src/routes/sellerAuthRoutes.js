const express = require("express");
const {
  sellerLogin,
  sellerRegister,
  sellerPasswordReset,
  sellerMe
} = require("../controllers/sellerAuthController");
const {
  validateSellerLogin,
  validateSellerRegister,
  validateSellerPasswordReset
} = require("../validators/sellerAuthValidator");
const { authLimiter } = require("../middleware/rateLimitMiddleware");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", authLimiter, validateSellerLogin, sellerLogin);
router.post("/register", authLimiter, validateSellerRegister, sellerRegister);
router.post("/reset-password", authLimiter, validateSellerPasswordReset, sellerPasswordReset);
router.get("/me", authenticateToken, requireSeller, sellerMe);

module.exports = router;
