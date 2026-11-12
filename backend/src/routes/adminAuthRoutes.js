const express = require("express");

const {
  adminLogin
} = require("../controllers/adminAuthController");

const {
  validateAdminLogin
} = require("../validators/adminAuthValidator");

const {
  authLimiter
} = require("../middleware/rateLimitMiddleware");

const router = express.Router();

router.post(
  "/login",
  authLimiter,
  validateAdminLogin,
  adminLogin
);

module.exports = router;