const { pool } = require("../config/database");

// Get orders containing items belonging to this seller
async function getSellerOrders({
  sellerId,
  page = 1,
  limit = 20,
  status = "",
  paymentStatus = "",
  search = ""
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * limit;
    const conditions = ["oi.seller_id = ?"];
    const params = [Number(sellerId)];

    if (status) {
      conditions.push("o.order_status = ?");
      params.push(status);
    }

    if (paymentStatus) {
      conditions.push("o.payment_status = ?");
      params.push(paymentStatus);
    }

    if (search) {
      conditions.push("(o.order_number LIKE ? OR u.name LIKE ? OR oi.product_name LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // Total distinct orders count
    const countResult = await connection.query(
      `SELECT COUNT(DISTINCT o.order_id) AS total
       FROM orders o
       INNER JOIN order_items oi ON o.order_id = oi.order_id
       INNER JOIN users u ON o.customer_id = u.user_id
       ${whereClause}`,
      params
    );

    const total = Number(countResult[0]?.total || 0);

    // Fetch order headers
    const rows = await connection.query(
      `SELECT
         o.order_id,
         o.order_number,
         o.order_status,
         o.payment_status,
         o.fulfillment_type,
         o.delivery_address,
         o.customer_note,
         o.created_at,
         o.updated_at,
         u.name AS customer_name,
         u.phone AS customer_phone,
         COALESCE(SUM(oi.final_price), 0) AS seller_subtotal,
         COUNT(oi.order_item_id) AS seller_item_count
       FROM orders o
       INNER JOIN order_items oi ON o.order_id = oi.order_id
       INNER JOIN users u ON o.customer_id = u.user_id
       ${whereClause}
       GROUP BY o.order_id
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Fetch the items for these orders for this seller
    const orderIds = rows.map((r) => r.order_id);
    let itemsByOrder = {};

    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => "?").join(",");
      const itemRows = await connection.query(
        `SELECT
           oi.order_item_id,
           oi.order_id,
           oi.product_id,
           oi.product_name,
           oi.sku,
           oi.quantity,
           oi.unit_price,
           oi.agreed_price,
           oi.discount_amount,
           oi.final_price,
           p.image_url
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.product_id
         WHERE oi.order_id IN (${placeholders})
           AND oi.seller_id = ?`,
        [...orderIds, Number(sellerId)]
      );

      for (const item of itemRows) {
        if (!itemsByOrder[item.order_id]) {
          itemsByOrder[item.order_id] = [];
        }
        itemsByOrder[item.order_id].push({
          orderItemId: Number(item.order_item_id),
          productId: Number(item.product_id),
          productName: item.product_name,
          sku: item.sku,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          agreedPrice: item.agreed_price !== null ? Number(item.agreed_price) : null,
          discountAmount: Number(item.discount_amount),
          finalPrice: Number(item.final_price),
          imageUrl: item.image_url
        });
      }
    }

    return {
      orders: rows.map((o) => ({
        orderId: Number(o.order_id),
        orderNumber: o.order_number,
        orderStatus: o.order_status,
        paymentStatus: o.payment_status,
        fulfillmentType: o.fulfillment_type,
        deliveryAddress: o.delivery_address,
        customerNote: o.customer_note,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        sellerSubtotal: Number(o.seller_subtotal),
        itemCount: Number(o.seller_item_count),
        items: itemsByOrder[o.order_id] || []
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit)
      }
    };
  } finally {
    if (connection) connection.release();
  }
}

// Get single order details for this seller
async function getSellerOrderById(sellerId, orderId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const orderRows = await connection.query(
      `SELECT
         o.order_id,
         o.order_number,
         o.order_status,
         o.payment_status,
         o.fulfillment_type,
         o.delivery_address,
         o.customer_note,
         o.created_at,
         o.updated_at,
         u.name AS customer_name,
         u.phone AS customer_phone,
         p.payment_method,
         p.payment_status AS detailed_payment_status,
         d.delivery_status,
         dp.vehicle_type,
         dp.vehicle_number
       FROM orders o
       INNER JOIN order_items oi ON o.order_id = oi.order_id
       INNER JOIN users u ON o.customer_id = u.user_id
       LEFT JOIN payments p ON o.order_id = p.order_id
       LEFT JOIN deliveries d ON o.order_id = d.order_id
       LEFT JOIN delivery_partners dp ON d.delivery_partner_id = dp.delivery_partner_id
       WHERE o.order_id = ? AND oi.seller_id = ?
       LIMIT 1`,
      [Number(orderId), Number(sellerId)]
    );

    if (orderRows.length === 0) {
      const error = new Error("Order not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    const order = orderRows[0];

    // Fetch ONLY this seller's items
    const itemRows = await connection.query(
      `SELECT
         oi.order_item_id,
         oi.product_id,
         oi.product_name,
         oi.sku,
         oi.quantity,
         oi.unit_price,
         oi.agreed_price,
         oi.discount_amount,
         oi.final_price,
         p.image_url
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.product_id
       WHERE oi.order_id = ? AND oi.seller_id = ?`,
      [Number(orderId), Number(sellerId)]
    );

    let sellerSubtotal = 0;
    const items = itemRows.map((item) => {
      sellerSubtotal += Number(item.final_price);
      return {
        orderItemId: Number(item.order_item_id),
        productId: Number(item.product_id),
        productName: item.product_name,
        sku: item.sku,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        agreedPrice: item.agreed_price !== null ? Number(item.agreed_price) : null,
        discountAmount: Number(item.discount_amount),
        finalPrice: Number(item.final_price),
        imageUrl: item.image_url
      };
    });

    // Commission calculation
    const profile = await connection.query(
      "SELECT commission_rate FROM seller_profiles WHERE seller_id = ? LIMIT 1",
      [Number(sellerId)]
    );
    const commissionRate = Number(profile[0]?.commission_rate || 5.0);
    const marketplaceFee = Number((sellerSubtotal * (commissionRate / 100)).toFixed(2));
    const netSellerEarnings = Number((sellerSubtotal - marketplaceFee).toFixed(2));

    return {
      orderId: Number(order.order_id),
      orderNumber: order.order_number,
      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method || "cod",
      fulfillmentType: order.fulfillment_type,
      deliveryStatus: order.delivery_status || "pending",
      deliveryAddress: order.delivery_address,
      customerNote: order.customer_note,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      customer: {
        name: order.customer_name,
        phone: order.customer_phone
      },
      sellerSubtotal,
      commissionRate,
      marketplaceFee,
      netSellerEarnings,
      items
    };
  } finally {
    if (connection) connection.release();
  }
}

// Update order status by seller (e.g. mark confirmed, processing, ready_for_pickup)
async function updateSellerOrderStatus(sellerId, orderId, newStatus) {
  let connection;

  const allowedSellerTransitions = [
    "confirmed",
    "processing",
    "ready_for_pickup",
    "cancelled"
  ];

  if (!allowedSellerTransitions.includes(newStatus)) {
    const error = new Error(`Sellers can only set status to: ${allowedSellerTransitions.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  try {
    connection = await pool.getConnection();

    // Verify order has items belonging to this seller
    const check = await connection.query(
      `SELECT o.order_id, o.order_status
       FROM orders o
       INNER JOIN order_items oi ON o.order_id = oi.order_id
       WHERE o.order_id = ? AND oi.seller_id = ?
       LIMIT 1`,
      [Number(orderId), Number(sellerId)]
    );

    if (check.length === 0) {
      const error = new Error("Order not found or unauthorized");
      error.statusCode = 404;
      throw error;
    }

    const currentStatus = check[0].order_status;

    // Check if transition is valid
    if (["delivered", "cancelled", "refunded"].includes(currentStatus)) {
      const error = new Error(`Cannot change status of an order that is already ${currentStatus}`);
      error.statusCode = 400;
      throw error;
    }

    await connection.beginTransaction();

    await connection.query(
      "UPDATE orders SET order_status = ? WHERE order_id = ?",
      [newStatus, Number(orderId)]
    );

    // If marked ready_for_pickup, ensure the delivery request is pending and open for rider claim
    if (newStatus === "ready_for_pickup") {
      await connection.query(
        "UPDATE deliveries SET delivery_status = 'pending', delivery_partner_id = NULL WHERE order_id = ? AND delivery_status != 'delivered'",
        [Number(orderId)]
      );
    } else if (newStatus === "cancelled") {
      await connection.query(
        "UPDATE deliveries SET delivery_status = 'cancelled' WHERE order_id = ?",
        [Number(orderId)]
      );
    }

    await connection.commit();

    return {
      message: `Order status updated to ${newStatus}`,
      orderId: Number(orderId),
      previousStatus: currentStatus,
      newStatus
    };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getSellerOrders,
  getSellerOrderById,
  updateSellerOrderStatus
};
