
const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");
const { generateToken } = require("../utils/jwt");

function authError() {
  const error = new Error("Invalid email or password");
  error.statusCode = 401;
  return error;
}

async function loginAdmin(email, password) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `SELECT user_id, name, email, password_hash, role, status
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      throw authError();
    }

    const admin = rows[0];

    const allowedRoles = ["admin", "super_admin", "staff"];

    if (
      !allowedRoles.includes(admin.role) ||
      admin.status !== "active"
    ) {
      throw authError();
    }

    const passwordMatches = await bcrypt.compare(
      password,
      admin.password_hash
    );

    if (!passwordMatches) {

  throw authError();
}


    await connection.query(
      "UPDATE users SET last_login_at = NOW() WHERE user_id = ?",
      [admin.user_id]
    );

   const userId = Number(admin.user_id);

const token = generateToken({
  userId,
  role: admin.role
});

    return {
      token,
    user: {
  id: userId,
  name: admin.name,
  email: admin.email,
  role: admin.role
}
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { loginAdmin };