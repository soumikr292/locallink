const express = require("express");

const {
  listCategories,
  addCategory,
  editCategory,
  removeCategory,
  reactivateCategoryController
} = require("../controllers/adminCategoryController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();


// Get all categories
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  listCategories
);


// Create category
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  addCategory
);


// Update category
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  editCategory
);


// Deactivate category
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  removeCategory
);


router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  reactivateCategoryController
);


module.exports = router;