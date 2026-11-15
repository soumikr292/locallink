const { pool } = require("../config/database");

/**
 * Admin Notifications Hub Service
 */

async function getNotifications({ page = 1, limit = 50, audience = "", channel = "", search = "" } = {}) {
  let connection;
  try {
    connection = await pool.getConnection();

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push("(title LIKE ? OR message LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    if (audience && audience !== "all") {
      conditions.push("target_audience = ?");
      params.push(audience);
    }

    if (channel && channel !== "all") {
      conditions.push("channel = ?");
      params.push(channel);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const rows = await connection.query(
      `SELECT
         id,
         title,
         message,
         target_audience,
         channel,
         type,
         status,
         recipients_count,
         created_by,
         created_at
       FROM platform_notifications
       ${whereClause}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await connection.query(
      `SELECT COUNT(*) AS total FROM platform_notifications ${whereClause}`,
      params
    );

    // Compute stats
    const [statsResult] = await connection.query(
      `SELECT
         COUNT(id) AS total_sent,
         COALESCE(SUM(recipients_count), 0) AS total_reached,
         SUM(CASE WHEN channel = 'sms' THEN 1 ELSE 0 END) AS sms_count,
         SUM(CASE WHEN channel = 'email' THEN 1 ELSE 0 END) AS email_count,
         SUM(CASE WHEN channel = 'in_app' THEN 1 ELSE 0 END) AS in_app_count,
         SUM(CASE WHEN channel = 'push' THEN 1 ELSE 0 END) AS push_count
       FROM platform_notifications`
    );

    return {
      notifications: rows.map(r => ({
        id: Number(r.id),
        title: r.title,
        message: r.message,
        targetAudience: r.target_audience,
        channel: r.channel,
        type: r.type,
        status: r.status,
        recipientsCount: Number(r.recipients_count),
        createdBy: r.created_by,
        createdAt: r.created_at
      })),
      total: Number(countResult.total),
      stats: {
        totalSent: Number(statsResult.total_sent || 0),
        totalReached: Number(statsResult.total_reached || 0),
        smsCount: Number(statsResult.sms_count || 0),
        emailCount: Number(statsResult.email_count || 0),
        inAppCount: Number(statsResult.in_app_count || 0),
        pushCount: Number(statsResult.push_count || 0)
      }
    };
  } finally {
    if (connection) connection.release();
  }
}

async function createBroadcast(data) {
  let connection;
  try {
    connection = await pool.getConnection();

    const target = data.targetAudience || "all";
    const channel = data.channel || "in_app";
    const type = data.type || "broadcast";
    const title = (data.title || "").trim();
    const message = (data.message || "").trim();
    const createdBy = (data.createdBy || "Admin Operations").trim();

    // Determine target recipient count dynamically
    let audienceQuery = "SELECT user_id FROM users WHERE status = 'active'";
    if (target === "sellers") audienceQuery += " AND role = 'seller'";
    else if (target === "riders") audienceQuery += " AND role = 'rider'";
    else if (target === "customers") audienceQuery += " AND role = 'customer'";
    else if (target === "staff") audienceQuery += " AND role IN ('admin', 'staff', 'super_admin')";

    const audienceRows = await connection.query(audienceQuery);
    const recipientCount = audienceRows.length || 1;

    const result = await connection.query(
      `INSERT INTO platform_notifications (
         title, message, target_audience, channel, type, status, recipients_count, created_by
       ) VALUES (?, ?, ?, ?, ?, 'sent', ?, ?)`,
      [title, message, target, channel, type, recipientCount, createdBy]
    );

    // If target includes sellers, also dispatch to seller_notifications so merchants see it in their portal
    if (target === "all" || target === "sellers") {
      const sellers = await connection.query(
        "SELECT user_id FROM users WHERE role = 'seller' AND status = 'active'"
      );
      for (const s of sellers) {
        try {
          await connection.query(
            `INSERT INTO seller_notifications (seller_id, title, message, type)
             VALUES (?, ?, ?, 'system')`,
            [s.user_id, title, message]
          );
        } catch (_) {}
      }
    }

    return {
      id: Number(result.insertId),
      recipientsCount: recipientCount,
      message: `Broadcast successfully sent to ${recipientCount} active recipient(s)`
    };
  } finally {
    if (connection) connection.release();
  }
}

async function deleteNotification(id) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query("DELETE FROM platform_notifications WHERE id = ?", [Number(id)]);
    return { message: "Notification deleted successfully" };
  } finally {
    if (connection) connection.release();
  }
}

function getNotificationTemplates() {
  return [
    {
      id: "tpl_order_placed",
      name: "Order Confirmation (Customer)",
      channel: "SMS / WhatsApp",
      trigger: "Instant on payment capture",
      body: "Hello {{customer_name}}, your order {{order_number}} for ₹{{amount}} has been placed with {{stall_name}}. OTP for delivery: {{delivery_otp}}.",
      status: "Active"
    },
    {
      id: "tpl_seller_new_order",
      name: "New Order Incoming (Merchant)",
      channel: "Push / In-App",
      trigger: "New order awaiting vendor acceptance",
      body: "Stall Alert: New customer order #{{order_number}} ({{item_count}} items) received. Please confirm stock and start packing.",
      status: "Active"
    },
    {
      id: "tpl_rider_assigned",
      name: "Rider Out For Delivery",
      channel: "SMS / Push",
      trigger: "Rider accepts and collects packet",
      body: "Delivery Partner {{rider_name}} (+91 {{rider_phone}}) has picked up your fresh items from {{stall_name}} and is on the way (ETA: {{eta}} mins).",
      status: "Active"
    },
    {
      id: "tpl_weekly_payout",
      name: "Weekly Merchant Settlement (Finance)",
      channel: "Email / In-App",
      trigger: "Monday automated batch payout",
      body: "Your weekly net disbursement of ₹{{payout_amount}} for {{order_count}} fulfilled orders has been initiated via UPI to {{upi_vpa}} (UTR: {{utr_number}}).",
      status: "Active"
    },
    {
      id: "tpl_low_stock",
      name: "Daily Inventory Alert",
      channel: "In-App / Email",
      trigger: "Stock falls below threshold (< 5 units)",
      body: "Inventory Warning: Product '{{product_name}}' has only {{stock_quantity}} units remaining in stock.",
      status: "Active"
    }
  ];
}

module.exports = {
  getNotifications,
  createBroadcast,
  deleteNotification,
  getNotificationTemplates
};
