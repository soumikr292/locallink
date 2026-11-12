const customerService = require("../services/customerService");

async function loginCustomer(req, res, next) {
  try {
    const { email, phone, password, demo } = req.body || {};
    const result = await customerService.authenticateCustomer({ email, phone, password, demo });
    return res.status(200).json({
      success: true,
      message: "Customer authenticated",
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function registerCustomer(req, res, next) {
  try {
    const result = await customerService.registerCustomer(req.body || {});
    return res.status(201).json({
      success: true,
      message: "Account created successfully!",
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const profile = await customerService.getCustomerProfile(req.user.userId);
    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const updated = await customerService.updateCustomerProfile(req.user.userId, req.body || {});
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully!",
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

async function listProducts(req, res, next) {
  try {
    const { category, search, locality, city, address, nearbyOnly, limit } = req.query;
    const products = await customerService.getCustomerProducts({
      category,
      search,
      locality,
      city,
      address,
      nearbyOnly,
      limit
    });
    return res.status(200).json({
      success: true,
      data: { products }
    });
  } catch (err) {
    next(err);
  }
}

async function comparePrices(req, res, next) {
  try {
    const { item } = req.query;
    const comparisons = await customerService.getCompareItems(item);
    return res.status(200).json({
      success: true,
      data: { comparisons }
    });
  } catch (err) {
    next(err);
  }
}

async function bargainChat(req, res, next) {
  try {
    const { productId, offerPrice, customerMessage } = req.body;
    const result = await customerService.processBargainOffer({ productId, offerPrice, customerMessage });
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function placeOrder(req, res, next) {
  try {
    const orderData = req.body;
    const result = await customerService.createCustomerOrder(req.user.userId, orderData);
    return res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      data: result
    });
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const orders = await customerService.getCustomerOrders(req.user.userId);
    return res.status(200).json({
      success: true,
      data: { orders }
    });
  } catch (err) {
    next(err);
  }
}

async function trackOrder(req, res, next) {
  try {
    const { id } = req.params;
    const tracking = await customerService.getOrderTrackingData(id, req.user.userId);
    return res.status(200).json({
      success: true,
      data: tracking
    });
  } catch (err) {
    next(err);
  }
}

async function addReview(req, res, next) {
  try {
    const { productId, orderId, rating, comment } = req.body;
    const result = await customerService.submitProductReview({ customerId: req.user.userId, productId, orderId, rating, comment });
    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      data: result
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  loginCustomer,
  registerCustomer,
  getProfile,
  updateProfile,
  listProducts,
  comparePrices,
  bargainChat,
  placeOrder,
  listOrders,
  trackOrder,
  addReview
};
