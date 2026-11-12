const express = require("express");

const {
  listUsers,
  getUserDetails,
  changeUserStatus,
  addUser,
  editUser,
  deleteUser
} = require("../controllers/adminUserController");

const {
  authenticateToken,
  requireAdmin
} = require("../middleware/authMiddleware");

const router = express.Router();


// Get all users
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  listUsers
);


// Create new user
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  addUser
);


// Get single user details
router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  getUserDetails
);


// Update user status
router.patch(
  "/:id/status",
  authenticateToken,
  requireAdmin,
  changeUserStatus
);


// Update complete user
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  editUser
);


// Soft delete / deactivate user
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  deleteUser
);


module.exports = router;