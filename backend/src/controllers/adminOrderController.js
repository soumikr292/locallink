const {
  getOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus
} = require("../services/adminOrderService");


// Get all orders
async function listOrders(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : "";

    const paymentStatus =
      typeof req.query.paymentStatus === "string"
        ? req.query.paymentStatus.trim()
        : "";

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";


    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be greater than 0"
      });
    }


    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100"
      });
    }


    const allowedStatuses = [
      "pending",
      "confirmed",
      "processing",
      "ready_for_pickup",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "returned",
      "refunded"
    ];


    if (
      status &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status"
      });
    }


    const allowedPaymentStatuses = [
      "pending",
      "paid",
      "failed",
      "refunded",
      "partially_refunded"
    ];


    if (
      paymentStatus &&
      !allowedPaymentStatuses.includes(paymentStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status"
      });
    }


    const result = await getOrders({
      page,
      limit,
      status,
      paymentStatus,
      search
    });


    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: result
    });

  } catch (error) {
    next(error);
  }
}



// Get one order
async function getOrderDetails(req, res, next) {
  try {
    const orderId = Number(req.params.id);


    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid order ID is required"
      });
    }


    const result =
      await getOrderById(orderId);


    return res.status(200).json({
      success: true,
      message: "Order details fetched successfully",
      data: result
    });

  } catch (error) {
    next(error);
  }
}



// Update order status
async function changeOrderStatus(req, res, next) {
  try {
    const orderId = Number(req.params.id);

    const { status } = req.body;


    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid order ID is required"
      });
    }


    const allowedStatuses = [
      "pending",
      "confirmed",
      "processing",
      "ready_for_pickup",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "returned",
      "refunded"
    ];


    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status"
      });
    }


    const result =
      await updateOrderStatus(
        orderId,
        status
      );


    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: result
    });

  } catch (error) {
    next(error);
  }
}



// Update payment status
async function changePaymentStatus(req, res, next) {
  try {
    const orderId = Number(req.params.id);

    const { paymentStatus } = req.body;


    if (
      !Number.isInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid order ID is required"
      });
    }


    const allowedPaymentStatuses = [
      "pending",
      "paid",
      "failed",
      "refunded",
      "partially_refunded"
    ];


    if (
      !allowedPaymentStatuses.includes(
        paymentStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status"
      });
    }


    const result =
      await updatePaymentStatus(
        orderId,
        paymentStatus
      );


    return res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      data: result
    });

  } catch (error) {
    next(error);
  }
}


module.exports = {
  listOrders,
  getOrderDetails,
  changeOrderStatus,
  changePaymentStatus
};