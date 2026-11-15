const express = require("express");
const {
  listNotifications,
  sendBroadcast,
  removeNotification,
  listTemplates
} = require("../controllers/adminNotificationController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get("/", listNotifications);
router.post("/broadcast", sendBroadcast);
router.delete("/:id", removeNotification);
router.get("/templates", listTemplates);

module.exports = router;
