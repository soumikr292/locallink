const { verifyToken } = require("../utils/jwt");

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access token required"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
}

function requireAdmin(req, res, next) {
  const allowedRoles = ["admin", "super_admin", "staff"];

  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }

  next();
}

function requireSeller(req, res, next) {
  if (!req.user || req.user.role !== "seller") {
    return res.status(403).json({
      success: false,
      message: "Seller access required"
    });
  }

  next();
}

function requireCustomer(req, res, next) {
  if (!req.user || req.user.role !== "customer") {
    return res.status(403).json({
      success: false,
      message: "Customer login required"
    });
  }

  next();
}

function requireRider(req, res, next) {
  const allowed = ["delivery_partner", "rider"];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Delivery partner login required"
    });
  }

  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSeller,
  requireCustomer,
  requireRider
};