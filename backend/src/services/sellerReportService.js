const { pool } = require("../config/database");

// Get comprehensive analytics report for seller
async function getSellerAnalytics(sellerId, { startDate = "", endDate = "" } = {}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const dateConditions = [];
    const dateParams = [];

    if (startDate) {
      dateConditions.push("o.created_at >= ?");
      dateParams.push(startDate);
    }
    if (endDate) {
      dateConditions.push("o.created_at <= ?");
      dateParams.push(endDate);
    }

    const dateClause = dateConditions.length > 0 ? `AND ${dateConditions.join(" AND ")}` : "";

    // 1. Order status distribution
    const statusDistribution = await connection.query(
      `SELECT
         o.order_status,
         COUNT(DISTINCT o.order_id) AS orderCount,
         COALESCE(SUM(oi.final_price), 0) AS totalValue
       FROM orders o
       INNER JOIN order_items oi ON o.order_id = oi.order_id
       WHERE oi.seller_id = ? ${dateClause}
       GROUP BY o.order_status`,
      [Number(sellerId), ...dateParams]
    );

    // 2. Sales by day
    const dailySales = await connection.query(
      `SELECT
         DATE(o.created_at) AS date,
         COALESCE(SUM(oi.final_price), 0) AS grossRevenue,
         COUNT(DISTINCT o.order_id) AS ordersCount,
         COALESCE(SUM(oi.quantity), 0) AS itemsSold
       FROM orders o
       INNER JOIN order_items oi ON o.order_id = oi.order_id
       WHERE oi.seller_id = ?
         AND o.payment_status = 'paid'
         AND o.order_status NOT IN ('cancelled', 'refunded')
         ${dateClause}
       GROUP BY DATE(o.created_at)
       ORDER BY DATE(o.created_at) ASC`,
      [Number(sellerId), ...dateParams]
    );

    // 3. Product performance (Sales, units, revenue)
    const productPerformance = await connection.query(
      `SELECT
         p.product_id,
         p.name,
         p.sku,
         p.price,
         c.name AS category_name,
         p.stock_quantity,
         COALESCE(SUM(oi.quantity), 0) AS unitsSold,
         COALESCE(SUM(oi.final_price), 0) AS totalRevenue
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.category_id
       LEFT JOIN order_items oi ON p.product_id = oi.product_id
       LEFT JOIN orders o ON oi.order_id = o.order_id AND o.payment_status = 'paid' AND o.order_status NOT IN ('cancelled', 'refunded') ${dateClause}
       WHERE p.seller_id = ?
       GROUP BY p.product_id
       ORDER BY totalRevenue DESC`,
      [...dateParams, Number(sellerId)]
    );

    // 4. Commission & Earnings
    const profile = await connection.query(
      "SELECT commission_rate FROM seller_profiles WHERE seller_id = ? LIMIT 1",
      [Number(sellerId)]
    );
    const commissionRate = Number(profile[0]?.commission_rate || 5.0);

    let totalGrossRevenue = 0;
    let totalItemsSold = 0;
    for (const d of dailySales) {
      totalGrossRevenue += Number(d.grossRevenue);
      totalItemsSold += Number(d.itemsSold);
    }

    const platformFee = Number((totalGrossRevenue * (commissionRate / 100)).toFixed(2));
    const netEarnings = Number((totalGrossRevenue - platformFee).toFixed(2));

    return {
      dateRange: { startDate, endDate },
      summary: {
        totalGrossRevenue,
        commissionRate,
        platformFee,
        netEarnings,
        totalItemsSold,
        totalOrdersCount: dailySales.reduce((sum, d) => sum + Number(d.ordersCount), 0)
      },
      statusDistribution: statusDistribution.map((s) => ({
        status: s.order_status,
        orderCount: Number(s.orderCount),
        totalValue: Number(s.totalValue)
      })),
      dailySales: dailySales.map((d) => ({
        date: d.date,
        grossRevenue: Number(d.grossRevenue),
        ordersCount: Number(d.ordersCount),
        itemsSold: Number(d.itemsSold)
      })),
      productPerformance: productPerformance.map((p) => ({
        productId: Number(p.product_id),
        name: p.name,
        sku: p.sku,
        price: Number(p.price),
        categoryName: p.category_name,
        stockQuantity: Number(p.stock_quantity),
        unitsSold: Number(p.unitsSold),
        totalRevenue: Number(p.totalRevenue)
      }))
    };
  } finally {
    if (connection) connection.release();
  }
}

// Generate CSV export string for seller products/sales
async function generateSellerExportCSV(sellerId, type = "products") {
  let connection;

  try {
    connection = await pool.getConnection();

    if (type === "products") {
      const rows = await connection.query(
        `SELECT
           p.product_id, p.name, p.sku, p.price, p.discount_price,
           p.stock_quantity, c.name AS category, p.status, p.created_at
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.category_id
         WHERE p.seller_id = ?
         ORDER BY p.product_id DESC`,
        [Number(sellerId)]
      );

      const headers = "ID,Name,SKU,Price,DiscountPrice,StockQuantity,Category,Status,CreatedAt\n";
      const lines = rows.map(
        (r) =>
          `"${r.product_id}","${(r.name || "").replace(/"/g, '""')}","${r.sku}","${r.price}","${r.discount_price || ""}","${r.stock_quantity}","${r.category || ""}","${r.status}","${r.created_at}"`
      );
      return headers + lines.join("\n");
    } else {
      // Sales orders export
      const rows = await connection.query(
        `SELECT
           o.order_number, oi.product_name, oi.sku, oi.quantity,
           oi.unit_price, oi.final_price, o.order_status, o.payment_status, o.created_at
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.order_id
         WHERE oi.seller_id = ?
         ORDER BY o.created_at DESC`,
        [Number(sellerId)]
      );

      const headers = "OrderNumber,Product,SKU,Quantity,UnitPrice,FinalPrice,OrderStatus,PaymentStatus,Date\n";
      const lines = rows.map(
        (r) =>
          `"${r.order_number}","${(r.product_name || "").replace(/"/g, '""')}","${r.sku}","${r.quantity}","${r.unit_price}","${r.final_price}","${r.order_status}","${r.payment_status}","${r.created_at}"`
      );
      return headers + lines.join("\n");
    }
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getSellerAnalytics,
  generateSellerExportCSV
};
