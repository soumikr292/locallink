function errorHandler(err, req, res, next) {
  console.error("========== LOCALINK ERROR ==========");
  console.error("Message:", err.message);
  console.error("Status:", err.statusCode);
  console.error("Stack:", err.stack);
  console.error("====================================");

  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : err.message
  });
}

module.exports = {
  errorHandler
};