const { getSellerDashboardStats } = require("../services/sellerDashboardService");

async function getDashboard(req, res, next) {
  try {
    const stats = await getSellerDashboardStats(req.user.userId);
    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getDashboard };
