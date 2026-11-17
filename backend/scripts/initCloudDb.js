require("../src/config/env");

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
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

async function ensureWholesalePlatform(conn) {
  // 0. Ensure 'wholesaler' is supported in users.role enum
  try {
    await conn.query("ALTER TABLE `users` MODIFY COLUMN `role` ENUM('customer','seller','wholesaler','delivery_partner','staff','admin','super_admin') NOT NULL DEFAULT 'customer'");
    console.log("Verified users.role ENUM includes 'wholesaler'.");
  } catch (err) {
    console.warn("Could not alter users.role enum:", err.message);
  }

  // 1. Create tables if not exist
  await conn.query(`
    CREATE TABLE IF NOT EXISTS wholesale_lots (
      lot_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      wholesaler_id BIGINT UNSIGNED NOT NULL,
      commodity_name VARCHAR(255) NOT NULL,
      variety VARCHAR(150) DEFAULT NULL,
      category VARCHAR(100) DEFAULT 'Vegetables & Produce',
      grade ENUM('Grade A+', 'Grade A', 'FAQ', 'Export Standard') DEFAULT 'Grade A',
      total_stock_qtl DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      bags_count INT UNSIGNED NOT NULL DEFAULT 0,
      bag_weight_kg DECIMAL(8,2) NOT NULL DEFAULT 50.00,
      moq_bags INT UNSIGNED NOT NULL DEFAULT 5,
      tier1_qty INT UNSIGNED NOT NULL DEFAULT 5,
      tier1_rate DECIMAL(10,2) NOT NULL,
      tier2_qty INT UNSIGNED NOT NULL DEFAULT 20,
      tier2_rate DECIMAL(10,2) NOT NULL,
      tier3_qty INT UNSIGNED NOT NULL DEFAULT 50,
      tier3_rate DECIMAL(10,2) NOT NULL,
      godown_bay VARCHAR(100) DEFAULT 'Godown 1 - Bay A',
      harvest_origin VARCHAR(150) DEFAULT 'Burdwan / Hooghly',
      arrival_date DATE DEFAULT (CURRENT_DATE),
      image_url VARCHAR(500) DEFAULT NULL,
      status ENUM('active', 'low_stock', 'liquidate', 'archived') DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS wholesale_orders (
      po_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      po_number VARCHAR(50) UNIQUE NOT NULL,
      wholesaler_id BIGINT UNSIGNED NOT NULL,
      buyer_shop VARCHAR(255) NOT NULL,
      buyer_name VARCHAR(150) NOT NULL,
      buyer_phone VARCHAR(20) NOT NULL,
      buyer_gstin VARCHAR(50) DEFAULT NULL,
      items_json JSON NOT NULL,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      payment_terms VARCHAR(100) DEFAULT 'Net 15 Khata Credit',
      payment_status ENUM('pending', 'partial', 'paid') DEFAULT 'pending',
      order_status ENUM('new_rfq', 'confirmed', 'packed', 'in_transit', 'delivered', 'cancelled') DEFAULT 'new_rfq',
      dispatch_vehicle VARCHAR(100) DEFAULT NULL,
      gate_pass_no VARCHAR(100) DEFAULT NULL,
      delivery_address TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS wholesale_khata (
      khata_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      wholesaler_id BIGINT UNSIGNED NOT NULL,
      buyer_shop VARCHAR(255) NOT NULL,
      buyer_name VARCHAR(150) NOT NULL,
      buyer_phone VARCHAR(20) NOT NULL,
      buyer_gstin VARCHAR(50) DEFAULT NULL,
      credit_limit DECIMAL(12,2) NOT NULL DEFAULT 100000.00,
      outstanding_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      payment_terms VARCHAR(50) DEFAULT '15 Days',
      status ENUM('active', 'overdue', 'blocked') DEFAULT 'active',
      last_payment_date DATE DEFAULT NULL,
      last_payment_amount DECIMAL(12,2) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS wholesale_mandi_rates (
      rate_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      commodity_name VARCHAR(150) NOT NULL,
      variety VARCHAR(100) DEFAULT 'Standard',
      unit VARCHAR(50) DEFAULT 'Quintal (100 kg)',
      market_arrival_mt DECIMAL(10,2) DEFAULT 0.00,
      min_rate DECIMAL(10,2) NOT NULL,
      modal_rate DECIMAL(10,2) NOT NULL,
      max_rate DECIMAL(10,2) NOT NULL,
      our_wholesale_rate DECIMAL(10,2) NOT NULL,
      trend ENUM('up', 'down', 'stable') DEFAULT 'stable',
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  // 2. Ensure Wholesaler user exists
  const existingUser = await conn.query(
    "SELECT user_id, email, role FROM users WHERE email = ? OR phone = ?",
    ["wholesaler@locallink.com", "7319578723"]
  );

  let wholesalerId;
  const hash = await bcrypt.hash("Wholesaler@123", 10);

  if (existingUser.length === 0) {
    const insertRes = await conn.query(
      `INSERT INTO users (name, email, phone, password_hash, role, status, email_verified, city, pincode)
       VALUES (?, ?, ?, ?, 'wholesaler', 'active', 1, 'Rajpur Sonarpur', '700150')`,
      ["Sonarpur Mandi Wholesale Co.", "wholesaler@locallink.com", "7319578723", hash]
    );
    wholesalerId = Number(insertRes.insertId);
    console.log(`Created Wholesaler user with ID: ${wholesalerId}`);
  } else {
    wholesalerId = Number(existingUser[0].user_id);
    await conn.query(
      "UPDATE users SET role = 'wholesaler', status = 'active' WHERE user_id = ?",
      [wholesalerId]
    );
    console.log(`Verified Wholesaler user exists with ID: ${wholesalerId}`);
  }

  // 3. Ensure seller_profiles entry exists for wholesaler
  const existingProfile = await conn.query(
    "SELECT profile_id FROM seller_profiles WHERE seller_id = ?",
    [wholesalerId]
  );
  if (existingProfile.length === 0) {
    await conn.query(
      `INSERT INTO seller_profiles (
        seller_id, shop_name, shop_slug, shop_description, business_email, business_phone,
        shop_address, city, pincode, business_category, opening_time, closing_time,
        is_vacation_mode, bank_name, account_holder_name, account_number, ifsc_code,
        upi_id, commission_rate, verification_status, gstin, mandi_license
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 5.00, 'verified', ?, ?)`,
      [
        wholesalerId,
        "Sonarpur Mandi Wholesale Supply",
        "sonarpur-mandi-wholesale",
        "Bulk vegetable, fish & grocery supply for retail stalls and supermarkets.",
        "wholesaler@locallink.com",
        "7319578723",
        "Mandi Gate #2, Sonarpur Wholesale Yard",
        "Sonarpur",
        "700150",
        "Wholesale Mandi",
        "08:00 AM",
        "10:00 PM",
        "State Bank of India (Sonarpur Branch)",
        "Sonarpur Mandi Wholesale Supply",
        "39820194812",
        "SBIN0001824",
        "7319578723@upi",
        "19AAACL7891B1Z2",
        "APMC-WB-2024-9842"
      ]
    );
    console.log(`Created Wholesaler seller_profile for seller_id: ${wholesalerId}`);
  }

  // 4. Ensure wholesale lots exist
  const lotCount = await conn.query(
    "SELECT COUNT(*) AS cnt FROM wholesale_lots WHERE wholesaler_id = ?",
    [wholesalerId]
  );
  if (Number(lotCount[0]?.cnt || 0) === 0) {
    await conn.query(`
      INSERT INTO wholesale_lots 
      (wholesaler_id, commodity_name, variety, category, grade, total_stock_qtl, bags_count, bag_weight_kg, moq_bags, tier1_qty, tier1_rate, tier2_qty, tier2_rate, tier3_qty, tier3_rate, godown_bay, harvest_origin, image_url)
      VALUES
      (?, 'Jyoti Potato (Chandramukhi Grade)', 'Hooghly Red Soil', 'Vegetables & Roots', 'Grade A+', 250.00, 500, 50.00, 10, 10, 950.00, 50, 900.00, 100, 850.00, 'Cold Storage Unit 3 - Bay B', 'Hooghly Mandi Yard', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60'),
      (?, 'Nashik Red Onion (Gulabi)', 'Nashik Medium Export', 'Vegetables & Roots', 'Grade A', 180.00, 360, 50.00, 5, 5, 1750.00, 25, 1680.00, 50, 1600.00, 'Mandi Shed 4 - Bay 12', 'Lasalgaon Mandi, Nashik', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop&q=60'),
      (?, 'Hybrid Tomato (Himsona)', 'Polyhouse Firm Red', 'Fresh Vegetables', 'Grade A+', 90.00, 360, 25.00, 8, 8, 720.00, 30, 680.00, 60, 640.00, 'Ventilated Crate Bay C', 'Madanapalle / Kolar', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=60'),
      (?, 'Minikit Premium Basmati Rice', 'Aged Silky Long Grain', 'Grains & Cereals', 'Export Standard', 400.00, 800, 50.00, 10, 10, 2450.00, 40, 2380.00, 100, 2300.00, 'Central Grain Godown A', 'Burdwan Rice Mills', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=60'),
      (?, 'Yellow Mustard Oil (Kachi Ghani)', '15-Litre Wholesale Tin', 'Oils & Ghee', 'Grade A+', 120.00, 150, 14.00, 5, 5, 2150.00, 20, 2080.00, 50, 2000.00, 'Oil Depot Sec 2', 'Agra Expeller Mill', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=60'),
      (?, 'Malka Red Lentils (Masoor Dal)', 'Clean Polished Split', 'Pulses & Dals', 'Grade A', 150.00, 300, 50.00, 5, 5, 4100.00, 20, 3980.00, 50, 3850.00, 'Grain Godown Bay 4', 'Madhya Pradesh Mandi', 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=500&auto=format&fit=crop&q=60')
    `, [wholesalerId, wholesalerId, wholesalerId, wholesalerId, wholesalerId, wholesalerId]);
    console.log("Seeded default wholesale lots.");
  }

  // 5. Ensure wholesale orders exist
  const orderCount = await conn.query(
    "SELECT COUNT(*) AS cnt FROM wholesale_orders WHERE wholesaler_id = ?",
    [wholesalerId]
  );
  if (Number(orderCount[0]?.cnt || 0) === 0) {
    await conn.query(`
      INSERT INTO wholesale_orders 
      (po_number, wholesaler_id, buyer_shop, buyer_name, buyer_phone, buyer_gstin, items_json, total_amount, payment_terms, payment_status, order_status, dispatch_vehicle, gate_pass_no, delivery_address, notes)
      VALUES
      ('B2B-PO-7701', ?, 'Maa Tara Daily Mart', 'Bikash Ghosh', '9830112233', '19ABCPG1122D1Z4', 
       '[{"name": "Jyoti Potato (Chandramukhi Grade)", "bags": 20, "weight_kg": 1000, "rate": 920.00, "total": 18400.00}, {"name": "Nashik Red Onion (Gulabi)", "bags": 10, "weight_kg": 500, "rate": 1680.00, "total": 16800.00}]',
       35200.00, 'Net 15 Khata Credit', 'pending', 'new_rfq', 'Tata Ace (WB-02-AK-9821)', 'GP-2026-904', 'Sonarpur Station Road, Kolkata 700150', 'Requires early morning 6 AM delivery at Kirana shop.'),
      
      ('B2B-PO-7702', ?, 'Bhai Bhai Super Store', 'Rajesh Agarwala', '9831998877', '19XYZPA9988F1Z9',
       '[{"name": "Minikit Premium Basmati Rice", "bags": 15, "weight_kg": 750, "rate": 2400.00, "total": 36000.00}, {"name": "Yellow Mustard Oil (15L Tin)", "bags": 8, "weight_kg": 112, "rate": 2100.00, "total": 16800.00}]',
       52800.00, 'Advance Bank RTGS', 'paid', 'packed', 'Mahindra Bolero Maxi Truck', 'GP-2026-905', 'Garia Main Market Stall 12', 'Paid via NEFT UTR #HDFC0099881.'),

      ('B2B-PO-7703', ?, 'Rajpur Green Mart', 'Pranab Mondal', '9832776655', '19MNBVC4455E1Z1',
       '[{"name": "Hybrid Tomato (Himsona)", "bags": 12, "weight_kg": 300, "rate": 680.00, "total": 8160.00}, {"name": "Malka Red Lentils (Masoor Dal)", "bags": 5, "weight_kg": 250, "rate": 4000.00, "total": 20000.00}]',
       28160.00, 'Cash on Mandi Loading', 'pending', 'confirmed', 'Customer Pickup Tempo', 'GP-2026-906', 'Rajpur Bazaar Chowk', 'Loading slip issued for Bay 12.')
    `, [wholesalerId, wholesalerId, wholesalerId]);
    console.log("Seeded default wholesale orders.");
  }

  // 6. Ensure wholesale khata records exist
  const khataCount = await conn.query(
    "SELECT COUNT(*) AS cnt FROM wholesale_khata WHERE wholesaler_id = ?",
    [wholesalerId]
  );
  if (Number(khataCount[0]?.cnt || 0) === 0) {
    await conn.query(`
      INSERT INTO wholesale_khata
      (wholesaler_id, buyer_shop, buyer_name, buyer_phone, buyer_gstin, credit_limit, outstanding_balance, payment_terms, status, last_payment_date, last_payment_amount)
      VALUES
      (?, 'Maa Tara Daily Mart', 'Bikash Ghosh', '9830112233', '19ABCPG1122D1Z4', 100000.00, 35200.00, '15 Days', 'active', '2026-11-10', 25000.00),
      (?, 'Bhai Bhai Super Store', 'Rajesh Agarwala', '9831998877', '19XYZPA9988F1Z9', 150000.00, 18500.00, '30 Days', 'active', '2026-11-14', 45000.00),
      (?, 'Rajpur Green Mart', 'Pranab Mondal', '9832776655', '19MNBVC4455E1Z1', 80000.00, 42100.00, '7 Days', 'overdue', '2026-10-28', 15000.00),
      (?, 'Annapurna Bhandar', 'Debabrata Naskar', '9830554433', '19DEFGH7788C1Z2', 120000.00, 0.00, '15 Days', 'active', '2026-11-15', 38000.00),
      (?, 'Kamalgazi Fresh Kirana', 'Sunil Roy', '9836110099', '19POIUY6677A1Z3', 75000.00, 54200.00, '7 Days', 'overdue', '2026-11-02', 12000.00)
    `, [wholesalerId, wholesalerId, wholesalerId, wholesalerId, wholesalerId]);
    console.log("Seeded default wholesale khata records.");
  }

  // 7. Ensure mandi rates exist
  const rateCount = await conn.query("SELECT COUNT(*) AS cnt FROM wholesale_mandi_rates");
  if (Number(rateCount[0]?.cnt || 0) === 0) {
    await conn.query(`
      INSERT INTO wholesale_mandi_rates
      (commodity_name, variety, unit, market_arrival_mt, min_rate, modal_rate, max_rate, our_wholesale_rate, trend)
      VALUES
      ('Jyoti Potato', 'Hooghly Red Soil', 'Quintal (100 kg)', 125.50, 1750.00, 1850.00, 1920.00, 1800.00, 'up'),
      ('Nashik Red Onion', 'Nashik Medium', 'Quintal (100 kg)', 98.20, 3200.00, 3400.00, 3550.00, 3350.00, 'down'),
      ('Hybrid Tomato', 'Firm Himsona', 'Crate (25 kg)', 64.00, 650.00, 700.00, 750.00, 680.00, 'up'),
      ('Minikit Basmati Rice', 'Aged Long Grain', 'Bag (50 kg)', 210.00, 2350.00, 2450.00, 2550.00, 2400.00, 'stable'),
      ('Kachi Ghani Mustard Oil', '15 Litre Wholesale Tin', 'Tin (15 L)', 45.00, 2050.00, 2150.00, 2220.00, 2120.00, 'stable'),
      ('Masoor Dal (Malka)', 'Polished Grade A', 'Bag (50 kg)', 78.00, 3950.00, 4100.00, 4250.00, 4050.00, 'down')
    `);
    console.log("Seeded default live mandi rates.");
  }
}

async function initCloudDb() {
  const backendDir = path.join(__dirname, "..");
  const schemaPath = path.join(backendDir, "database", "schema.sql");
  const sellerMigrationPath = path.join(backendDir, "database", "seller_migrations.sql");
  const adminMigrationPath = path.join(backendDir, "database", "admin_enhancements_migration.sql");
  const forceSeed = process.argv.includes("--force-seed");

  let conn;
  let shouldSeedInitial = false;
  let missingDemoCatalog = false;

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

    // 2b. Ensure admin enhancement tables match canonical schema
    try {
      const taxCols = await conn.query("SHOW COLUMNS FROM `tax_rates` LIKE 'rate_id'");
      if (taxCols.length > 0) {
        await conn.query("DROP TABLE `tax_rates`");
        console.log("Realigning tax_rates table to canonical schema.");
      }
    } catch (_) {}

    try {
      const notifCols = await conn.query("SHOW COLUMNS FROM `platform_notifications` LIKE 'notification_id'");
      if (notifCols.length > 0) {
        await conn.query("DROP TABLE `platform_notifications`");
        console.log("Realigning platform_notifications table to canonical schema.");
      }
    } catch (_) {}

    if (fs.existsSync(adminMigrationPath)) {
      const adminSql = fs.readFileSync(adminMigrationPath, "utf8");
      for (const stmt of splitSqlStatements(adminSql)) {
        await conn.query(stmt);
      }
      console.log("Admin enhancement tables verified/created.");
    }

    // Seed default tax slabs if empty
    const taxCount = await conn.query("SELECT COUNT(*) AS cnt FROM tax_rates");
    if (Number(taxCount[0]?.cnt || 0) === 0) {
      await conn.query(`
        INSERT INTO tax_rates (name, rate, cgst_rate, sgst_rate, igst_rate, hsn_code, category_name, is_active)
        VALUES
          ('Fresh Produce & Marine (0% Nil)', 0.00, 0.00, 0.00, 0.00, '0302', 'Vegetables & Fish', 1),
          ('Essential Edibles (5% GST)', 5.00, 2.50, 2.50, 5.00, '1508', 'Groceries & Spices', 1),
          ('Dairy, Sweets & Bakery (12% GST)', 12.00, 6.00, 6.00, 12.00, '0405', 'Dairy & Bakery', 1),
          ('Packaged Retail & Sundries (18% GST)', 18.00, 9.00, 9.00, 18.00, '2106', 'Snacks & Packaged Food', 1),
          ('Municipal Market Sanitation Cess (1%)', 1.00, 0.50, 0.50, 1.00, '9985', 'Market Services', 1)
      `);
      console.log("Seeded default commodity GST slabs.");
    }

    // Seed default notifications if empty
    const notifCount = await conn.query("SELECT COUNT(*) AS cnt FROM platform_notifications");
    if (Number(notifCount[0]?.cnt || 0) === 0) {
      await conn.query(`
        INSERT INTO platform_notifications (title, message, target_audience, channel, type, status, recipients_count, created_by)
        VALUES
          ('Durga Puja Local Fair Schedule', 'Rajpur & Sonarpur morning stalls will operate 6:00 AM to 11:30 PM throughout the festival week.', 'all', 'in_app', 'announcement', 'sent', 125, 'Platform Operations'),
          ('Cold Chain Seafood Payouts Cleared', 'Weekly vendor sales settlements for October cycle have been credited to registered bank accounts.', 'sellers', 'sms', 'payout', 'sent', 18, 'Finance Desk'),
          ('Monsoon Rider Safety Advisory', 'Rain shields & safety kits available at Sonarpur hub. Low visibility hazard protocols active.', 'riders', 'push', 'safety', 'sent', 32, 'Dispatch Hub')
      `);
      console.log("Seeded default platform notifications.");
    }

    // 3. Ensure extended marketplace columns used by customer/seller flows exist
    await ensureColumn(conn, "users", "address", "ALTER TABLE `users` ADD COLUMN `address` TEXT DEFAULT NULL AFTER `phone`");
    await ensureColumn(conn, "users", "locality", "ALTER TABLE `users` ADD COLUMN `locality` VARCHAR(120) DEFAULT 'Rajpur Block C' AFTER `address`");
    await ensureColumn(conn, "users", "city", "ALTER TABLE `users` ADD COLUMN `city` VARCHAR(100) DEFAULT 'Kolkata' AFTER `locality`");
    await ensureColumn(conn, "users", "pincode", "ALTER TABLE `users` ADD COLUMN `pincode` VARCHAR(20) DEFAULT '700149' AFTER `city`");
    await ensureColumn(conn, "users", "avatar_url", "ALTER TABLE `users` ADD COLUMN `avatar_url` TEXT DEFAULT NULL AFTER `pincode`");

    await ensureColumn(conn, "reviews", "seller_reply", "ALTER TABLE `reviews` ADD COLUMN `seller_reply` TEXT DEFAULT NULL AFTER `report_reason`");
    await ensureColumn(conn, "reviews", "seller_replied_at", "ALTER TABLE `reviews` ADD COLUMN `seller_replied_at` DATETIME DEFAULT NULL AFTER `seller_reply`");

    // 4. Ensure Wholesale B2B platform tables, wholesaler user, and demo lots/orders exist unconditionally
    await ensureWholesalePlatform(conn);

    await conn.query("SET FOREIGN_KEY_CHECKS = 1");

    const countRows = await conn.query("SELECT COUNT(*) AS cnt FROM users");
    const userCount = Number(countRows[0]?.cnt || 0);
    shouldSeedInitial = userCount === 0;
    const demoOrderRows = await conn.query("SELECT COUNT(*) AS cnt FROM orders WHERE order_number = 'LL-8942'");
    missingDemoCatalog = Number(demoOrderRows[0]?.cnt || 0) === 0;
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
  if (shouldSeedInitial || forceSeed || missingDemoCatalog) {
    const scriptsToRun = shouldSeedInitial
      ? ["seedData.js", "runSellerMigrations.js", "seedCustomerAndRider.js"]
      : forceSeed
        ? ["runSellerMigrations.js", "seedCustomerAndRider.js"]
        : ["seedCustomerAndRider.js"];

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
