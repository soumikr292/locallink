const {
  getSellerAnalytics,
  generateSellerExportCSV
} = require("../services/sellerReportService");

async function getAnalytics(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const result = await getSellerAnalytics(req.user.userId, {
      startDate,
      endDate
    });
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function exportCSV(req, res, next) {
  try {
    const { type = "products" } = req.query;
    const csvData = await generateSellerExportCSV(req.user.userId, type);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="locallink-seller-${type}-${Date.now()}.csv"`
    );
    return res.status(200).send(csvData);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAnalytics,
  exportCSV
};
