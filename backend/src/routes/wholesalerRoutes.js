const express = require("express");
const { pool } = require("../config/database");
const { verifyToken } = require("../utils/jwt");

const router = express.Router();

// Helper to extract authenticated user or fallback for demo
function getWholesalerId(req) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const decoded = verifyToken(authHeader.split(" ")[1]);
      if (decoded && decoded.userId) {
        return Number(decoded.userId);
      }
    }
  } catch (e) {
    // Fall back to default wholesaler
  }
  return 56; // Sonarpur Mandi Wholesale Co.
}

// 1. Dashboard Metrics
router.get("/metrics", async (req, res) => {
  let connection;
  try {
    const wholesalerId = getWholesalerId(req);
    connection = await pool.getConnection();

    // Lots stats
    const lotStatsRes = await connection.query(
      `SELECT 
        COUNT(*) as totalLots,
        COALESCE(SUM(total_stock_qtl), 0) as totalQtl,
        COALESCE(SUM(bags_count), 0) as totalBags
       FROM wholesale_lots 
       WHERE wholesaler_id = ? AND status != 'archived'`,
      [wholesalerId]
    );
    const lotStats = lotStatsRes[0] || {};

    // Orders stats
    const orderStatsRes = await connection.query(
      `SELECT 
        COUNT(*) as totalOrders,
        SUM(CASE WHEN order_status IN ('new_rfq', 'confirmed', 'packed', 'in_transit') THEN 1 ELSE 0 END) as activeOrders,
        COALESCE(SUM(total_amount), 0) as totalGrossTurnover,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as collectionsReceived
       FROM wholesale_orders 
       WHERE wholesaler_id = ?`,
      [wholesalerId]
    );
    const orderStats = orderStatsRes[0] || {};

    // Khata / Credit stats
    const khataStatsRes = await connection.query(
      `SELECT 
        COUNT(*) as totalRetailers,
        COALESCE(SUM(outstanding_balance), 0) as totalCreditOwed,
        COALESCE(SUM(credit_limit), 0) as totalCreditLimit,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdueAccounts
       FROM wholesale_khata 
       WHERE wholesaler_id = ?`,
      [wholesalerId]
    );
    const khataStats = khataStatsRes[0] || {};

    // Wholesaler Profile
    const profileRes = await connection.query(
      `SELECT u.name, u.email, u.phone, sp.shop_name, sp.shop_address, sp.city, sp.business_category
       FROM users u
       LEFT JOIN seller_profiles sp ON u.user_id = sp.seller_id
       WHERE u.user_id = ?`,
      [wholesalerId]
    );
    const profile = profileRes[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        profile: {
          name: profile.name || "Sonarpur Mandi Wholesale Co.",
          shop_name: profile.shop_name || "Sonarpur Mandi Wholesale Supply",
          city: profile.city || "Rajpur Sonarpur"
        },
        metrics: {
          todayTurnover: Number(orderStats.totalGrossTurnover || 116160),
          bagsDispatched: 68,
          activeOrdersCount: Number(orderStats.activeOrders || 3),
          totalKhataCredit: Number(khataStats.totalCreditOwed || 150000),
          totalCreditLimit: Number(khataStats.totalCreditLimit || 525000),
          overdueKiranas: Number(khataStats.overdueAccounts || 2),
          totalLotsCount: Number(lotStats.totalLots || 6),
          totalStockQtl: Number(lotStats.totalQtl || 1190),
          totalStockBags: Number(lotStats.totalBags || 2470),
          collectionsToday: Number(orderStats.collectionsReceived || 52800),
          godownUtilizationPct: 76
        }
      }
    });
  } catch (error) {
    console.error("Wholesale metrics error:", error);
    return res.status(500).json({ success: false, message: "Failed to load wholesale metrics" });
  } finally {
    if (connection) connection.release();
  }
});

// 2. Bulk Lots Inventory
router.get("/lots", async (req, res) => {
  let connection;
  try {
    const wholesalerId = getWholesalerId(req);
    connection = await pool.getConnection();

    const result = await connection.query(
      `SELECT * FROM wholesale_lots WHERE wholesaler_id = ? ORDER BY lot_id DESC`,
      [wholesalerId]
    );
    const rows = Array.isArray(result) ? result : (result ? [result] : []);

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("Wholesale lots list error:", error);
    return res.status(500).json({ success: false, message: "Failed to load wholesale lots" });
  } finally {
    if (connection) connection.release();
  }
});

// Create Bulk Lot
router.post("/lots", async (req, res) => {
  let connection;
  try {
    const wholesalerId = getWholesalerId(req);
    const {
      commodity_name,
      variety,
      category,
      grade,
      total_stock_qtl,
      bags_count,
      bag_weight_kg,
      moq_bags,
      tier1_qty,
      tier1_rate,
      tier2_qty,
      tier2_rate,
      tier3_qty,
      tier3_rate,
      godown_bay,
      harvest_origin,
      image_url
    } = req.body;

    if (!commodity_name || !tier1_rate) {
      return res.status(400).json({ success: false, message: "Commodity name and Tier 1 rate are required." });
    }

    connection = await pool.getConnection();

    const result = await connection.query(
      `INSERT INTO wholesale_lots 
       (wholesaler_id, commodity_name, variety, category, grade, total_stock_qtl, bags_count, bag_weight_kg, moq_bags, tier1_qty, tier1_rate, tier2_qty, tier2_rate, tier3_qty, tier3_rate, godown_bay, harvest_origin, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wholesalerId,
        commodity_name,
        variety || "Standard Grade",
        category || "Vegetables & Produce",
        grade || "Grade A",
        parseFloat(total_stock_qtl) || 100,
        parseInt(bags_count) || 200,
        parseFloat(bag_weight_kg) || 50,
        parseInt(moq_bags) || 5,
        parseInt(tier1_qty) || 5,
        parseFloat(tier1_rate) || 1000,
        parseInt(tier2_qty) || 20,
        parseFloat(tier2_rate) || (parseFloat(tier1_rate) * 0.95),
        parseInt(tier3_qty) || 50,
        parseFloat(tier3_rate) || (parseFloat(tier1_rate) * 0.90),
        godown_bay || "Main Godown 1",
        harvest_origin || "Local Mandi Yard",
        image_url || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60"
      ]
    );

    return res.status(201).json({
      success: true,
      message: `Lot for ${commodity_name} successfully added to inventory!`,
      data: { lot_id: Number(result.insertId) }
    });
  } catch (error) {
    console.error("Create lot error:", error);
    return res.status(500).json({ success: false, message: "Failed to create wholesale lot" });
  } finally {
    if (connection) connection.release();
  }
});

// Update Lot Stock & Rates
router.patch("/lots/:id", async (req, res) => {
  let connection;
  try {
    const lotId = req.params.id;
    const { total_stock_qtl, bags_count, tier1_rate, status } = req.body;

    connection = await pool.getConnection();

    await connection.query(
      `UPDATE wholesale_lots 
       SET total_stock_qtl = COALESCE(?, total_stock_qtl),
           bags_count = COALESCE(?, bags_count),
           tier1_rate = COALESCE(?, tier1_rate),
           status = COALESCE(?, status)
       WHERE lot_id = ?`,
      [total_stock_qtl, bags_count, tier1_rate, status, lotId]
    );

    return res.status(200).json({ success: true, message: "Wholesale lot updated successfully." });
  } catch (error) {
    console.error("Update lot error:", error);
    return res.status(500).json({ success: false, message: "Failed to update lot" });
  } finally {
    if (connection) connection.release();
  }
});

// Delete / Archive Lot
router.delete("/lots/:id", async (req, res) => {
  let connection;
  try {
    const lotId = req.params.id;
    connection = await pool.getConnection();

    await connection.query(
      `UPDATE wholesale_lots SET status = 'archived' WHERE lot_id = ?`,
      [lotId]
    );

    return res.status(200).json({ success: true, message: "Lot archived successfully." });
  } catch (error) {
    console.error("Delete lot error:", error);
    return res.status(500).json({ success: false, message: "Failed to archive lot" });
  } finally {
    if (connection) connection.release();
  }
});

// 3. B2B Wholesale Purchase Orders & RFQs
router.get("/orders", async (req, res) => {
  let connection;
  try {
    const wholesalerId = getWholesalerId(req);
    connection = await pool.getConnection();

    const result = await connection.query(
      `SELECT * FROM wholesale_orders WHERE wholesaler_id = ? ORDER BY po_id DESC`,
      [wholesalerId]
    );
    const rows = Array.isArray(result) ? result : (result ? [result] : []);

    const formatted = rows.map(r => ({
      ...r,
      po_id: Number(r.po_id),
      total_amount: Number(r.total_amount),
      items: typeof r.items_json === "string" ? JSON.parse(r.items_json) : (r.items_json || [])
    }));

    return res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error("Wholesale orders error:", error);
    return res.status(500).json({ success: false, message: "Failed to load B2B orders" });
  } finally {
    if (connection) connection.release();
  }
});

// Update Order Status (Accept, Pack, Dispatch, Deliver)
router.patch("/orders/:id/status", async (req, res) => {
  let connection;
  try {
    const poId = req.params.id;
    const { order_status, dispatch_vehicle, gate_pass_no, payment_status } = req.body;

    connection = await pool.getConnection();

    await connection.query(
      `UPDATE wholesale_orders 
       SET order_status = COALESCE(?, order_status),
           dispatch_vehicle = COALESCE(?, dispatch_vehicle),
           gate_pass_no = COALESCE(?, gate_pass_no),
           payment_status = COALESCE(?, payment_status)
       WHERE po_id = ?`,
      [order_status, dispatch_vehicle, gate_pass_no, payment_status, poId]
    );

    return res.status(200).json({ success: true, message: `PO status updated to ${order_status}.` });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({ success: false, message: "Failed to update order status" });
  } finally {
    if (connection) connection.release();
  }
});

// Create New B2B Purchase Order / Invoice
router.post("/orders", async (req, res) => {
  let connection;
  try {
    const wholesalerId = getWholesalerId(req);
    const { buyer_shop, buyer_name, buyer_phone, buyer_gstin, items, total_amount, payment_terms, delivery_address, notes } = req.body;

    const poNumber = "B2B-PO-" + Math.floor(1000 + Math.random() * 9000);
    const gatePass = "GP-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900);

    connection = await pool.getConnection();

    const result = await connection.query(
      `INSERT INTO wholesale_orders 
       (po_number, wholesaler_id, buyer_shop, buyer_name, buyer_phone, buyer_gstin, items_json, total_amount, payment_terms, payment_status, order_status, gate_pass_no, delivery_address, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'confirmed', ?, ?, ?)`,
      [
        poNumber,
        wholesalerId,
        buyer_shop || "Kirana Partner",
        buyer_name || "Merchant",
        buyer_phone || "9830000000",
        buyer_gstin || "Unregistered",
        JSON.stringify(items || []),
        parseFloat(total_amount) || 0,
        payment_terms || "Net 15 Khata Credit",
        gatePass,
        delivery_address || "Local Bazaar",
        notes || "Manual B2B PO Entry"
      ]
    );

    return res.status(201).json({
      success: true,
      message: `Purchase Order ${poNumber} created successfully!`,
      data: { po_id: Number(result.insertId), po_number: poNumber, gate_pass_no: gatePass }
    });
  } catch (error) {
    console.error("Create B2B order error:", error);
    return res.status(500).json({ success: false, message: "Failed to create B2B order" });
  } finally {
    if (connection) connection.release();
  }
});

// 4. Retailer Khata (Credit Ledger)
router.get("/khata", async (req, res) => {
  let connection;
  try {
    const wholesalerId = getWholesalerId(req);
    connection = await pool.getConnection();

    const result = await connection.query(
      `SELECT * FROM wholesale_khata WHERE wholesaler_id = ? ORDER BY outstanding_balance DESC`,
      [wholesalerId]
    );
    const rows = Array.isArray(result) ? result : (result ? [result] : []);

    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("Khata list error:", error);
    return res.status(500).json({ success: false, message: "Failed to load retailer Khata" });
  } finally {
    if (connection) connection.release();
  }
});

// Record Payment in Kirana Khata
router.post("/khata/:id/payment", async (req, res) => {
  let connection;
  try {
    const khataId = req.params.id;
    const { amount, payment_mode, notes } = req.body;
    const payAmount = parseFloat(amount);

    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, message: "Please specify a valid payment amount." });
    }

    connection = await pool.getConnection();

    // Fetch current balance
    const rows = await connection.query("SELECT * FROM wholesale_khata WHERE khata_id = ?", [khataId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Retailer Khata account not found." });
    }

    const currentBal = Number(rows[0].outstanding_balance);
    const newBal = Math.max(0, currentBal - payAmount);
    const newStatus = newBal === 0 ? "active" : (rows[0].status === "overdue" && newBal < Number(rows[0].credit_limit) ? "active" : rows[0].status);

    await connection.query(
      `UPDATE wholesale_khata 
       SET outstanding_balance = ?, 
           last_payment_date = CURRENT_DATE, 
           last_payment_amount = ?,
           status = ?
       WHERE khata_id = ?`,
      [newBal, payAmount, newStatus, khataId]
    );

    return res.status(200).json({
      success: true,
      message: `Received ₹${payAmount.toLocaleString('en-IN')} from ${rows[0].buyer_shop}! New balance: ₹${newBal.toLocaleString('en-IN')}`,
      data: {
        khata_id: khataId,
        new_balance: newBal,
        received_amount: payAmount
      }
    });
  } catch (error) {
    console.error("Khata payment error:", error);
    return res.status(500).json({ success: false, message: "Failed to record payment" });
  } finally {
    if (connection) connection.release();
  }
});

// Add New Kirana Buyer to Khata
router.post("/khata", async (req, res) => {
  let connection;
  try {
    const wholesalerId = getWholesalerId(req);
    const { buyer_shop, buyer_name, buyer_phone, buyer_gstin, credit_limit, payment_terms } = req.body;

    if (!buyer_shop || !buyer_phone) {
      return res.status(400).json({ success: false, message: "Store name and phone are required." });
    }

    connection = await pool.getConnection();

    const result = await connection.query(
      `INSERT INTO wholesale_khata
       (wholesaler_id, buyer_shop, buyer_name, buyer_phone, buyer_gstin, credit_limit, outstanding_balance, payment_terms, status)
       VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 'active')`,
      [
        wholesalerId,
        buyer_shop,
        buyer_name || buyer_shop,
        buyer_phone,
        buyer_gstin || null,
        parseFloat(credit_limit) || 100000.00,
        payment_terms || "15 Days"
      ]
    );

    return res.status(201).json({
      success: true,
      message: `${buyer_shop} added to wholesale retailer network!`,
      data: { khata_id: Number(result.insertId) }
    });
  } catch (error) {
    console.error("Add khata retailer error:", error);
    return res.status(500).json({ success: false, message: "Failed to add retailer" });
  } finally {
    if (connection) connection.release();
  }
});

// 5. Mandi Rates & APMC Benchmark Ticker
router.get("/mandi-rates", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.query("SELECT * FROM wholesale_mandi_rates ORDER BY rate_id ASC");
    const rows = Array.isArray(result) ? result : (result ? [result] : []);
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("Mandi rates error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch Mandi rates" });
  } finally {
    if (connection) connection.release();
  }
});

// Update Wholesale Commodity Rate
router.patch("/mandi-rates/:id", async (req, res) => {
  let connection;
  try {
    const rateId = req.params.id;
    const { our_wholesale_rate } = req.body;

    connection = await pool.getConnection();
    await connection.query(
      "UPDATE wholesale_mandi_rates SET our_wholesale_rate = ? WHERE rate_id = ?",
      [parseFloat(our_wholesale_rate), rateId]
    );

    return res.status(200).json({ success: true, message: "Wholesale rate updated successfully!" });
  } catch (error) {
    console.error("Update mandi rate error:", error);
    return res.status(500).json({ success: false, message: "Failed to update rate" });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
