const { pool } = require("../config/database");

/**
 * Admin Support Hub Service
 */

async function getTickets({ page = 1, limit = 50, status = "", priority = "", category = "", search = "" } = {}) {
  let connection;
  try {
    connection = await pool.getConnection();

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push("(t.ticket_number LIKE ? OR t.subject LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status && status !== "all") {
      conditions.push("t.status = ?");
      params.push(status);
    }

    if (priority && priority !== "all") {
      conditions.push("t.priority = ?");
      params.push(priority);
    }

    if (category && category !== "all") {
      conditions.push("t.category = ?");
      params.push(category);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const rows = await connection.query(
      `SELECT
         t.ticket_id,
         t.seller_id,
         t.ticket_number,
         t.subject,
         t.category,
         t.priority,
         t.status,
         t.created_at,
         t.updated_at,
         u.name AS user_name,
         u.email AS user_email,
         u.phone AS user_phone,
         u.role AS user_role,
         sp.shop_name,
         COUNT(m.message_id) AS message_count
       FROM seller_support_tickets t
       LEFT JOIN users u ON t.seller_id = u.user_id
       LEFT JOIN seller_profiles sp ON t.seller_id = sp.seller_id
       LEFT JOIN seller_support_messages m ON t.ticket_id = m.ticket_id
       ${whereClause}
       GROUP BY t.ticket_id
       ORDER BY
         CASE t.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
           ELSE 5
         END,
         t.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await connection.query(
      `SELECT COUNT(*) AS total FROM seller_support_tickets t
       LEFT JOIN users u ON t.seller_id = u.user_id
       ${whereClause}`,
      params
    );

    // Compute stats
    const [statsResult] = await connection.query(
      `SELECT
         COUNT(ticket_id) AS total_tickets,
         SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
         SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
         SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
         SUM(CASE WHEN priority = 'urgent' AND status IN ('open','in_progress') THEN 1 ELSE 0 END) AS urgent_count
       FROM seller_support_tickets`
    );

    return {
      tickets: rows.map(r => ({
        ticketId: Number(r.ticket_id),
        sellerId: Number(r.seller_id),
        ticketNumber: r.ticket_number,
        subject: r.subject,
        category: r.category,
        priority: r.priority,
        status: r.status,
        userName: r.user_name || "Merchant / User",
        userEmail: r.user_email || "user@locallink.com",
        userPhone: r.user_phone || "—",
        userRole: r.user_role || "seller",
        shopName: r.shop_name || "Local Vendor Stall",
        messageCount: Number(r.message_count || 0),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })),
      total: Number(countResult.total),
      stats: {
        totalTickets: Number(statsResult.total_tickets || 0),
        openCount: Number(statsResult.open_count || 0),
        inProgressCount: Number(statsResult.in_progress_count || 0),
        resolvedCount: Number(statsResult.resolved_count || 0),
        closedCount: Number(statsResult.closed_count || 0),
        urgentCount: Number(statsResult.urgent_count || 0)
      }
    };
  } finally {
    if (connection) connection.release();
  }
}

async function getTicketDetails(ticketId) {
  let connection;
  try {
    connection = await pool.getConnection();

    const [ticket] = await connection.query(
      `SELECT
         t.ticket_id,
         t.seller_id,
         t.ticket_number,
         t.subject,
         t.category,
         t.priority,
         t.status,
         t.created_at,
         t.updated_at,
         u.name AS user_name,
         u.email AS user_email,
         u.phone AS user_phone,
         u.role AS user_role,
         sp.shop_name
       FROM seller_support_tickets t
       LEFT JOIN users u ON t.seller_id = u.user_id
       LEFT JOIN seller_profiles sp ON t.seller_id = sp.seller_id
       WHERE t.ticket_id = ?`,
      [Number(ticketId)]
    );

    if (!ticket) {
      throw Object.assign(new Error("Support ticket not found"), { statusCode: 404 });
    }

    const messages = await connection.query(
      `SELECT
         m.message_id,
         m.ticket_id,
         m.sender_id,
         m.sender_role,
         m.message,
         m.created_at,
         u.name AS sender_name
       FROM seller_support_messages m
       LEFT JOIN users u ON m.sender_id = u.user_id
       WHERE m.ticket_id = ?
       ORDER BY m.created_at ASC`,
      [Number(ticketId)]
    );

    return {
      ticket: {
        ticketId: Number(ticket.ticket_id),
        sellerId: Number(ticket.seller_id),
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        userName: ticket.user_name || "Merchant / User",
        userEmail: ticket.user_email || "user@locallink.com",
        userPhone: ticket.user_phone || "—",
        userRole: ticket.user_role || "seller",
        shopName: ticket.shop_name || "Local Vendor Stall",
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at
      },
      messages: messages.map(m => ({
        messageId: Number(m.message_id),
        senderId: Number(m.sender_id),
        senderRole: m.sender_role,
        senderName: m.sender_name || (m.sender_role === 'admin' ? 'Support Administrator' : 'Merchant'),
        message: m.message,
        createdAt: m.created_at
      }))
    };
  } finally {
    if (connection) connection.release();
  }
}

async function replyToTicket(ticketId, { message, senderId, newStatus }) {
  let connection;
  try {
    connection = await pool.getConnection();

    const text = (message || "").trim();
    if (!text) throw Object.assign(new Error("Message content cannot be empty"), { statusCode: 400 });

    const adminId = Number(senderId) || 1;

    const res = await connection.query(
      `INSERT INTO seller_support_messages (ticket_id, sender_id, sender_role, message)
       VALUES (?, ?, 'admin', ?)`,
      [Number(ticketId), adminId, text]
    );

    const targetStatus = newStatus && ['open', 'in_progress', 'resolved', 'closed'].includes(newStatus)
      ? newStatus
      : 'in_progress';

    await connection.query(
      `UPDATE seller_support_tickets SET status = ?, updated_at = NOW() WHERE ticket_id = ?`,
      [targetStatus, Number(ticketId)]
    );

    return {
      messageId: Number(res.insertId),
      status: targetStatus,
      message: "Reply sent and ticket updated"
    };
  } finally {
    if (connection) connection.release();
  }
}

async function updateTicket(ticketId, { status, priority }) {
  let connection;
  try {
    connection = await pool.getConnection();

    const updates = [];
    const params = [];

    if (status && ['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      updates.push("status = ?");
      params.push(status);
    }

    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      updates.push("priority = ?");
      params.push(priority);
    }

    if (!updates.length) {
      return { message: "No changes provided" };
    }

    updates.push("updated_at = NOW()");
    params.push(Number(ticketId));

    await connection.query(
      `UPDATE seller_support_tickets SET ${updates.join(", ")} WHERE ticket_id = ?`,
      params
    );

    return { message: "Ticket updated successfully" };
  } finally {
    if (connection) connection.release();
  }
}

async function createTicket(data) {
  let connection;
  try {
    connection = await pool.getConnection();

    const sellerId = Number(data.sellerId) || 3;
    const ticketNumber = `TCK-${Math.floor(1000 + Math.random() * 9000)}-WB`;
    const subject = (data.subject || "").trim();
    const category = (data.category || "general").trim();
    const priority = data.priority || "medium";
    const initialMessage = (data.message || "").trim();

    const res = await connection.query(
      `INSERT INTO seller_support_tickets (seller_id, ticket_number, subject, category, priority, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [sellerId, ticketNumber, subject, category, priority]
    );

    const ticketId = Number(res.insertId);

    if (initialMessage) {
      await connection.query(
        `INSERT INTO seller_support_messages (ticket_id, sender_id, sender_role, message)
         VALUES (?, ?, 'admin', ?)`,
        [ticketId, Number(data.adminId) || 1, initialMessage]
      );
    }

    return {
      ticketId,
      ticketNumber,
      message: `Support ticket ${ticketNumber} created successfully`
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getTickets,
  getTicketDetails,
  replyToTicket,
  updateTicket,
  createTicket
};
