const {
  getDeliveries,
  getDeliveryById,
  updateDeliveryStatus,
  getAvailableDeliveryPartners,
  assignDeliveryPartner,
  verifyDeliveryOtp,
  getDeliveryPartners
} = require("../services/adminDeliveryService");


async function listDeliveries(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
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
      "assigned",
      "picked_up",
      "out_for_delivery",
      "delivered",
      "failed",
      "cancelled"
    ];

    if (
      status &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery status"
      });
    }

    const result = await getDeliveries({
      page,
      limit,
      status,
      search
    });

    return res.status(200).json({
      success: true,
      message: "Deliveries fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}
async function getDeliveryDetails(req, res, next) {
  try {
    const deliveryId = Number(req.params.id);

    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid delivery ID is required"
      });
    }

    const result = await getDeliveryById(deliveryId);

    return res.status(200).json({
      success: true,
      message: "Delivery details fetched successfully",
      data: result
    });
  } catch (error) {
  console.error("GET DELIVERY DETAILS ERROR:", error);
  next(error);
}
}

async function changeDeliveryStatus(req, res, next) {
  try {
    const deliveryId = Number(req.params.id);
const { deliveryStatus, failureReason } = req.body;
    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid delivery ID is required"
      });
    }

    const allowedStatuses = [
      "pending",
      "assigned",
      "picked_up",
      "out_for_delivery",
      "delivered",
      "failed",
      "cancelled"
    ];

    if (!allowedStatuses.includes(deliveryStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid delivery status"
      });
    }
  if (deliveryStatus === "failed") {
  if (
    typeof failureReason !== "string" ||
    failureReason.trim() === ""
  ) {
    return res.status(400).json({
      success: false,
      message: "Failure reason is required when delivery fails"
    });
  }

  if (failureReason.trim().length > 500) {
    return res.status(400).json({
      success: false,
      message: "Failure reason cannot exceed 500 characters"
    });
  }
}
    const result = await updateDeliveryStatus(
  deliveryId,
  deliveryStatus,
  deliveryStatus === "failed" ? failureReason.trim() : null
);

    return res.status(200).json({
      success: true,
      message: "Delivery status updated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function listAvailableDeliveryPartners(req, res, next) {
  try {
    const partners = await getAvailableDeliveryPartners();

    return res.status(200).json({
      success: true,
      message: "Available delivery partners fetched successfully",
      data: partners
    });
    } catch (error) {
    console.error("Verify delivery OTP error:", error);
    next(error);
  }
}

async function assignDeliveryPartnerToDelivery(
  req,
  res,
  next
) {
  try {
    const deliveryId = Number(req.params.id);
    const { deliveryPartnerId } = req.body;

    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid delivery ID is required"
      });
    }

    const partnerId = Number(deliveryPartnerId);

    if (!Number.isInteger(partnerId) || partnerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid delivery partner ID is required"
      });
    }

    const result = await assignDeliveryPartner(
      deliveryId,
      partnerId
    );

    return res.status(200).json({
      success: true,
      message: "Delivery partner assigned successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function verifyDeliveryOtpController(
  req,
  res,
  next
) {
  try {
    const deliveryId = Number(req.params.id);
    const { deliveryOtp } = req.body;

    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid delivery ID is required"
      });
    }

    if (
      deliveryOtp === undefined ||
      deliveryOtp === null ||
      String(deliveryOtp).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Delivery OTP is required"
      });
    }

    const result = await verifyDeliveryOtp(
      deliveryId,
      String(deliveryOtp).trim()
    );

    return res.status(200).json({
      success: true,
      message: "Delivery OTP verified successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function listDeliveryPartners(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pagination parameters"
      });
    }

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const verificationStatus =
      typeof req.query.verificationStatus === "string"
        ? req.query.verificationStatus.trim()
        : "";

    const availabilityStatus =
      typeof req.query.availabilityStatus === "string"
        ? req.query.availabilityStatus.trim()
        : "";

    const data = await getDeliveryPartners({
      page,
      limit,
      search,
      verificationStatus,
      availabilityStatus
    });

    return res.status(200).json({
      success: true,
      message: "Delivery partners fetched successfully",
      data
    });
   } catch (error) {
    console.error("LIST DELIVERY PARTNERS ERROR:", error);
    next(error);
  }
}


async function changeDeliveryPartnerVerification(req, res, next) {
  try {
    const deliveryPartnerId = Number(req.params.id);
    const { verificationStatus } = req.body;

    if (
  !["pending", "verified", "rejected"].includes(verificationStatus)
) {
  return res.status(400).json({
    success: false,
    message: "Invalid verification status"
  });
}

    if (
      !Number.isInteger(deliveryPartnerId) ||
      deliveryPartnerId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid delivery partner ID is required"
      });
    }

    const data = await updateDeliveryPartnerVerification(
      deliveryPartnerId,
      verificationStatus
    );

    return res.status(200).json({
      success: true,
      message: "Verification status updated successfully",
      data
    });
  } catch (error) {
    next(error);
  }
}


async function getDeliveryTrackingController(req, res, next) {
  try {
    const deliveryId = Number(req.params.id);

    if (!Number.isInteger(deliveryId) || deliveryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid delivery ID is required"
      });
    }

    const result = await getDeliveryTracking(deliveryId);

    return res.status(200).json({
      success: true,
      message: "Delivery tracking data fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  listDeliveries,
  getDeliveryDetails,
  changeDeliveryStatus,
  listAvailableDeliveryPartners,
  assignDeliveryPartnerToDelivery,
  verifyDeliveryOtpController,
  listDeliveryPartners,
  changeDeliveryPartnerVerification,
  getDeliveryTrackingController
};