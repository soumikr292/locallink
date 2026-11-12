const express = require("express");
const { getDashboard } = require("../controllers/sellerDashboardController");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(["/", "/stats", "/overview"], authenticateToken, requireSeller, getDashboard);

module.exports = router;
