const adminSupportService = require("../services/adminSupportService");

async function listTickets(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const priority = typeof req.query.priority === "string" ? req.query.priority.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const result = await adminSupportService.getTickets({ page, limit, status, priority, category, search });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function getTicket(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    if (!ticketId) return res.status(400).json({ success: false, message: "Invalid ticket ID" });

    const result = await adminSupportService.getTicketDetails(ticketId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function sendReply(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    if (!ticketId) return res.status(400).json({ success: false, message: "Invalid ticket ID" });

    const { message, status } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Reply message cannot be empty" });
    }

    const senderId = req.user?.id || 1;
    const result = await adminSupportService.replyToTicket(ticketId, { message, senderId, newStatus: status });
    return res.status(200).json({ success: true, message: result.message, data: result });
  } catch (error) {
    next(error);
  }
}

async function updateTicketStatus(req, res, next) {
  try {
    const ticketId = Number(req.params.id);
    if (!ticketId) return res.status(400).json({ success: false, message: "Invalid ticket ID" });

    const { status, priority } = req.body;
    const result = await adminSupportService.updateTicket(ticketId, { status, priority });
    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

async function createTicket(req, res, next) {
  try {
    const { subject, category, priority, message, sellerId } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: "Subject is required" });
    }

    const adminId = req.user?.id || 1;
    const result = await adminSupportService.createTicket({ subject, category, priority, message, sellerId, adminId });
    return res.status(201).json({ success: true, message: result.message, data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listTickets,
  getTicket,
  sendReply,
  updateTicketStatus,
  createTicket
};
