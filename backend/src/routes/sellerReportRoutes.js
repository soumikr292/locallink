const express = require("express");
const {
  getAnalytics,
  exportCSV
} = require("../controllers/sellerReportController");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireSeller);

router.get("/analytics", getAnalytics);
router.get("/export", exportCSV);

module.exports = router;
