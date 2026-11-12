const { z } = require("zod");

const sellerLoginSchema = z.object({
  loginIdentifier: z.string().trim().min(1, "Email or phone number is required"),
  password: z.string().min(1, "Password is required")
});

const sellerRegisterSchema = z.object({
  name: z.string().trim().min(2, "Owner name must be at least 2 characters"),
  shopName: z.string().trim().min(2, "Shop name must be at least 2 characters"),
  email: z.string().trim().email("Valid email address is required"),
  phone: z.string().trim().min(10, "Valid 10-digit phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password must match password"),
  shopAddress: z.string().trim().optional(),
  city: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  businessCategory: z.string().trim().optional(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions" })
  })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

const sellerResetSchema = z.object({
  email: z.string().trim().email("Valid email address is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters")
});

function validateSellerLogin(req, res, next) {
  // Support both 'email' and 'loginIdentifier'
  if (!req.body.loginIdentifier && req.body.email) {
    req.body.loginIdentifier = req.body.email;
  }
  const result = sellerLoginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
    });
  }
  req.body = result.data;
  next();
}

function validateSellerRegister(req, res, next) {
  const result = sellerRegisterSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
    });
  }
  req.body = result.data;
  next();
}

function validateSellerPasswordReset(req, res, next) {
  const result = sellerResetSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
    });
  }
  req.body = result.data;
  next();
}

module.exports = {
  validateSellerLogin,
  validateSellerRegister,
  validateSellerPasswordReset
};
