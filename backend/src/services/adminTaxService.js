const { pool } = require("../config/database");

/**
 * Admin Tax Management Service
 */

// 1. Get Tax Rates
async function getTaxRates({ page = 1, limit = 50, search = "", status = "" } = {}) {
  let connection;
  try {
    connection = await pool.getConnection();

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push("(name LIKE ? OR hsn_code LIKE ? OR category_name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status === "active") {
      conditions.push("is_active = 1");
    } else if (status === "inactive") {
      conditions.push("is_active = 0");
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const rows = await connection.query(
      `SELECT
         id,
         name,
         rate,
         cgst_rate,
         sgst_rate,
         igst_rate,
         hsn_code,
         category_name,
         is_active,
         created_at,
         updated_at
       FROM tax_rates
       ${whereClause}
       ORDER BY rate ASC, id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await connection.query(
      `SELECT COUNT(*) AS total FROM tax_rates ${whereClause}`,
      params
    );

    return {
      rates: rows.map(r => ({
        id: Number(r.id),
        name: r.name,
        rate: Number(r.rate),
        cgstRate: Number(r.cgst_rate),
        sgstRate: Number(r.sgst_rate),
        igstRate: Number(r.igst_rate),
        hsnCode: r.hsn_code || "0000",
        categoryName: r.category_name || "General",
        isActive: Boolean(r.is_active),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })),
      total: Number(countResult.total)
    };
  } finally {
    if (connection) connection.release();
  }
}

// 2. Create Tax Rate
async function createTaxRate(data) {
  let connection;
  try {
    connection = await pool.getConnection();

    const rate = Number(data.rate) || 0;
    const cgst = data.cgstRate !== undefined ? Number(data.cgstRate) : rate / 2;
    const sgst = data.sgstRate !== undefined ? Number(data.sgstRate) : rate / 2;
    const igst = data.igstRate !== undefined ? Number(data.igstRate) : rate;

    const result = await connection.query(
      `INSERT INTO tax_rates (
         name, rate, cgst_rate, sgst_rate, igst_rate, hsn_code, category_name, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name.trim(),
        rate,
        cgst,
        sgst,
        igst,
        (data.hsnCode || "0000").trim(),
        (data.categoryName || "General").trim(),
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1
      ]
    );

    return { id: Number(result.insertId), message: "Tax rate created successfully" };
  } finally {
    if (connection) connection.release();
  }
}

// 3. Update Tax Rate
async function updateTaxRate(id, data) {
  let connection;
  try {
    connection = await pool.getConnection();

    const rate = Number(data.rate) || 0;
    const cgst = data.cgstRate !== undefined ? Number(data.cgstRate) : rate / 2;
    const sgst = data.sgstRate !== undefined ? Number(data.sgstRate) : rate / 2;
    const igst = data.igstRate !== undefined ? Number(data.igstRate) : rate;

    await connection.query(
      `UPDATE tax_rates SET
         name = ?,
         rate = ?,
         cgst_rate = ?,
         sgst_rate = ?,
         igst_rate = ?,
         hsn_code = ?,
         category_name = ?,
         is_active = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [
        data.name.trim(),
        rate,
        cgst,
        sgst,
        igst,
        (data.hsnCode || "0000").trim(),
        (data.categoryName || "General").trim(),
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
        Number(id)
      ]
    );

    return { message: "Tax rate updated successfully" };
  } finally {
    if (connection) connection.release();
  }
}

// 4. Toggle Status
async function toggleTaxRateStatus(id) {
  let connection;
  try {
    connection = await pool.getConnection();

    await connection.query(
      `UPDATE tax_rates SET is_active = NOT is_active, updated_at = NOW() WHERE id = ?`,
      [Number(id)]
    );

    return { message: "Tax rate status toggled" };
  } finally {
    if (connection) connection.release();
  }
}

// 5. Delete Tax Rate
async function deleteTaxRate(id) {
  let connection;
  try {
    connection = await pool.getConnection();

    await connection.query(
      `DELETE FROM tax_rates WHERE id = ?`,
      [Number(id)]
    );

    return { message: "Tax rate deleted successfully" };
  } finally {
    if (connection) connection.release();
  }
}

// 6. Tax Summary & GSTR-1 Ledger
async function getTaxSummary() {
  let connection;
  try {
    connection = await pool.getConnection();

    // Query paid/completed orders for financial ledger
    const [salesResult] = await connection.query(
      `SELECT
         COUNT(order_id) AS total_orders,
         COALESCE(SUM(total_amount), 0) AS gross_sales,
         COALESCE(SUM(delivery_charge), 0) AS delivery_charges
       FROM orders
       WHERE order_status NOT IN ('cancelled', 'refunded')`
    );

    const gross = Number(salesResult.gross_sales || 0);
    // Standard GST estimate for mixed local grocery & essentials (5% blended GST on non-exempt sales)
    const taxableTurnover = Math.round(gross * 0.9524 * 100) / 100;
    const totalTax = Math.round((gross - taxableTurnover) * 100) / 100;
    const cgst = Math.round((totalTax / 2) * 100) / 100;
    const sgst = Math.round((totalTax / 2) * 100) / 100;
    const igst = 0; // Local deliveries are intra-state West Bengal

    // Recent 10 invoices with calculated tax
    const recentOrders = await connection.query(
      `SELECT
         o.order_id,
         o.order_number,
         o.total_amount,
         o.order_status,
         o.created_at,
         COALESCE(u.name, 'Customer') AS customer_name
       FROM orders o
       LEFT JOIN users u ON o.customer_id = u.user_id
       ORDER BY o.order_id DESC
       LIMIT 10`
    );

    const recentInvoices = recentOrders.map(o => {
      const amt = Number(o.total_amount);
      const taxable = Math.round(amt * 0.9524 * 100) / 100;
      const orderTax = Math.round((amt - taxable) * 100) / 100;
      return {
        orderId: Number(o.order_id),
        orderNumber: o.order_number || `#ORD-${o.order_id}`,
        customerName: o.customer_name,
        grossAmount: amt,
        taxableAmount: taxable,
        taxRate: "5% (Standard Slab)",
        cgst: Math.round((orderTax / 2) * 100) / 100,
        sgst: Math.round((orderTax / 2) * 100) / 100,
        status: o.order_status,
        date: o.created_at
      };
    });

    return {
      grossSales: gross,
      taxableTurnover,
      totalTaxCollected: totalTax,
      cgstCollected: cgst,
      sgstCollected: sgst,
      igstCollected: igst,
      totalOrders: Number(salesResult.total_orders || 0),
      recentInvoices,
      taxZones: [
        {
          zone: "West Bengal Intra-State",
          code: "WB-19",
          type: "Intra-State (CGST + SGST)",
          applicability: "Kolkata, Rajpur Sonarpur, South 24 Parganas",
          status: "Active"
        },
        {
          zone: "Rest of India Inter-State",
          code: "IN-INTER",
          type: "Inter-State (IGST)",
          applicability: "Cross-Border Shipments",
          status: "Configured"
        }
      ]
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getTaxRates,
  createTaxRate,
  updateTaxRate,
  toggleTaxRateStatus,
  deleteTaxRate,
  getTaxSummary
};
