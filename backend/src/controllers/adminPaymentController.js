const {
  getPayments,
  getPaymentById,
  updatePaymentStatus
} = require("../services/adminPaymentService");

// ==========================================
// Get all payments
// ==========================================

async function listPayments(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : "";

    const method =
      typeof req.query.method === "string"
        ? req.query.method.trim()
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
      "processing",
      "paid",
      "failed",
      "refunded",
      "partially_refunded"
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status"
      });
    }

    const allowedMethods = [
      "cod",
      "upi",
      "card",
      "net_banking",
      "wallet"
    ];

    if (method && !allowedMethods.includes(method)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method"
      });
    }

    const result = await getPayments({
      page,
      limit,
      status,
      method,
      search
    });

    return res.status(200).json({
      success: true,
      message: "Payments fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// ==========================================
// Get payment details
// ==========================================

async function getPaymentDetails(req, res, next) {
  try {
    const paymentId = Number(req.params.id);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment ID is required"
      });
    }

    const result = await getPaymentById(paymentId);

    return res.status(200).json({
      success: true,
      message: "Payment details fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// ==========================================
// Update payment status
// ==========================================

async function changePaymentStatus(req, res, next) {
  try {
    const paymentId = Number(req.params.id);
    const { paymentStatus } = req.body;

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment ID is required"
      });
    }

    const allowedStatuses = [
      "pending",
      "processing",
      "paid",
      "failed",
      "refunded",
      "partially_refunded"
    ];

    if (!allowedStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status"
      });
    }

    const result = await updatePaymentStatus(
      paymentId,
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
  listPayments,
  getPaymentDetails,
  changePaymentStatus
};