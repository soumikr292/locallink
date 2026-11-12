const {
  getSellerOrders,
  getSellerOrderById,
  updateSellerOrderStatus
} = require("../services/sellerOrderService");

async function listOrders(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      status = "",
      paymentStatus = "",
      search = ""
    } = req.query;

    const result = await getSellerOrders({
      sellerId: req.user.userId,
      page: Number(page),
      limit: Number(limit),
      status: String(status).trim(),
      paymentStatus: String(paymentStatus).trim(),
      search: String(search).trim()
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getOrder(req, res, next) {
  try {
    const { id } = req.params;
    const result = await getSellerOrderById(req.user.userId, id);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const result = await updateSellerOrderStatus(req.user.userId, id, status);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listOrders,
  getOrder,
  updateStatus
};
