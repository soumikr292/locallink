require("../src/config/env");

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { pool } = require("../src/config/database");

function splitSqlStatements(sqlText) {
  // Remove -- line comments and split top-level statements safely
  const cleaned = sqlText
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inBacktick = false;
  let escaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\" && inSingleQuote) {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === "'" && !inBacktick) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }
    if (ch === "`" && !inSingleQuote) {
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }
    if (ch === ";" && !inSingleQuote && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }
    current += ch;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function ensureColumn(conn, tableName, columnName, alterSql) {
  const cols = await conn.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  if (cols.length === 0) {
    await conn.query(alterSql);
    console.log(`Added column ${tableName}.${columnName}`);
  }
}

async function initCloudDb() {
  const backendDir = path.join(__dirname, "..");
  const schemaPath = path.join(backendDir, "database", "schema.sql");
  const sellerMigrationPath = path.join(backendDir, "database", "seller_migrations.sql");
  const forceSeed = process.argv.includes("--force-seed");

  let conn;
  let shouldSeedInitial = false;

  try {
    conn = await pool.getConnection();
    console.log("Connected to database for Cloud DB initialization...");

    await conn.query("SET FOREIGN_KEY_CHECKS = 0");

    // 1. Apply core schema idempotently
    const schemaSql = fs
      .readFileSync(schemaPath, "utf8")
      .replace(/CREATE TABLE\s+(?!IF NOT EXISTS)/gi, "CREATE TABLE IF NOT EXISTS ");

    for (const stmt of splitSqlStatements(schemaSql)) {
      await conn.query(stmt);
    }
    console.log("Core schema tables verified/created.");

    // 2. Apply seller module schema idempotently
    if (fs.existsSync(sellerMigrationPath)) {
      const sellerSql = fs.readFileSync(sellerMigrationPath, "utf8");
      for (const stmt of splitSqlStatements(sellerSql)) {
        await conn.query(stmt);
      }
      console.log("Seller migration tables verified/created.");
    }

    // 3. Ensure extended marketplace columns used by customer/seller flows exist
    await ensureColumn(conn, "users", "address", "ALTER TABLE `users` ADD COLUMN `address` TEXT DEFAULT NULL AFTER `phone`");
    await ensureColumn(conn, "users", "locality", "ALTER TABLE `users` ADD COLUMN `locality` VARCHAR(120) DEFAULT 'Rajpur Block C' AFTER `address`");
    await ensureColumn(conn, "users", "city", "ALTER TABLE `users` ADD COLUMN `city` VARCHAR(100) DEFAULT 'Kolkata' AFTER `locality`");
    await ensureColumn(conn, "users", "pincode", "ALTER TABLE `users` ADD COLUMN `pincode` VARCHAR(20) DEFAULT '700149' AFTER `city`");
    await ensureColumn(conn, "users", "avatar_url", "ALTER TABLE `users` ADD COLUMN `avatar_url` TEXT DEFAULT NULL AFTER `pincode`");

    await ensureColumn(conn, "reviews", "seller_reply", "ALTER TABLE `reviews` ADD COLUMN `seller_reply` TEXT DEFAULT NULL AFTER `report_reason`");
    await ensureColumn(conn, "reviews", "seller_replied_at", "ALTER TABLE `reviews` ADD COLUMN `seller_replied_at` DATETIME DEFAULT NULL AFTER `seller_reply`");

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    const countRows = await conn.query("SELECT COUNT(*) AS cnt FROM users");
    const userCount = Number(countRows[0]?.cnt || 0);
    shouldSeedInitial = userCount === 0;
    console.log(`Existing user count in database: ${userCount}`);
  } catch (err) {
    console.error("Cloud DB initialization failed:", err);
    process.exitCode = 1;
    return;
  } finally {
    if (conn) conn.release();
    await pool.end();
  }

  // Run seeders in fresh child processes so each manages its own pool lifecycle cleanly
  if (shouldSeedInitial || forceSeed) {
    const scriptsToRun = shouldSeedInitial
      ? ["seedData.js", "runSellerMigrations.js", "seedCustomerAndRider.js"]
      : ["runSellerMigrations.js", "seedCustomerAndRider.js"];

    for (const scriptName of scriptsToRun) {
      const scriptPath = path.join(__dirname, scriptName);
      if (!fs.existsSync(scriptPath)) continue;
      console.log(`Running ${scriptName}...`);
      execFileSync(process.execPath, [scriptPath], {
        cwd: backendDir,
        stdio: "inherit",
        env: process.env
      });
    }
    console.log("Initial marketplace data seeded successfully.");
  } else {
    console.log("Database already contains users; skipped destructive seeding.");
  }
}

initCloudDb();
