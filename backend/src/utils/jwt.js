const jwt = require("jsonwebtoken");

function generateToken(payload) {
  const tokenData = {
    userId: payload.userId,
    role: payload.role
  };
  if (payload.partnerId !== undefined && payload.partnerId !== null) {
    tokenData.partnerId = payload.partnerId;
  }
  if (payload.email) {
    tokenData.email = payload.email;
  }
  return jwt.sign(
    tokenData,
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d"
    }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = {
  generateToken,
  verifyToken
};
