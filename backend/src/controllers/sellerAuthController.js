const {
  loginSeller,
  registerSeller,
  resetSellerPassword,
  getSellerProfile
} = require("../services/sellerAuthService");

async function sellerLogin(req, res, next) {
  try {
    const { loginIdentifier, email, phone, password } = req.body;
    const identifier = loginIdentifier || email || phone;
    const result = await loginSeller(identifier, password);
    return res.status(200).json({
      success: true,
      message: "Seller login successful",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function sellerRegister(req, res, next) {
  try {
    const result = await registerSeller(req.body);
    return res.status(201).json({
      success: true,
      message: "Seller registration submitted successfully. Your account is pending admin approval.",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function sellerPasswordReset(req, res, next) {
  try {
    const { email, newPassword } = req.body;
    const result = await resetSellerPassword(email, newPassword);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
}

async function sellerMe(req, res, next) {
  try {
    const result = await getSellerProfile(req.user.userId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sellerLogin,
  sellerRegister,
  sellerPasswordReset,
  sellerMe
};
