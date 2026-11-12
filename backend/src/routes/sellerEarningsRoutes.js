const express = require("express");
const {
  getEarnings,
  requestPayout
} = require("../controllers/sellerEarningsController");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireSeller);

router.get(["/", "/overview"], getEarnings);
router.post(["/payout", "/payouts"], requestPayout);

module.exports = router;
