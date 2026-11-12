const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");


// Get all users
async function getUsers({
  page = 1,
  limit = 20,
  search = "",
  role = "",
  status = ""
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    // Search by name, email or phone
    if (search) {
      conditions.push(`
        (
          name LIKE ?
          OR email LIKE ?
          OR phone LIKE ?
        )
      `);

      const searchValue = `%${search}%`;

      params.push(
        searchValue,
        searchValue,
        searchValue
      );
    }

    // Filter by role
    if (role) {
      conditions.push("role = ?");
      params.push(role);
    }

    // Filter by status
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    // Total matching users
    const countRows = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM users
      ${whereClause}
      `,
      params
    );

    const total = Number(countRows[0].total);

    // User list
    const users = await connection.query(
      `
      SELECT
        user_id,
        name,
        email,
        phone,
        role,
        status,
        email_verified,
        last_login_at,
        created_at,
        updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, Number(limit), Number(offset)]
    );

    return {
      users: users.map((user) => ({
        id: Number(user.user_id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        emailVerified: Boolean(user.email_verified),
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Get single user details
async function getUserById(userId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `
      SELECT
        user_id,
        name,
        email,
        phone,
        role,
        status,
        email_verified,
        last_login_at,
        created_at,
        updated_at
      FROM users
      WHERE user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const user = rows[0];

    return {
      id: Number(user.user_id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerified: Boolean(user.email_verified),
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Update user status
async function updateUserStatus(
  userId,
  newStatus,
  adminUserId
) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `
      SELECT
        user_id,
        name,
        role,
        status
      FROM users
      WHERE user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (rows.length === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    const targetUser = rows[0];

    // Protect Super Admin
    if (targetUser.role === "super_admin") {
      const error = new Error(
        "Super Admin status cannot be changed"
      );
      error.statusCode = 403;
      throw error;
    }

    // Prevent changing own status
    if (
      Number(targetUser.user_id) ===
      Number(adminUserId)
    ) {
      const error = new Error(
        "You cannot change your own account status"
      );
      error.statusCode = 403;
      throw error;
    }

    const allowedStatuses = [
      "active",
      "inactive",
      "suspended"
    ];

    if (!allowedStatuses.includes(newStatus)) {
      const error = new Error(
        "Invalid status. Allowed values: active, inactive, suspended"
      );
      error.statusCode = 400;
      throw error;
    }

    await connection.query(
      `
      UPDATE users
      SET
        status = ?,
        updated_at = NOW()
      WHERE user_id = ?
      `,
      [newStatus, userId]
    );

    return {
      id: Number(targetUser.user_id),
      name: targetUser.name,
      previousStatus: targetUser.status,
      newStatus
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Create new user
async function createUser({
  name,
  email,
  phone,
  password,
  role,
  status = "active"
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    // Allowed roles for Admin Panel creation
    const allowedRoles = [
      "customer",
      "seller",
      "delivery_partner",
      "staff"
    ];

    if (!allowedRoles.includes(role)) {
      const error = new Error(
        "Invalid role. Allowed roles: customer, seller, delivery_partner, staff"
      );

      error.statusCode = 400;
      throw error;
    }

    // Check email already exists
    const existingEmail = await connection.query(
      `
      SELECT user_id
      FROM users
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    if (existingEmail.length > 0) {
      const error = new Error(
        "Email is already registered"
      );

      error.statusCode = 409;
      throw error;
    }

    // Check phone already exists
    if (phone) {
      const existingPhone = await connection.query(
        `
        SELECT user_id
        FROM users
        WHERE phone = ?
        LIMIT 1
        `,
        [phone]
      );

      if (existingPhone.length > 0) {
        const error = new Error(
          "Phone number is already registered"
        );

        error.statusCode = 409;
        throw error;
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    // Create user
    const result = await connection.query(
      `
      INSERT INTO users
      (
        name,
        email,
        phone,
        password_hash,
        role,
        status,
        email_verified
      )
      VALUES (?, ?, ?, ?, ?, ?, FALSE)
      `,
      [
        name,
        email,
        phone || null,
        passwordHash,
        role,
        status
      ]
    );

    return {
      id: Number(result.insertId),
      name,
      email,
      phone: phone || null,
      role,
      status
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function updateUser({
  userId,
  name,
  email,
  phone,
  role,
  status,
  password,
  adminUserId
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    // Never allow editing the Super Admin
    if (Number(userId) === Number(adminUserId)) {
      const error = new Error("You cannot edit your own account from this API");
      error.statusCode = 403;
      throw error;
    }

    // Check target user
    const existingUser = await connection.query(
      `
      SELECT user_id, role
      FROM users
      WHERE user_id = ?
      LIMIT 1
      `,
      [userId]
    );

    if (existingUser.length === 0) {
      const error = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    // Allowed roles for normal users
    const allowedRoles = [
      "customer",
      "seller",
      "delivery_partner",
      "staff"
    ];

    if (!allowedRoles.includes(role)) {
      const error = new Error(
        "Invalid role. Allowed roles: customer, seller, delivery_partner, staff"
      );
      error.statusCode = 400;
      throw error;
    }

    // Check duplicate email
    const duplicateEmail = await connection.query(
      `
      SELECT user_id
      FROM users
      WHERE email = ?
        AND user_id != ?
      LIMIT 1
      `,
      [email, userId]
    );

    if (duplicateEmail.length > 0) {
      const error = new Error("Email is already registered");
      error.statusCode = 409;
      throw error;
    }

    // Check duplicate phone
    if (phone) {
      const duplicatePhone = await connection.query(
        `
        SELECT user_id
        FROM users
        WHERE phone = ?
          AND user_id != ?
        LIMIT 1
        `,
        [phone, userId]
      );

      if (duplicatePhone.length > 0) {
        const error = new Error("Phone number is already registered");
        error.statusCode = 409;
        throw error;
      }
    }

    // Update password only when provided
    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);

      await connection.query(
        `
        UPDATE users
        SET
          name = ?,
          email = ?,
          phone = ?,
          password_hash = ?,
          role = ?,
          status = ?,
          updated_at = NOW()
        WHERE user_id = ?
        `,
        [
          name,
          email,
          phone || null,
          passwordHash,
          role,
          status,
          userId
        ]
      );
    } else {
      await connection.query(
        `
        UPDATE users
        SET
          name = ?,
          email = ?,
          phone = ?,
          role = ?,
          status = ?,
          updated_at = NOW()
        WHERE user_id = ?
        `,
        [
          name,
          email,
          phone || null,
          role,
          status,
          userId
        ]
      );
    }

    return {
      id: Number(userId),
      name,
      email,
      phone: phone || null,
      role,
      status
    };
  } finally {
    if (connection) connection.release();
  }
}
module.exports = {
  getUsers,
  getUserById,
  updateUserStatus,
  createUser,
  updateUser
};