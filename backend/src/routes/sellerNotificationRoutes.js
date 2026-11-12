const express = require("express");
const {
  listNotifications,
  markAsRead,
  markAllAsRead
} = require("../controllers/sellerNotificationController");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireSeller);

router.get("/", listNotifications);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);

module.exports = router;
