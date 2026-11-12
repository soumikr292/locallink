const { pool } = require("../config/database");

// Get seller support tickets
async function getSellerTickets(sellerId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `SELECT
         t.ticket_id,
         t.ticket_number,
         t.subject,
         t.category,
         t.priority,
         t.status,
         t.created_at,
         t.updated_at,
         COUNT(m.message_id) AS message_count
       FROM seller_support_tickets t
       LEFT JOIN seller_support_messages m ON t.ticket_id = m.ticket_id
       WHERE t.seller_id = ?
       GROUP BY t.ticket_id
       ORDER BY t.updated_at DESC`,
      [Number(sellerId)]
    );

    return rows.map((r) => ({
      ticketId: Number(r.ticket_id),
      ticketNumber: r.ticket_number,
      subject: r.subject,
      category: r.category,
      priority: r.priority,
      status: r.status,
      messageCount: Number(r.message_count),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  } finally {
    if (connection) connection.release();
  }
}

// Get single ticket details and conversation messages
async function getSellerTicketDetails(sellerId, ticketId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const ticketRows = await connection.query(
      `SELECT ticket_id, ticket_number, subject, category, priority, status, created_at, updated_at
       FROM seller_support_tickets
       WHERE ticket_id = ? AND seller_id = ?
       LIMIT 1`,
      [Number(ticketId), Number(sellerId)]
    );

    if (ticketRows.length === 0) {
      const error = new Error("Support ticket not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    const ticket = ticketRows[0];

    const messageRows = await connection.query(
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
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at
      },
      messages: messageRows.map((m) => ({
        messageId: Number(m.message_id),
        senderId: Number(m.sender_id),
        senderRole: m.sender_role,
        senderName: m.sender_name || (m.sender_role === "seller" ? "You" : "Support Team"),
        message: m.message,
        createdAt: m.created_at
      }))
    };
  } finally {
    if (connection) connection.release();
  }
}

// Create new support ticket
async function createSellerTicket(sellerId, { subject, category = "general", priority = "medium", initialMessage }) {
  let connection;

  if (!subject || !subject.trim()) {
    const error = new Error("Subject is required");
    error.statusCode = 400;
    throw error;
  }

  if (!initialMessage || !initialMessage.trim()) {
    const error = new Error("Message content is required");
    error.statusCode = 400;
    throw error;
  }

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();

    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const ticketResult = await connection.query(
      `INSERT INTO seller_support_tickets (
         seller_id, ticket_number, subject, category, priority, status
       ) VALUES (?, ?, ?, ?, ?, 'open')`,
      [Number(sellerId), ticketNumber, subject.trim(), category, priority]
    );

    const ticketId = Number(ticketResult.insertId);

    await connection.query(
      `INSERT INTO seller_support_messages (
         ticket_id, sender_id, sender_role, message
       ) VALUES (?, ?, 'seller', ?)`,
      [ticketId, Number(sellerId), initialMessage.trim()]
    );

    await connection.commit();

    return {
      message: "Support ticket created successfully",
      ticketId,
      ticketNumber
    };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

// Reply to existing ticket
async function replyToSellerTicket(sellerId, ticketId, messageText) {
  let connection;

  if (!messageText || !messageText.trim()) {
    const error = new Error("Message cannot be empty");
    error.statusCode = 400;
    throw error;
  }

  try {
    connection = await pool.getConnection();

    // Verify ownership
    const check = await connection.query(
      "SELECT ticket_id, status FROM seller_support_tickets WHERE ticket_id = ? AND seller_id = ? LIMIT 1",
      [Number(ticketId), Number(sellerId)]
    );

    if (check.length === 0) {
      const error = new Error("Ticket not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    if (check[0].status === "closed") {
      const error = new Error("This ticket is closed. Please create a new ticket.");
      error.statusCode = 400;
      throw error;
    }

    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO seller_support_messages (
         ticket_id, sender_id, sender_role, message
       ) VALUES (?, ?, 'seller', ?)`,
      [Number(ticketId), Number(sellerId), messageText.trim()]
    );

    await connection.query(
      "UPDATE seller_support_tickets SET updated_at = NOW(), status = 'open' WHERE ticket_id = ?",
      [Number(ticketId)]
    );

    await connection.commit();

    return { message: "Reply sent successfully" };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getSellerTickets,
  getSellerTicketDetails,
  createSellerTicket,
  replyToSellerTicket
};
