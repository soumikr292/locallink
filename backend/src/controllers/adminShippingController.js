
const shippingService = require("../services/adminShippingService");

const sendError = (res, statusCode, message) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

const validId = (id) =>
  Number.isInteger(Number(id)) && Number(id) > 0;

const validStatus = (status) =>
  status === "active" || status === "inactive";

const handleError = (res, error) => {
  console.error("Shipping Controller Error:", error);

  if (error.code === "ER_DUP_ENTRY") {
    return sendError(res, 409, "This shipping record already exists.");
  }

  return sendError(res, 500, "Shipping operation failed.");
};

// ---------------- SHIPPING ZONES ----------------

exports.listZones = async (req, res, next) => {
  try {
    const data = await shippingService.listShippingZones();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createZone = async (req, res) => {
  try {
    const { zoneName, city, area, pincode, status } = req.body;

    if (!zoneName?.trim() || !city?.trim()) {
      return sendError(res, 400, "Zone name and city are required.");
    }

    if (status !== undefined && !validStatus(status)) {
      return sendError(res, 400, "Invalid zone status.");
    }

    const data = await shippingService.createShippingZone({
      zoneName: zoneName.trim(),
      city: city.trim(),
      area: area?.trim() || null,
      pincode: pincode?.trim() || null,
      status: status || "active",
    });

    return res.status(201).json({
      success: true,
      message: "Shipping zone created successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateZone = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { zoneName, city, area, pincode, status } = req.body;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid zone ID.");
    }

    if (!zoneName?.trim() || !city?.trim()) {
      return sendError(res, 400, "Zone name and city are required.");
    }

    if (!validStatus(status)) {
      return sendError(res, 400, "Status must be active or inactive.");
    }

    const data = await shippingService.updateShippingZone(id, {
      zoneName: zoneName.trim(),
      city: city.trim(),
      area: area?.trim() || null,
      pincode: pincode?.trim() || null,
      status,
    });

    return res.json({
      success: true,
      message: "Shipping zone updated successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.changeZoneStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid zone ID.");
    }

    if (!validStatus(status)) {
      return sendError(res, 400, "Status must be active or inactive.");
    }

    await shippingService.setShippingZoneStatus(id, status);

    return res.json({
      success: true,
      message: "Shipping zone status updated.",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// ---------------- SHIPPING METHODS ----------------

exports.listMethods = async (req, res) => {
  try {
    const data = await shippingService.listShippingMethods();
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.createMethod = async (req, res) => {
  try {
    const {
      methodName,
      description,
      baseCharge,
      estimatedDeliveryMinutes,
      freeDeliveryMinimum,
      status,
    } = req.body;

    const charge = Number(baseCharge);

    if (!methodName?.trim()) {
      return sendError(res, 400, "Method name is required.");
    }

    if (baseCharge === undefined || !Number.isFinite(charge) || charge < 0) {
      return sendError(res, 400, "Base charge must be a non-negative number.");
    }

    if (status !== undefined && !validStatus(status)) {
      return sendError(res, 400, "Invalid method status.");
    }

    const minutes =
      estimatedDeliveryMinutes === "" ||
      estimatedDeliveryMinutes === undefined ||
      estimatedDeliveryMinutes === null
        ? null
        : Number(estimatedDeliveryMinutes);

    const minimum =
      freeDeliveryMinimum === "" ||
      freeDeliveryMinimum === undefined ||
      freeDeliveryMinimum === null
        ? null
        : Number(freeDeliveryMinimum);

    if (minutes !== null && (!Number.isInteger(minutes) || minutes <= 0)) {
      return sendError(res, 400, "Delivery time must be a positive whole number.");
    }

    if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) {
      return sendError(res, 400, "Free delivery minimum must be non-negative.");
    }

    const data = await shippingService.createShippingMethod({
      methodName: methodName.trim(),
      description: description?.trim() || null,
      baseCharge: charge,
      estimatedDeliveryMinutes: minutes,
      freeDeliveryMinimum: minimum,
      status: status || "active",
    });

    return res.status(201).json({
      success: true,
      message: "Shipping method created successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.updateMethod = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      methodName,
      description,
      baseCharge,
      estimatedDeliveryMinutes,
      freeDeliveryMinimum,
      status,
    } = req.body;

    const charge = Number(baseCharge);

    if (!validId(id)) {
      return sendError(res, 400, "Invalid method ID.");
    }

    if (!methodName?.trim()) {
      return sendError(res, 400, "Method name is required.");
    }

    if (baseCharge === undefined || !Number.isFinite(charge) || charge < 0) {
      return sendError(res, 400, "Base charge must be a non-negative number.");
    }

    if (!validStatus(status)) {
      return sendError(res, 400, "Status must be active or inactive.");
    }

    const minutes =
      estimatedDeliveryMinutes === "" ||
      estimatedDeliveryMinutes === undefined ||
      estimatedDeliveryMinutes === null
        ? null
        : Number(estimatedDeliveryMinutes);

    const minimum =
      freeDeliveryMinimum === "" ||
      freeDeliveryMinimum === undefined ||
      freeDeliveryMinimum === null
        ? null
        : Number(freeDeliveryMinimum);

    if (minutes !== null && (!Number.isInteger(minutes) || minutes <= 0)) {
      return sendError(res, 400, "Delivery time must be a positive whole number.");
    }

    if (minimum !== null && (!Number.isFinite(minimum) || minimum < 0)) {
      return sendError(res, 400, "Free delivery minimum must be non-negative.");
    }

    const data = await shippingService.updateShippingMethod(id, {
      methodName: methodName.trim(),
      description: description?.trim() || null,
      baseCharge: charge,
      estimatedDeliveryMinutes: minutes,
      freeDeliveryMinimum: minimum,
      status,
    });

    return res.json({
      success: true,
      message: "Shipping method updated successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.changeMethodStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid method ID.");
    }

    if (!validStatus(status)) {
      return sendError(res, 400, "Status must be active or inactive.");
    }

    await shippingService.setShippingMethodStatus(id, status);

    return res.json({
      success: true,
      message: "Shipping method status updated.",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
