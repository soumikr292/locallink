const express = require("express");
const {
  getProfile,
  updateProfile
} = require("../controllers/sellerProfileController");
const {
  authenticateToken,
  requireSeller
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireSeller);

router.get("/", getProfile);
router.put("/", updateProfile);
router.patch("/", updateProfile);

module.exports = router;
