const express = require("express");
const {
  listTaxRates,
  addTaxRate,
  editTaxRate,
  toggleTaxStatus,
  removeTaxRate,
  getTaxAnalytics
} = require("../controllers/adminTaxController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get("/rates", listTaxRates);
router.post("/rates", addTaxRate);
router.put("/rates/:id", editTaxRate);
router.patch("/rates/:id/toggle", toggleTaxStatus);
router.delete("/rates/:id", removeTaxRate);
router.get("/summary", getTaxAnalytics);

module.exports = router;
