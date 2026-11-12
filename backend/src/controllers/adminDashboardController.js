const {
  getDashboardStats
} = require("../services/adminDashboardService");

async function getDashboard(req, res, next) {
  try {
    const stats = await getDashboardStats();

    return res.status(200).json({
      success: true,
      message: "Dashboard statistics fetched successfully",
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getDashboard };