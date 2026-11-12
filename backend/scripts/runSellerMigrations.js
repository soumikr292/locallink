const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { pool } = require("../src/config/database");

async function run() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log("Applying Seller Migrations...");

    const sqlContent = fs.readFileSync(path.join(__dirname, "../database/seller_migrations.sql"), "utf-8");
    const statements = sqlContent
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      await conn.query(statement);
    }
    console.log("✅ Tables created or verified.");

    // Check reviews columns
    const columns = await conn.query("SHOW COLUMNS FROM reviews LIKE 'seller_reply'");
    if (columns.length === 0) {
      await conn.query(`
        ALTER TABLE reviews
        ADD COLUMN seller_reply TEXT DEFAULT NULL AFTER report_reason,
        ADD COLUMN seller_replied_at DATETIME DEFAULT NULL AFTER seller_reply
      `);
      console.log("✅ Added seller_reply columns to reviews table.");
    } else {
      console.log("ℹ️ reviews table already has seller_reply column.");
    }

    // Seed profile for existing sellers
    const sellers = await conn.query("SELECT user_id, name, email, phone FROM users WHERE role = 'seller'");
    for (const s of sellers) {
      const existing = await conn.query("SELECT profile_id FROM seller_profiles WHERE seller_id = ?", [s.user_id]);
      if (existing.length === 0) {
        await conn.query(
          `INSERT INTO seller_profiles (
            seller_id, shop_name, business_email, business_phone, shop_address, city, upi_id, verification_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'verified')`,
          [
            s.user_id,
            s.name,
            s.email,
            s.phone || "9876543210",
            "Shop 14, Main Bazaar",
            "Kolkata",
            `seller${s.user_id}@locallink`
          ]
        );
        console.log(`✅ Created seller profile for seller #${s.user_id} (${s.name}).`);
      }
    }

    console.log("🎉 All seller migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    if (conn) conn.release();
    pool.end();
  }
}

run();
