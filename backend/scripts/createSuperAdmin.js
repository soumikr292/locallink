
require("../src/config/env");

const readline = require("readline");
const bcrypt = require("bcryptjs");
const { pool } = require("../src/config/database");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      return resolve(ask(question));
    }

    let password = "";

    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();

    function onData(char) {
      const key = char.toString();

      if (key === "\u0003") {
        stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write("\n");
        process.exit(1);
      }

      if (key === "\r" || key === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(password);
      } else if (key === "\u007f" || key === "\b") {
        password = password.slice(0, -1);
      } else {
        password += key;
      }
    }

    stdin.on("data", onData);
  });
}

async function createSuperAdmin() {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      "SELECT COUNT(*) AS total FROM users WHERE role = 'super_admin'"
    );

    if (Number(rows[0].total) > 0) {
      console.log("A Super Admin already exists. Setup stopped.");
      return;
    }

    const name = (await ask("Enter Super Admin name: ")).trim();
    const email = (await ask("Enter Super Admin email: ")).trim().toLowerCase();
    const password = await askHidden("Create password: ");
    const confirmPassword = await askHidden("Confirm password: ");

    if (!name || !email || password.length < 12) {
      console.log("Name/email required. Password must be at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      console.log("Passwords do not match.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await connection.query(
      `INSERT INTO users
       (name, email, password_hash, role, status, email_verified)
       VALUES (?, ?, ?, 'super_admin', 'active', TRUE)`,
      [name, email, passwordHash]
    );

    console.log("✅ Super Admin created successfully!");
    console.log("Email:", email);
    console.log("Role: super_admin");
    console.log("Keep your password private.");
  } catch (error) {
    console.error("Setup failed:", error.message);
  } finally {
    if (connection) connection.release();
    rl.close();
    await pool.end();
  }
}

createSuperAdmin();