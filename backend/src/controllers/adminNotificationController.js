const adminNotificationService = require("../services/adminNotificationService");

async function listNotifications(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const audience = typeof req.query.audience === "string" ? req.query.audience.trim() : "";
    const channel = typeof req.query.channel === "string" ? req.query.channel.trim() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const result = await adminNotificationService.getNotifications({ page, limit, audience, channel, search });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function sendBroadcast(req, res, next) {
  try {
    const { title, message } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Notification title is required." });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Notification message body is required." });
    }

    const createdBy = req.user?.name || "Admin Operations";
    const result = await adminNotificationService.createBroadcast({ ...req.body, createdBy });
    return res.status(201).json({ success: true, message: result.message, data: result });
  } catch (error) {
    next(error);
  }
}

async function removeNotification(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid notification ID" });

    const result = await adminNotificationService.deleteNotification(id);
    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

async function listTemplates(req, res, next) {
  try {
    const templates = adminNotificationService.getNotificationTemplates();
    return res.status(200).json({ success: true, data: { templates } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listNotifications,
  sendBroadcast,
  removeNotification,
  listTemplates
};
