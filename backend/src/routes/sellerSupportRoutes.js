const express = require("express");
const {
  listTickets,
  getTicket,
  createTicket,
  replyTicket
} = require("../controllers/sellerSupportController");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireSeller);

router.get("/", listTickets);
router.post("/", createTicket);
router.get("/:id", getTicket);
router.post("/:id/reply", replyTicket);

module.exports = router;
