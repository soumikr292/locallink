
const express = require("express");

const {
  listCoupons,
  addCoupon,
  listBanners,
  addBanner,
  listFlashSales,
  addFlashSale,
  listAbandonedCarts
} = require("../controllers/adminMarketingController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();

// Coupons
router.get(
  "/coupons",
  authenticateToken,
  requireAdmin,
  listCoupons
);

router.post(
  "/coupons",
  authenticateToken,
  requireAdmin,
  addCoupon
);

// Promotional banners
router.get(
  "/banners",
  authenticateToken,
  requireAdmin,
  listBanners
);

router.post(
  "/banners",
  authenticateToken,
  requireAdmin,
  addBanner
);

// Flash sales
router.get(
  "/flash-sales",
  authenticateToken,
  requireAdmin,
  listFlashSales
);

router.post(
  "/flash-sales",
  authenticateToken,
  requireAdmin,
  addFlashSale
);

// Abandoned carts
router.get(
  "/abandoned-carts",
  authenticateToken,
  requireAdmin,
  listAbandonedCarts
);

module.exports = router;
