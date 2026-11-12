const { pool } = require("../config/database");

async function getDashboardStats() {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(`
      SELECT
        COUNT(*) AS totalUsers,

        SUM(CASE
          WHEN role = 'customer' THEN 1
          ELSE 0
        END) AS totalCustomers,

        SUM(CASE
          WHEN role = 'seller' THEN 1
          ELSE 0
        END) AS totalSellers,

        SUM(CASE
          WHEN role = 'delivery_partner' THEN 1
          ELSE 0
        END) AS totalDeliveryPartners,

        SUM(CASE
          WHEN role IN ('admin', 'super_admin', 'staff') THEN 1
          ELSE 0
        END) AS totalAdmins,

        SUM(CASE
          WHEN status = 'active' THEN 1
          ELSE 0
        END) AS activeUsers,

        SUM(CASE
          WHEN status = 'suspended' THEN 1
          ELSE 0
        END) AS suspendedUsers

      FROM users
    `);

    const salesRows = await connection.query(`
      SELECT
        COALESCE(SUM(total_amount), 0) AS totalSales
      FROM orders
      WHERE payment_status = 'paid'
        AND order_status NOT IN ('cancelled', 'refunded')
    `);

    const totalSales = Number(salesRows[0].totalSales);
        const orderRows = await connection.query(`
      SELECT
        COUNT(*) AS totalOrders
      FROM orders
      WHERE order_status NOT IN ('cancelled', 'refunded')
    `);

    const totalOrders = Number(orderRows[0].totalOrders);

        const deliveryRows = await connection.query(`
      SELECT
        COUNT(*) AS totalOrders,
        SUM(CASE
          WHEN order_status = 'delivered' THEN 1
          ELSE 0
        END) AS deliveredOrders
      FROM orders
      WHERE order_status NOT IN ('cancelled', 'refunded')
    `);

    const deliveryStats = deliveryRows[0];
    const deliverySuccessRate =
      Number(deliveryStats.totalOrders) > 0
        ? Math.round(
            (Number(deliveryStats.deliveredOrders) /
              Number(deliveryStats.totalOrders)) * 100
          )
        : 0;

    const stats = rows[0];

    return {
      totalUsers: Number(stats.totalUsers),
      totalCustomers: Number(stats.totalCustomers),
      totalSales: totalSales,
      totalOrders: totalOrders,
      deliverySuccessRate: deliverySuccessRate,
      totalSellers: Number(stats.totalSellers),
      totalDeliveryPartners: Number(stats.totalDeliveryPartners),
      totalAdmins: Number(stats.totalAdmins),
      activeUsers: Number(stats.activeUsers),
      suspendedUsers: Number(stats.suspendedUsers)
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { getDashboardStats };
