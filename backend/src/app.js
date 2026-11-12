const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

// Ensure BigInt values are converted to Numbers when serializing JSON responses
BigInt.prototype.toJSON = function () {
  return Number(this);
};

// ===============================
// Admin Routes
// ===============================

const adminAuthRoutes = require("./routes/adminAuthRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const adminProductRoutes = require("./routes/adminProductRoutes");
const adminCategoryRoutes = require("./routes/adminCategoryRoutes");
const adminInventoryRoutes = require("./routes/adminInventoryRoutes");
const adminOrderRoutes = require("./routes/adminOrderRoutes");
const adminPaymentRoutes = require("./routes/adminPaymentRoutes");
const adminDeliveryRoutes = require("./routes/adminDeliveryRoutes");
const adminShippingRoutes = require("./routes/adminShippingRoutes");
const adminMarketingRoutes = require("./routes/adminMarketingRoutes");
const adminReviewRoutes = require("./routes/adminReviewRoutes");
const adminContentRoutes = require("./routes/adminContentRoutes");

// ===============================
// Seller Routes
// ===============================
const sellerAuthRoutes = require("./routes/sellerAuthRoutes");
const sellerDashboardRoutes = require("./routes/sellerDashboardRoutes");
const sellerProductRoutes = require("./routes/sellerProductRoutes");
const sellerCategoryRoutes = require("./routes/sellerCategoryRoutes");
const sellerInventoryRoutes = require("./routes/sellerInventoryRoutes");
const sellerOrderRoutes = require("./routes/sellerOrderRoutes");
const sellerEarningsRoutes = require("./routes/sellerEarningsRoutes");
const sellerReviewRoutes = require("./routes/sellerReviewRoutes");
const sellerProfileRoutes = require("./routes/sellerProfileRoutes");
const sellerNotificationRoutes = require("./routes/sellerNotificationRoutes");
const sellerSupportRoutes = require("./routes/sellerSupportRoutes");
const sellerReportRoutes = require("./routes/sellerReportRoutes");

// ===============================
// Customer & Delivery Rider Routes
// ===============================
const customerRoutes = require("./routes/customerRoutes");
const riderRoutes = require("./routes/riderRoutes");

const { errorHandler } = require("./middleware/errorMiddleware");

const app = express();

// ===============================
// Security Middleware
// ===============================

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  hsts: false
}));

// ===============================
// CORS
// ===============================

app.use(cors({
  origin: true,
  credentials: true
}));

// ===============================
// Static Files (Frontend UI)
// ===============================

const frontendPath = path.join(__dirname, "../../frontend");
app.use(express.static(frontendPath, { index: false }));

// ===============================
// Body Parser
// ===============================

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ===============================
// Logging
// ===============================

app.use(morgan("dev"));

app.use("/api/admin/shipping", adminShippingRoutes);

// ===============================
// Health Check
// ===============================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "LocalLink",
    status: "online"
  });
});

// ===============================
// Test API
// ===============================

app.get("/api/test", (req, res) => {
  res.status(200).json({
    success: true,
    message: "LocalLink API is working"
  });
});

// ===============================
// Admin Authentication
// ===============================

app.use(
  "/api/admin/auth",
  adminAuthRoutes
);

// ===============================
// Admin Dashboard
// ===============================

app.use(
  "/api/admin",
  adminRoutes
);

// ===============================
// Admin User Management
// ===============================

app.use(
  "/api/admin/users",
  adminUserRoutes
);

// ===============================
// Admin Product Management
// ===============================

app.use(
  "/api/admin/products",
  adminProductRoutes
);

// ===============================
// Admin Category Management
// ===============================

app.use(
  "/api/admin/categories",
  adminCategoryRoutes
);

// ===============================
// Admin Inventory Management
// ===============================

app.use(
  "/api/admin/inventory",
  adminInventoryRoutes
);

// ===============================
// Admin Order Management
// ===============================

app.use(
  "/api/admin/orders",
  adminOrderRoutes
);
// ===============================
// Admin Payment Management
// ===============================

app.use(
  "/api/admin/payments",
  adminPaymentRoutes
);

app.use(
  "/api/admin/deliveries",
  adminDeliveryRoutes
);

// ===============================
// Admin Marketing Management
// ===============================

app.use(
  "/api/admin/marketing",
  adminMarketingRoutes
);

app.use(
  "/api/admin/reviews",
  adminReviewRoutes
);

// Admin Content Management (Pages, Blog, FAQs, Media Library)
app.use("/api/admin/content", adminContentRoutes);

// ===============================
// Seller Endpoints
// ===============================
app.use("/api/seller/auth", sellerAuthRoutes);
app.use("/api/seller/dashboard", sellerDashboardRoutes);
app.use("/api/seller/products", sellerProductRoutes);
app.use("/api/seller/categories", sellerCategoryRoutes);
app.use("/api/seller/inventory", sellerInventoryRoutes);
app.use("/api/seller/orders", sellerOrderRoutes);
app.use("/api/seller/earnings", sellerEarningsRoutes);
app.use("/api/seller/reviews", sellerReviewRoutes);
app.use("/api/seller/profile", sellerProfileRoutes);
app.use("/api/seller/notifications", sellerNotificationRoutes);
app.use("/api/seller/support", sellerSupportRoutes);
app.use("/api/seller/reports", sellerReportRoutes);

// ===============================
// Customer & Rider Endpoints
// ===============================
app.use("/api/customer", customerRoutes);
app.use("/api/rider", riderRoutes);

// Friendly UI Route Shortcuts
app.get(["/seller", "/seller/dashboard"], (req, res) => {
  res.sendFile(path.join(frontendPath, "seller.html"));
});

app.get(["/seller-login", "/seller/login"], (req, res) => {
  res.sendFile(path.join(frontendPath, "seller-login.html"));
});

app.get(["/customer", "/marketplace"], (req, res) => {
  res.sendFile(path.join(frontendPath, "customer.html"));
});

app.get(["/delivery", "/rider", "/partner"], (req, res) => {
  res.sendFile(path.join(frontendPath, "delivery.html"));
});

app.get(["/admin", "/admin/login"], (req, res) => {
  res.sendFile(path.join(frontendPath, "login.html"));
});

app.get(["/index.html", "/admin.html", "/admin/dashboard"], (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Root route serves Customer Marketplace Home App
app.get(["/", "/app"], (req, res) => {
  res.sendFile(path.join(frontendPath, "customer.html"));
});

// Play Store Privacy Policy & Android App Links (TWA / App Verification)
app.get(["/privacy-policy", "/privacy"], (req, res) => {
  res.sendFile(path.join(frontendPath, "privacy-policy.html"));
});

app.get("/.well-known/assetlinks.json", (req, res) => {
  const packageName = process.env.ANDROID_PACKAGE_NAME || "com.locallink.marketplace";
  const rawFingerprints = process.env.ANDROID_SHA256_FINGERPRINT || "";
  const fingerprints = rawFingerprints
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (fingerprints.length === 0) {
    return res.status(200).json([]);
  }

  return res.status(200).json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints
      }
    }
  ]);
});

// ===============================
// 404 Handler
// ===============================

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "API route not found"
    });
  }
  return res.status(404).sendFile(path.join(frontendPath, "customer.html"));
});



// ===============================
// Global Error Handler
// ===============================

app.use(errorHandler);

module.exports = app;