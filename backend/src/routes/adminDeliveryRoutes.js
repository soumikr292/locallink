const express = require("express");


const {
  listDeliveries,
  getDeliveryDetails,
  changeDeliveryStatus,
  listAvailableDeliveryPartners,
  assignDeliveryPartnerToDelivery,
  verifyDeliveryOtpController,
  listDeliveryPartners,
  changeDeliveryPartnerVerification,
   getDeliveryTrackingController
} = require("../controllers/adminDeliveryController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();



/* Rider Directory */
router.get(
  "/partners",
  authenticateToken,
  requireAdmin,
  listDeliveryPartners
);

/* Rider Verification Status */
router.patch(
  "/partners/:id/verification",
  authenticateToken,
  requireAdmin,
  changeDeliveryPartnerVerification
);

/* All Deliveries */
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  listDeliveries
);



router.patch(
  "/:id/verify-otp",
  authenticateToken,
  requireAdmin,
  verifyDeliveryOtpController
);

router.get(
  "/available-partners",
  authenticateToken,
  requireAdmin,
  listAvailableDeliveryPartners
);

router.patch(
  "/:id/assign",
  authenticateToken,
  requireAdmin,
  assignDeliveryPartnerToDelivery
);

router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  changeDeliveryStatus
);

router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  getDeliveryDetails
);

router.get(
  "/:id/tracking",
  authenticateToken,
  requireAdmin,
  getDeliveryTrackingController
);

module.exports = router;