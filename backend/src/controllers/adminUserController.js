const {
  getUsers,
  getUserById,
  updateUserStatus,
  createUser,
  updateUser
} = require("../services/adminUserService");


// Get all users
async function listUsers(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const role =
      typeof req.query.role === "string"
        ? req.query.role.trim()
        : "";

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : "";

    const result = await getUsers({
      page,
      limit,
      search,
      role,
      status
    });

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Get single user
async function getUserDetails(req, res, next) {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await getUserById(userId);

    return res.status(200).json({
      success: true,
      message: "User details fetched successfully",
      data: user
    });
  } catch (error) {
    next(error);
  }
}


// Change user status
async function changeUserStatus(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const allowedStatuses = [
      "active",
      "inactive",
      "suspended",
      "pending"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Allowed: active, inactive, suspended, pending"
      });
    }

    const result = await updateUserStatus(
      userId,
      status,
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Create new user
async function addUser(req, res, next) {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      status = "active"
    } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    if (
      typeof email !== "string" ||
      !email.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 12
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 12 characters"
      });
    }

    if (
      typeof role !== "string" ||
      !role.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Role is required"
      });
    }

    const result = await createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone:
        typeof phone === "string" && phone.trim()
          ? phone.trim()
          : null,
      password,
      role: role.trim(),
      status:
        typeof status === "string"
          ? status.trim()
          : "active"
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Update existing user
async function editUser(req, res, next) {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const {
      name,
      email,
      phone,
      password,
      role,
      status
    } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    if (
      typeof email !== "string" ||
      !email.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    if (
      typeof role !== "string" ||
      !role.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Role is required"
      });
    }

    if (
      typeof status !== "string" ||
      !status.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    if (
      password !== undefined &&
      password !== null &&
      password !== "" &&
      (typeof password !== "string" ||
        password.length < 12)
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 12 characters"
      });
    }

    const result = await updateUser({
      userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone:
        typeof phone === "string" && phone.trim()
          ? phone.trim()
          : null,
      password:
        typeof password === "string" &&
        password.length > 0
          ? password
          : null,
      role: role.trim(),
      status: status.trim(),
      adminUserId: req.user.userId
    });

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Soft delete user
async function deleteUser(req, res, next) {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const result = await updateUserStatus(
      userId,
      "inactive",
      req.user.userId
    );

    return res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  listUsers,
  getUserDetails,
  changeUserStatus,
  addUser,
  editUser,
  deleteUser
};