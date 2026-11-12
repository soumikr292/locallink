const {
  getSellerEarningsOverview,
  requestSellerPayout
} = require("../services/sellerEarningsService");

async function getEarnings(req, res, next) {
  try {
    const result = await getSellerEarningsOverview(req.user.userId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function requestPayout(req, res, next) {
  try {
    const { amount, payoutMethod, payoutDetails } = req.body;
    const result = await requestSellerPayout(req.user.userId, {
      amount,
      payoutMethod,
      payoutDetails
    });
    return res.status(201).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getEarnings,
  requestPayout
};
