const { pool } = require("../config/database");

// Get notifications for a seller
async function getSellerNotifications(sellerId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `SELECT notification_id, seller_id, title, message, type, is_read, created_at
       FROM seller_notifications
       WHERE seller_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [Number(sellerId)]
    );

    const unreadCount = rows.filter((r) => !r.is_read).length;

    return {
      notifications: rows.map((r) => ({
        id: Number(r.notification_id),
        title: r.title,
        message: r.message,
        type: r.type,
        isRead: Boolean(r.is_read),
        createdAt: r.created_at
      })),
      unreadCount
    };
  } finally {
    if (connection) connection.release();
  }
}

// Mark single notification as read
async function markNotificationAsRead(sellerId, notificationId) {
  let connection;

  try {
    connection = await pool.getConnection();

    await connection.query(
      "UPDATE seller_notifications SET is_read = 1 WHERE notification_id = ? AND seller_id = ?",
      [Number(notificationId), Number(sellerId)]
    );

    return { message: "Notification marked as read" };
  } finally {
    if (connection) connection.release();
  }
}

// Mark all notifications as read
async function markAllNotificationsAsRead(sellerId) {
  let connection;

  try {
    connection = await pool.getConnection();

    await connection.query(
      "UPDATE seller_notifications SET is_read = 1 WHERE seller_id = ?",
      [Number(sellerId)]
    );

    return { message: "All notifications marked as read" };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getSellerNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
};
