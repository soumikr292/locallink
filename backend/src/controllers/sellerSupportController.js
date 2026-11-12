const {
  getSellerTickets,
  getSellerTicketDetails,
  createSellerTicket,
  replyToSellerTicket
} = require("../services/sellerSupportService");

async function listTickets(req, res, next) {
  try {
    const result = await getSellerTickets(req.user.userId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getTicket(req, res, next) {
  try {
    const { id } = req.params;
    const result = await getSellerTicketDetails(req.user.userId, id);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function createTicket(req, res, next) {
  try {
    const { subject, category, priority, initialMessage } = req.body;
    const result = await createSellerTicket(req.user.userId, {
      subject,
      category,
      priority,
      initialMessage
    });
    return res.status(201).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function replyTicket(req, res, next) {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const result = await replyToSellerTicket(req.user.userId, id, message);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listTickets,
  getTicket,
  createTicket,
  replyTicket
};
