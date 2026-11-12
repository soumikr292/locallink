const { pool } = require("../config/database");

async function getSellerDashboardStats(sellerId) {
  let connection;

  try {
    connection = await pool.getConnection();

    // 1. Product statistics
    const productStatsRows = await connection.query(
      `SELECT
         COUNT(*) AS totalProducts,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeProducts,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draftProducts,
         SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactiveProducts,
         SUM(CASE WHEN status = 'out_of_stock' THEN 1 ELSE 0 END) AS outOfStockProducts
       FROM products
       WHERE seller_id = ?`,
      [sellerId]
    );

    const productStats = productStatsRows[0] || {};

    // 2. Low-stock products count
    const lowStockRows = await connection.query(
      `SELECT COUNT(*) AS lowStockCount
       FROM inventory i
       INNER JOIN products p ON i.product_id = p.product_id
       WHERE p.seller_id = ?
         AND i.available_quantity <= i.low_stock_threshold`,
      [sellerId]
    );

    const lowStockCount = Number(lowStockRows[0]?.lowStockCount || 0);

    // 3. Order item statistics for this seller
    const orderStatsRows = await connection.query(
      `SELECT
         COUNT(DISTINCT oi.order_id) AS totalOrders,
         COUNT(DISTINCT CASE WHEN o.order_status = 'pending' THEN oi.order_id END) AS pendingOrders,
         COUNT(DISTINCT CASE WHEN o.order_status = 'confirmed' THEN oi.order_id END) AS confirmedOrders,
         COUNT(DISTINCT CASE WHEN o.order_status = 'processing' THEN oi.order_id END) AS processingOrders,
         COUNT(DISTINCT CASE WHEN o.order_status = 'ready_for_pickup' THEN oi.order_id END) AS readyForPickupOrders,
         COUNT(DISTINCT CASE WHEN o.order_status = 'out_for_delivery' THEN oi.order_id END) AS outForDeliveryOrders,
         COUNT(DISTINCT CASE WHEN o.order_status = 'delivered' THEN oi.order_id END) AS deliveredOrders,
         COUNT(DISTINCT CASE WHEN o.order_status IN ('cancelled', 'returned', 'refunded') THEN oi.order_id END) AS cancelledReturnedOrders,
         COALESCE(SUM(CASE WHEN o.payment_status = 'paid' AND o.order_status NOT IN ('cancelled', 'refunded') THEN oi.final_price ELSE 0 END), 0) AS totalPaidSales,
         COALESCE(SUM(CASE WHEN o.payment_status = 'pending' AND o.order_status NOT IN ('cancelled', 'refunded') THEN oi.final_price ELSE 0 END), 0) AS pendingPaymentSales,
         COALESCE(SUM(CASE WHEN DATE(o.created_at) = CURDATE() AND o.payment_status = 'paid' AND o.order_status NOT IN ('cancelled', 'refunded') THEN oi.final_price ELSE 0 END), 0) AS todaySales
       FROM order_items oi
       INNER JOIN orders o ON oi.order_id = o.order_id
       WHERE oi.seller_id = ?`,
      [sellerId]
    );

    const orderStats = orderStatsRows[0] || {};
    const totalPaidSales = Number(orderStats.totalPaidSales || 0);
    const pendingPaymentSales = Number(orderStats.pendingPaymentSales || 0);
    const todaySales = Number(orderStats.todaySales || 0);

    // 4. Get Seller Commission rate and profile
    const profileRows = await connection.query(
      `SELECT commission_rate, verification_status, shop_name, is_vacation_mode
       FROM seller_profiles
       WHERE seller_id = ?
       LIMIT 1`,
      [sellerId]
    );

    const commissionRate = Number(profileRows[0]?.commission_rate || 5.0);
    const platformCommission = Number((totalPaidSales * (commissionRate / 100)).toFixed(2));
    const netSellerEarnings = Number((totalPaidSales - platformCommission).toFixed(2));

    // 5. Payouts calculation
    const payoutRows = await connection.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS completedPayouts,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pendingPayouts
       FROM seller_payouts
       WHERE seller_id = ?`,
      [sellerId]
    );

    const completedPayouts = Number(payoutRows[0]?.completedPayouts || 0);
    const pendingPayouts = Number(payoutRows[0]?.pendingPayouts || 0);
    const availableBalance = Number(Math.max(0, netSellerEarnings - completedPayouts - pendingPayouts).toFixed(2));

    // 6. Review stats
    const reviewStatsRows = await connection.query(
      `SELECT
         COUNT(r.review_id) AS totalReviews,
         COALESCE(AVG(r.rating), 0) AS averageRating
       FROM reviews r
       INNER JOIN products p ON r.product_id = p.product_id
       WHERE p.seller_id = ?
         AND r.review_status = 'approved'`,
      [sellerId]
    );

    const totalReviews = Number(reviewStatsRows[0]?.totalReviews || 0);
    const averageRating = Number(Number(reviewStatsRows[0]?.averageRating || 0).toFixed(1));

    // 7. Recent 5 orders for this seller
    const recentOrders = await connection.query(
      `SELECT
         o.order_id,
         o.order_number,
         o.order_status,
         o.payment_status,
         o.created_at,
         COALESCE(SUM(oi.final_price), 0) AS sellerSubtotal,
         COUNT(oi.order_item_id) AS itemCount,
         u.name AS customerName
       FROM order_items oi
       INNER JOIN orders o ON oi.order_id = o.order_id
       INNER JOIN users u ON o.customer_id = u.user_id
       WHERE oi.seller_id = ?
       GROUP BY o.order_id
       ORDER BY o.created_at DESC
       LIMIT 5`,
      [sellerId]
    );

    // 8. Top 5 selling products
    const topProducts = await connection.query(
      `SELECT
         p.product_id,
         p.name,
         p.sku,
         p.price,
         p.image_url,
         COALESCE(SUM(oi.quantity), 0) AS totalSold,
         COALESCE(SUM(oi.final_price), 0) AS totalRevenue
       FROM products p
       LEFT JOIN order_items oi ON p.product_id = oi.product_id
       WHERE p.seller_id = ?
       GROUP BY p.product_id
       ORDER BY totalSold DESC, p.created_at DESC
       LIMIT 5`,
      [sellerId]
    );

    // 9. Last 7 days sales trend
    const salesTrend = await connection.query(
      `SELECT
         DATE(o.created_at) AS date,
         COALESCE(SUM(oi.final_price), 0) AS dailyTotal,
         COUNT(DISTINCT o.order_id) AS dailyOrders
       FROM order_items oi
       INNER JOIN orders o ON oi.order_id = o.order_id
       WHERE oi.seller_id = ?
         AND o.payment_status = 'paid'
         AND o.order_status NOT IN ('cancelled', 'refunded')
         AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(o.created_at)
       ORDER BY DATE(o.created_at) ASC`,
      [sellerId]
    );

    return {
      products: {
        total: Number(productStats.totalProducts || 0),
        active: Number(productStats.activeProducts || 0),
        draft: Number(productStats.draftProducts || 0),
        inactive: Number(productStats.inactiveProducts || 0),
        outOfStock: Number(productStats.outOfStockProducts || 0),
        lowStock: lowStockCount
      },
      orders: {
        total: Number(orderStats.totalOrders || 0),
        pending: Number(orderStats.pendingOrders || 0),
        confirmed: Number(orderStats.confirmedOrders || 0),
        processing: Number(orderStats.processingOrders || 0),
        readyForPickup: Number(orderStats.readyForPickupOrders || 0),
        outForDelivery: Number(orderStats.outForDeliveryOrders || 0),
        delivered: Number(orderStats.deliveredOrders || 0),
        cancelledReturned: Number(orderStats.cancelledReturnedOrders || 0)
      },
      financials: {
        grossSales: totalPaidSales,
        todaySales,
        pendingPayments: pendingPaymentSales,
        commissionRate,
        platformCommission,
        netSellerEarnings,
        completedPayouts,
        pendingPayouts,
        availableBalance
      },
      reviews: {
        total: totalReviews,
        averageRating
      },
      recentOrders: recentOrders.map((o) => ({
        orderId: Number(o.order_id),
        orderNumber: o.order_number,
        orderStatus: o.order_status,
        paymentStatus: o.payment_status,
        createdAt: o.created_at,
        customerName: o.customerName,
        itemCount: Number(o.itemCount),
        sellerSubtotal: Number(o.sellerSubtotal)
      })),
      topProducts: topProducts.map((p) => ({
        productId: Number(p.product_id),
        name: p.name,
        sku: p.sku,
        price: Number(p.price),
        imageUrl: p.image_url,
        totalSold: Number(p.totalSold),
        totalRevenue: Number(p.totalRevenue)
      })),
      salesTrend: salesTrend.map((t) => ({
        date: t.date,
        dailyTotal: Number(t.dailyTotal),
        dailyOrders: Number(t.dailyOrders)
      }))
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { getSellerDashboardStats };
