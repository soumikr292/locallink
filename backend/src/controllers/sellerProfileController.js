const {
  getFullSellerProfile,
  updateFullSellerProfile
} = require("../services/sellerProfileService");

async function getProfile(req, res, next) {
  try {
    const profile = await getFullSellerProfile(req.user.userId);
    return res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const result = await updateFullSellerProfile(req.user.userId, req.body);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProfile,
  updateProfile
};
