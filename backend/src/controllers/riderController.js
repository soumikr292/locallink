const riderService = require("../services/riderService");

async function getPartnerId(req) {
  const partnerId = await riderService.resolvePartnerIdForUser(req.user);
  if (!partnerId) {
    const err = new Error("Delivery partner profile not found");
    err.statusCode = 403;
    throw err;
  }
  return partnerId;
}

async function loginRider(req, res, next) {
  try {
    const { email, phone, password, demo } = req.body || {};
    const result = await riderService.authenticateRider({ email, phone, password, demo });
    return res.status(200).json({
      success: true,
      message: "Rider authenticated",
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function registerRider(req, res, next) {
  try {
    const result = await riderService.registerRider(req.body || {});
    return res.status(201).json({
      success: true,
      message: "Delivery partner account created!",
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const partnerId = await getPartnerId(req);
    const profile = await riderService.getRiderProfile(partnerId);
    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (err) {
    next(err);
  }
}

async function getActiveDelivery(req, res, next) {
  try {
    const partnerId = await getPartnerId(req);
    const active = await riderService.getActiveDelivery(partnerId);
    return res.status(200).json({
      success: true,
      data: active
    });
  } catch (err) {
    next(err);
  }
}

async function getAvailableOrders(req, res, next) {
  try {
    const available = await riderService.getAvailableDeliveries();
    return res.status(200).json({
      success: true,
      data: { orders: available }
    });
  } catch (err) {
    next(err);
  }
}

async function acceptOrder(req, res, next) {
  try {
    const partnerId = await getPartnerId(req);
    const { id } = req.params;
    const result = await riderService.acceptDelivery(partnerId, id);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const partnerId = await getPartnerId(req);
    const { id } = req.params;
    let { status, action, otp } = req.body || {};
    if (!status && action) {
      if (action === "pickup") status = "picked_up";
      else if (action === "deliver") status = "delivered";
      else status = action;
    }
    const result = await riderService.updateDeliveryStatus(partnerId, id, status, otp);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function updateLocation(req, res, next) {
  try {
    const partnerId = await getPartnerId(req);
    const { latitude, longitude, lat, lng, deliveryId } = req.body || {};
    const finalLat = latitude !== undefined ? latitude : lat;
    const finalLng = longitude !== undefined ? longitude : lng;
    const result = await riderService.updateRiderLocation(partnerId, finalLat, finalLng, deliveryId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getEarnings(req, res, next) {
  try {
    const partnerId = await getPartnerId(req);
    const earnings = await riderService.getRiderEarnings(partnerId);
    return res.status(200).json({
      success: true,
      data: earnings
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  loginRider,
  registerRider,
  getProfile,
  getActiveDelivery,
  getAvailableOrders,
  acceptOrder,
  updateStatus,
  updateLocation,
  getEarnings
};
