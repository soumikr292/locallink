const express = require("express");
const {
  listTickets,
  getTicket,
  sendReply,
  updateTicketStatus,
  createTicket
} = require("../controllers/adminSupportController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get("/tickets", listTickets);
router.get("/tickets/:id", getTicket);
router.post("/tickets/:id/reply", sendReply);
router.patch("/tickets/:id/status", updateTicketStatus);
router.post("/tickets", createTicket);

module.exports = router;
