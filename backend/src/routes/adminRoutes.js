const express = require("express");

const {
  getDashboard
} = require("../controllers/adminDashboardController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();

// Protected Admin Dashboard
router.get(
  "/dashboard",
  authenticateToken,
  requireAdmin,
  getDashboard
);

module.exports = router;