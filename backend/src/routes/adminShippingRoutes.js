
const express = require("express");
const {
  listZones,
  createZone,
  updateZone,
  changeZoneStatus,
  listMethods,
  createMethod,
  updateMethod,
  changeMethodStatus,
} = require("../controllers/adminShippingController");

const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get("/zones", listZones);
router.post("/zones", createZone);
router.put("/zones/:id", updateZone);
router.patch("/zones/:id/status", changeZoneStatus);

router.get("/methods", listMethods);
router.post("/methods", createMethod);
router.put("/methods/:id", updateMethod);
router.patch("/methods/:id/status", changeMethodStatus);

module.exports = router;
