const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function initWholesaleDB() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "janina",
    database: process.env.DB_NAME || "locallink"
  });

  const connection = await pool.getConnection();
  console.log("Connected to MySQL for wholesale setup...");

  await connection.query(`
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

  await connection.query(`
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

  await connection.query(`
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

  await connection.query(`
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

  console.log("Wholesale tables verified/created successfully.");

  // Check if seed data exists
  const [lots] = await connection.query("SELECT COUNT(*) as cnt FROM wholesale_lots WHERE wholesaler_id = 56");
  if (lots[0].cnt === 0) {
    console.log("Seeding initial wholesale lots for Sonarpur Mandi Wholesale Co. (user_id 56)...");
    await connection.query(`
      INSERT INTO wholesale_lots 
      (wholesaler_id, commodity_name, variety, category, grade, total_stock_qtl, bags_count, bag_weight_kg, moq_bags, tier1_qty, tier1_rate, tier2_qty, tier2_rate, tier3_qty, tier3_rate, godown_bay, harvest_origin, image_url)
      VALUES
      (56, 'Jyoti Potato (Chandramukhi Grade)', 'Hooghly Red Soil', 'Vegetables & Roots', 'Grade A+', 250.00, 500, 50.00, 10, 10, 950.00, 50, 900.00, 100, 850.00, 'Cold Storage Unit 3 - Bay B', 'Hooghly Mandi Yard', 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=60'),
      (56, 'Nashik Red Onion (Gulabi)', 'Nashik Medium Export', 'Vegetables & Roots', 'Grade A', 180.00, 360, 50.00, 5, 5, 1750.00, 25, 1680.00, 50, 1600.00, 'Mandi Shed 4 - Bay 12', 'Lasalgaon Mandi, Nashik', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop&q=60'),
      (56, 'Hybrid Tomato (Himsona)', 'Polyhouse Firm Red', 'Fresh Vegetables', 'Grade A+', 90.00, 360, 25.00, 8, 8, 720.00, 30, 680.00, 60, 640.00, 'Ventilated Crate Bay C', 'Madanapalle / Kolar', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=60'),
      (56, 'Minikit Premium Basmati Rice', 'Aged Silky Long Grain', 'Grains & Cereals', 'Export Standard', 400.00, 800, 50.00, 10, 10, 2450.00, 40, 2380.00, 100, 2300.00, 'Central Grain Godown A', 'Burdwan Rice Mills', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=60'),
      (56, 'Yellow Mustard Oil (Kachi Ghani)', '15-Litre Wholesale Tin', 'Oils & Ghee', 'Grade A+', 120.00, 150, 14.00, 5, 5, 2150.00, 20, 2080.00, 50, 2000.00, 'Oil Depot Sec 2', 'Agra Expeller Mill', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=60'),
      (56, 'Malka Red Lentils (Masoor Dal)', 'Clean Polished Split', 'Pulses & Dals', 'Grade A', 150.00, 300, 50.00, 5, 5, 4100.00, 20, 3980.00, 50, 3850.00, 'Grain Godown Bay 4', 'Madhya Pradesh Mandi', 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=500&auto=format&fit=crop&q=60')
    `);
    console.log("Seeded 6 wholesale lots.");
  }

  const [orders] = await connection.query("SELECT COUNT(*) as cnt FROM wholesale_orders WHERE wholesaler_id = 56");
  if (orders[0].cnt === 0) {
    console.log("Seeding wholesale orders / RFQs...");
    await connection.query(`
      INSERT INTO wholesale_orders 
      (po_number, wholesaler_id, buyer_shop, buyer_name, buyer_phone, buyer_gstin, items_json, total_amount, payment_terms, payment_status, order_status, dispatch_vehicle, gate_pass_no, delivery_address, notes)
      VALUES
      ('B2B-PO-7701', 56, 'Maa Tara Daily Mart', 'Bikash Ghosh', '9830112233', '19ABCPG1122D1Z4', 
       '[{"name": "Jyoti Potato (Chandramukhi Grade)", "bags": 20, "weight_kg": 1000, "rate": 920.00, "total": 18400.00}, {"name": "Nashik Red Onion (Gulabi)", "bags": 10, "weight_kg": 500, "rate": 1680.00, "total": 16800.00}]',
       35200.00, 'Net 15 Khata Credit', 'pending', 'new_rfq', 'Tata Ace (WB-02-AK-9821)', 'GP-2026-904', 'Sonarpur Station Road, Kolkata 700150', 'Requires early morning 6 AM delivery at Kirana shop.'),
      
      ('B2B-PO-7702', 56, 'Bhai Bhai Super Store', 'Rajesh Agarwala', '9831998877', '19XYZPA9988F1Z9',
       '[{"name": "Minikit Premium Basmati Rice", "bags": 15, "weight_kg": 750, "rate": 2400.00, "total": 36000.00}, {"name": "Yellow Mustard Oil (15L Tin)", "bags": 8, "weight_kg": 112, "rate": 2100.00, "total": 16800.00}]',
       52800.00, 'Advance Bank RTGS', 'paid', 'packed', 'Mahindra Bolero Maxi Truck', 'GP-2026-905', 'Garia Main Market Stall 12', 'Paid via NEFT UTR #HDFC0099881.'),

      ('B2B-PO-7703', 56, 'Rajpur Green Mart', 'Pranab Mondal', '9832776655', '19MNBVC4455E1Z1',
       '[{"name": "Hybrid Tomato (Himsona)", "bags": 12, "weight_kg": 300, "rate": 680.00, "total": 8160.00}, {"name": "Malka Red Lentils (Masoor Dal)", "bags": 5, "weight_kg": 250, "rate": 4000.00, "total": 20000.00}]',
       28160.00, 'Cash on Mandi Loading', 'pending', 'confirmed', 'Customer Pickup Tempo', 'GP-2026-906', 'Rajpur Bazaar Chowk', 'Loading slip issued for Bay 12.')
    `);
    console.log("Seeded wholesale orders.");
  }

  const [khata] = await connection.query("SELECT COUNT(*) as cnt FROM wholesale_khata WHERE wholesaler_id = 56");
  if (khata[0].cnt === 0) {
    console.log("Seeding wholesale khata directory...");
    await connection.query(`
      INSERT INTO wholesale_khata
      (wholesaler_id, buyer_shop, buyer_name, buyer_phone, buyer_gstin, credit_limit, outstanding_balance, payment_terms, status, last_payment_date, last_payment_amount)
      VALUES
      (56, 'Maa Tara Daily Mart', 'Bikash Ghosh', '9830112233', '19ABCPG1122D1Z4', 100000.00, 35200.00, '15 Days', 'active', '2026-11-10', 25000.00),
      (56, 'Bhai Bhai Super Store', 'Rajesh Agarwala', '9831998877', '19XYZPA9988F1Z9', 150000.00, 18500.00, '30 Days', 'active', '2026-11-14', 45000.00),
      (56, 'Rajpur Green Mart', 'Pranab Mondal', '9832776655', '19MNBVC4455E1Z1', 80000.00, 42100.00, '7 Days', 'overdue', '2026-10-28', 15000.00),
      (56, 'Annapurna Bhandar', 'Debabrata Naskar', '9830554433', '19DEFGH7788C1Z2', 120000.00, 0.00, '15 Days', 'active', '2026-11-15', 38000.00),
      (56, 'Kamalgazi Fresh Kirana', 'Sunil Roy', '9836110099', '19POIUY6677A1Z3', 75000.00, 54200.00, '7 Days', 'overdue', '2026-11-02', 12000.00)
    `);
    console.log("Seeded wholesale khata records.");
  }

  const [rates] = await connection.query("SELECT COUNT(*) as cnt FROM wholesale_mandi_rates");
  if (rates[0].cnt === 0) {
    console.log("Seeding live mandi benchmark rates...");
    await connection.query(`
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
    console.log("Seeded live mandi rates.");
  }

  connection.release();
  await pool.end();
  console.log("Wholesale DB setup complete successfully!");
}

initWholesaleDB().catch(err => {
  console.error("Setup error:", err);
  process.exit(1);
});
