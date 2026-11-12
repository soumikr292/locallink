const { pool } = require("../config/database");

// Get all orders
async function getOrders({
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

    const conditions = [];
    const params = [];

    if (status) {
      conditions.push("o.order_status = ?");
      params.push(status);
    }

    if (paymentStatus) {
      conditions.push("o.payment_status = ?");
      params.push(paymentStatus);
    }

    if (search) {
      conditions.push(`
        (
          o.order_number LIKE ?
          OR u.name LIKE ?
          OR u.email LIKE ?
        )
      `);

      const searchValue = `%${search}%`;

      params.push(
        searchValue,
        searchValue,
        searchValue
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    // Count orders
    const countResult = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM orders o
      INNER JOIN users u
        ON u.user_id = o.customer_id
      ${whereClause}
      `,
      params
    );

    const total = Number(countResult[0].total);

    // Get orders
    const rows = await connection.query(
      `
      SELECT
        o.order_id,
        o.order_number,
        o.customer_id,
        u.name AS customer_name,
        u.email AS customer_email,

        o.subtotal,
        o.delivery_charge,
        o.discount_amount,
        o.total_amount,

        o.order_status,
        o.payment_status,
        o.fulfillment_type,

        o.delivery_address,
        o.customer_note,

        o.created_at,
        o.updated_at

      FROM orders o

      INNER JOIN users u
        ON u.user_id = o.customer_id

      ${whereClause}

      ORDER BY o.created_at DESC

      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      orders: rows.map((order) => ({
        orderId: Number(order.order_id),

        orderNumber: order.order_number,

        customer: {
          customerId: Number(order.customer_id),
          name: order.customer_name,
          email: order.customer_email
        },

        subtotal: Number(order.subtotal),
        deliveryCharge: Number(order.delivery_charge),
        discountAmount: Number(order.discount_amount),
        totalAmount: Number(order.total_amount),

        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        fulfillmentType: order.fulfillment_type,

        deliveryAddress: order.delivery_address,
        customerNote: order.customer_note,

        createdAt: order.created_at,
        updatedAt: order.updated_at
      })),

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Get one order with all items
async function getOrderById(orderId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const orderRows = await connection.query(
      `
      SELECT
        o.order_id,
        o.order_number,
        o.customer_id,

        u.name AS customer_name,
        u.email AS customer_email,
        u.phone AS customer_phone,

        o.subtotal,
        o.delivery_charge,
        o.discount_amount,
        o.total_amount,

        o.order_status,
        o.payment_status,
        o.fulfillment_type,

        o.delivery_address,
        o.customer_note,

        o.created_at,
        o.updated_at

      FROM orders o

      INNER JOIN users u
        ON u.user_id = o.customer_id

      WHERE o.order_id = ?

      LIMIT 1
      `,
      [orderId]
    );

    if (orderRows.length === 0) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    const order = orderRows[0];

    const itemRows = await connection.query(
      `
      SELECT
        oi.order_item_id,
        oi.order_id,
        oi.product_id,
        oi.seller_id,

        seller.name AS seller_name,

        oi.product_name,
        oi.sku,

        oi.quantity,

        oi.unit_price,
        oi.agreed_price,
        oi.discount_amount,
        oi.final_price,

        oi.created_at

      FROM order_items oi

      INNER JOIN users seller
        ON seller.user_id = oi.seller_id

      WHERE oi.order_id = ?

      ORDER BY oi.order_item_id ASC
      `,
      [orderId]
    );

    return {
      orderId: Number(order.order_id),

      orderNumber: order.order_number,

      customer: {
        customerId: Number(order.customer_id),
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone
      },

      subtotal: Number(order.subtotal),
      deliveryCharge: Number(order.delivery_charge),
      discountAmount: Number(order.discount_amount),
      totalAmount: Number(order.total_amount),

      orderStatus: order.order_status,
      paymentStatus: order.payment_status,
      fulfillmentType: order.fulfillment_type,

      deliveryAddress: order.delivery_address,
      customerNote: order.customer_note,

      items: itemRows.map((item) => ({
        orderItemId: Number(item.order_item_id),

        productId: Number(item.product_id),

        sellerId: Number(item.seller_id),
        sellerName: item.seller_name,

        productName: item.product_name,
        sku: item.sku,

        quantity: Number(item.quantity),

        unitPrice: Number(item.unit_price),
        agreedPrice:
          item.agreed_price !== null
            ? Number(item.agreed_price)
            : null,

        discountAmount:
          Number(item.discount_amount),

        finalPrice:
          Number(item.final_price),

        createdAt: item.created_at
      })),

      createdAt: order.created_at,
      updatedAt: order.updated_at
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Update order status
async function updateOrderStatus(
  orderId,
  orderStatus
) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      `
      UPDATE orders
      SET order_status = ?
      WHERE order_id = ?
      `,
      [
        orderStatus,
        orderId
      ]
    );

    if (result.affectedRows === 0) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      orderId: Number(orderId),
      orderStatus
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


// Update payment status
async function updatePaymentStatus(
  orderId,
  paymentStatus
) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      `
      UPDATE orders
      SET payment_status = ?
      WHERE order_id = ?
      `,
      [
        paymentStatus,
        orderId
      ]
    );

    if (result.affectedRows === 0) {
      const error = new Error("Order not found");
      error.statusCode = 404;
      throw error;
    }

    return {
      orderId: Number(orderId),
      paymentStatus
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


module.exports = {
  getOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus
};