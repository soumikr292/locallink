const { loginAdmin } = require("../services/adminAuthService");

async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await loginAdmin(email, password);

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { adminLogin };

