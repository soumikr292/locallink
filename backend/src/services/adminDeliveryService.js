const { pool } = require("../config/database");

// Get all deliveries
async function getDeliveries({
  page = 1,
  limit = 20,
  status = "",
  search = ""
}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push("d.delivery_status = ?");
      params.push(status);
    }

    if (search) {
      conditions.push(`
        (
          o.order_number LIKE ?
          OR customer.name LIKE ?
          OR customer.email LIKE ?
          OR rider.name LIKE ?
          OR rider.email LIKE ?
        )
      `);

      const searchValue = `%${search}%`;

      params.push(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const countResult = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM deliveries d

      INNER JOIN orders o
        ON o.order_id = d.order_id

      INNER JOIN users customer
        ON customer.user_id = o.customer_id

      LEFT JOIN delivery_partners dp
        ON dp.delivery_partner_id = d.delivery_partner_id

      LEFT JOIN users rider
        ON rider.user_id = dp.user_id

      ${whereClause}
      `,
      params
    );

    const total = Number(countResult[0].total);

    const rows = await connection.query(
      `
      SELECT
        d.delivery_id,
        d.order_id,
        o.order_number,

        o.customer_id,
        customer.name AS customer_name,
        customer.email AS customer_email,
        customer.phone AS customer_phone,

        d.delivery_partner_id,
        rider.name AS rider_name,
        rider.email AS rider_email,

        d.delivery_status,
        d.pickup_address,
        d.customer_address,

        d.estimated_distance_km,
        d.estimated_duration_minutes,

        d.picked_up_at,
        d.out_for_delivery_at,
        d.delivered_at,

        d.delivery_otp_verified,

        d.created_at,
        d.updated_at

      FROM deliveries d

      INNER JOIN orders o
        ON o.order_id = d.order_id

      INNER JOIN users customer
        ON customer.user_id = o.customer_id

      LEFT JOIN delivery_partners dp
        ON dp.delivery_partner_id = d.delivery_partner_id

      LEFT JOIN users rider
        ON rider.user_id = dp.user_id

      ${whereClause}

      ORDER BY d.created_at DESC

      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      deliveries: rows.map((delivery) => ({
        deliveryId: Number(delivery.delivery_id),

        order: {
          orderId: Number(delivery.order_id),
          orderNumber: delivery.order_number
        },

        customer: {
          customerId: Number(delivery.customer_id),
          name: delivery.customer_name,
          email: delivery.customer_email,
          phone: delivery.customer_phone
        },

        deliveryPartner: delivery.delivery_partner_id
          ? {
              deliveryPartnerId: Number(
                delivery.delivery_partner_id
              ),
              name: delivery.rider_name,
              email: delivery.rider_email
            }
          : null,

        deliveryStatus: delivery.delivery_status,

        pickupAddress: delivery.pickup_address,
        customerAddress: delivery.customer_address,

        estimatedDistanceKm:
          delivery.estimated_distance_km !== null
            ? Number(delivery.estimated_distance_km)
            : null,

        estimatedDurationMinutes:
          delivery.estimated_duration_minutes !== null
            ? Number(delivery.estimated_duration_minutes)
            : null,

        pickedUpAt: delivery.picked_up_at,
        outForDeliveryAt: delivery.out_for_delivery_at,
        deliveredAt: delivery.delivered_at,

        deliveryOtpVerified:
          Boolean(delivery.delivery_otp_verified),

        createdAt: delivery.created_at,
        updatedAt: delivery.updated_at
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
async function getDeliveryById(deliveryId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `
      SELECT
        d.delivery_id,
        d.order_id,
        o.order_number,

        o.customer_id,
        customer.name AS customer_name,
        customer.email AS customer_email,
        customer.phone AS customer_phone,

        d.delivery_partner_id,
        rider.name AS rider_name,
        rider.email AS rider_email,

        d.pickup_address,
        d.customer_address,
        d.customer_phone AS delivery_customer_phone,

        d.delivery_status,

        d.pickup_latitude,
        d.pickup_longitude,

        d.customer_latitude,
        d.customer_longitude,

        d.delivery_instructions,

        d.estimated_distance_km,
        d.estimated_duration_minutes,

        d.picked_up_at,
        d.out_for_delivery_at,
        d.delivered_at,

        d.delivery_otp_verified,
        d.proof_of_delivery,

        d.failure_reason,

        d.created_at,
        d.updated_at

      FROM deliveries d

      INNER JOIN orders o
        ON o.order_id = d.order_id

      INNER JOIN users customer
        ON customer.user_id = o.customer_id

      LEFT JOIN delivery_partners dp
        ON dp.delivery_partner_id = d.delivery_partner_id

      LEFT JOIN users rider
        ON rider.user_id = dp.user_id

      WHERE d.delivery_id = ?

      LIMIT 1
      `,
      [deliveryId]
    );

    if (rows.length === 0) {
      const error = new Error("Delivery not found");
      error.statusCode = 404;
      throw error;
    }

    const delivery = rows[0];

    return {
      deliveryId: Number(delivery.delivery_id),

      order: {
        orderId: Number(delivery.order_id),
        orderNumber: delivery.order_number
      },

      customer: {
        customerId: Number(delivery.customer_id),
        name: delivery.customer_name,
        email: delivery.customer_email,
        phone: delivery.customer_phone
      },

      deliveryPartner: delivery.delivery_partner_id
        ? {
            deliveryPartnerId: Number(
              delivery.delivery_partner_id
            ),
            name: delivery.rider_name,
            email: delivery.rider_email
          }
        : null,

      pickupAddress: delivery.pickup_address,
      customerAddress: delivery.customer_address,
      customerPhone: delivery.delivery_customer_phone,

      deliveryStatus: delivery.delivery_status,

      pickupLocation: {
        latitude:
          delivery.pickup_latitude !== null
            ? Number(delivery.pickup_latitude)
            : null,
        longitude:
          delivery.pickup_longitude !== null
            ? Number(delivery.pickup_longitude)
            : null
      },

      customerLocation: {
        latitude:
          delivery.customer_latitude !== null
            ? Number(delivery.customer_latitude)
            : null,
        longitude:
          delivery.customer_longitude !== null
            ? Number(delivery.customer_longitude)
            : null
      },

      deliveryInstructions:
        delivery.delivery_instructions,

      estimatedDistanceKm:
        delivery.estimated_distance_km !== null
          ? Number(delivery.estimated_distance_km)
          : null,

      estimatedDurationMinutes:
        delivery.estimated_duration_minutes !== null
          ? Number(delivery.estimated_duration_minutes)
          : null,

      pickedUpAt: delivery.picked_up_at,
      outForDeliveryAt: delivery.out_for_delivery_at,
      deliveredAt: delivery.delivered_at,

      deliveryOtpVerified:
        Boolean(delivery.delivery_otp_verified),

      proofOfDelivery:
        delivery.proof_of_delivery,

      failureReason:
        delivery.failure_reason,

      createdAt: delivery.created_at,
      updatedAt: delivery.updated_at
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function updateDeliveryStatus(
  deliveryId,
  deliveryStatus,
  failureReason = null
) {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const rows = await connection.query(
      `
      SELECT
        delivery_id,
        order_id,
        delivery_partner_id,
        delivery_status,
        delivery_otp_verified
      FROM deliveries
      WHERE delivery_id = ?
      FOR UPDATE
      `,
      [deliveryId]
    );

    if (rows.length === 0) {
      const error = new Error("Delivery not found");
      error.statusCode = 404;
      throw error;
    }

    const delivery = rows[0];
    const currentStatus = delivery.delivery_status;

    const allowedTransitions = {
      pending: ["assigned", "cancelled"],
      assigned: ["picked_up", "cancelled", "failed"],
      picked_up: ["out_for_delivery", "failed"],
      out_for_delivery: ["delivered", "failed"],
      delivered: [],
      failed: [],
      cancelled: []
    };

    if (
      !allowedTransitions[currentStatus]?.includes(
        deliveryStatus
      )
    ) {
      const error = new Error(
        `Cannot change delivery status from ${currentStatus} to ${deliveryStatus}`
      );
      error.statusCode = 400;
      throw error;
    }

    if (
      deliveryStatus === "delivered" &&
      !delivery.delivery_otp_verified
    ) {
      const error = new Error(
        "Delivery OTP must be verified before marking delivery as delivered"
      );
      error.statusCode = 400;
      throw error;
    }

    const timestampUpdates = {
      picked_up: "picked_up_at = CURRENT_TIMESTAMP",
      out_for_delivery:
        "out_for_delivery_at = CURRENT_TIMESTAMP",
      delivered: "delivered_at = CURRENT_TIMESTAMP"
    };

    const timestampUpdate =
      timestampUpdates[deliveryStatus] || "";

    await connection.query(
  `
    UPDATE deliveries
    SET
      delivery_status = ?,
      failure_reason = ?
      ${timestampUpdate ? `, ${timestampUpdate}` : ""}
    WHERE delivery_id = ?
  `,
  [
    deliveryStatus,
    deliveryStatus === "failed" ? failureReason : null,
    deliveryId
  ]
);

    
if (
  delivery.delivery_partner_id &&
  ["delivered", "failed", "cancelled"].includes(deliveryStatus)
) {
  if (deliveryStatus === "delivered") {
    await connection.query(
      `
      UPDATE delivery_partners
      SET
        availability_status = 'available',
        total_deliveries = total_deliveries + 1,
        successful_deliveries = successful_deliveries + 1
      WHERE delivery_partner_id = ?
      `,
      [delivery.delivery_partner_id]
    );
  } else {
    await connection.query(
      `
      UPDATE delivery_partners
      SET availability_status = 'available'
      WHERE delivery_partner_id = ?
      `,
      [delivery.delivery_partner_id]
    );
  }
}
    if (deliveryStatus === "out_for_delivery") {
  await connection.query(
    `
    UPDATE orders
    SET order_status = 'out_for_delivery'
    WHERE order_id = ?
    `,
    [deliveryId ? delivery.order_id : null]
  );
}

if (deliveryStatus === "delivered") {
  await connection.query(
    `
    UPDATE orders
    SET order_status = 'delivered'
    WHERE order_id = (
      SELECT order_id
      FROM deliveries
      WHERE delivery_id = ?
    )
    `,
    [deliveryId]
  );
}

if (
  deliveryStatus === "out_for_delivery" ||
  deliveryStatus === "delivered"
) {
  await connection.query(
    `
    UPDATE orders
    SET order_status = ?
    WHERE order_id = ?
    `,
    [deliveryStatus, delivery.order_id]
  );
}


    // Save delivery status transition history
    await connection.query(
      `
      INSERT INTO delivery_status_history (
        delivery_id,
        previous_status,
        new_status,
        notes
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        deliveryId,
        currentStatus,
        deliveryStatus,
        deliveryStatus === "failed"
          ? failureReason
          : null
      ]
    );


    await connection.commit();

    return {
      deliveryId: Number(deliveryId),
      previousStatus: currentStatus,
      deliveryStatus
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function getAvailableDeliveryPartners() {
  let connection;

  try {
    connection = await pool.getConnection();

    const query = `
      SELECT
        dp.delivery_partner_id,
        dp.user_id,
        u.name,
        u.email,
        u.phone,
        dp.vehicle_type,
        dp.vehicle_number,
        dp.availability_status,
        dp.verification_status,
        dp.total_deliveries,
        dp.successful_deliveries
      FROM delivery_partners dp
      INNER JOIN users u
        ON u.user_id = dp.user_id
      WHERE dp.availability_status = 'available'
        AND dp.verification_status = 'verified'
        AND u.status = 'active'
      ORDER BY dp.successful_deliveries DESC, dp.created_at ASC
    `;

    const partners = await connection.query(query);

    return partners.map((partner) => ({
      deliveryPartnerId: Number(partner.delivery_partner_id),
      userId: Number(partner.user_id),
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      vehicleType: partner.vehicle_type,
      vehicleNumber: partner.vehicle_number,
      availabilityStatus: partner.availability_status,
      verificationStatus: partner.verification_status,
      totalDeliveries: Number(partner.total_deliveries),
      successfulDeliveries: Number(partner.successful_deliveries)
    }));
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
async function assignDeliveryPartner(
  deliveryId,
  deliveryPartnerId
) {
  let connection;

  try {
    connection = await pool.getConnection();

    // Check delivery exists
    const deliveryRows = await connection.query(
      `
      SELECT
        delivery_id,
        delivery_status
      FROM deliveries
      WHERE delivery_id = ?
      `,
      [deliveryId]
    );

    if (deliveryRows.length === 0) {
      const error = new Error("Delivery not found");
      error.statusCode = 404;
      throw error;
    }

    // Check rider is active, verified and available
    const partnerRows = await connection.query(
      `
      SELECT
        dp.delivery_partner_id
      FROM delivery_partners dp
      INNER JOIN users u
        ON u.user_id = dp.user_id
      WHERE dp.delivery_partner_id = ?
        AND dp.availability_status = 'available'
        AND dp.verification_status = 'verified'
        AND u.status = 'active'
      `,
      [deliveryPartnerId]
    );

    if (partnerRows.length === 0) {
      const error = new Error(
        "Delivery partner is not available for assignment"
      );
      error.statusCode = 400;
      throw error;
    }

    // Assign rider
    const result = await connection.query(
  `
  UPDATE deliveries
  SET
    delivery_partner_id = ?,
    delivery_status = 'assigned'
  WHERE delivery_id = ?
  `,
  [deliveryPartnerId, deliveryId]
);

if (result.affectedRows === 0) {
  const error = new Error("Delivery assignment failed");
  error.statusCode = 500;
  throw error;
}

await connection.query(
  `
  UPDATE delivery_partners
  SET availability_status = 'busy'
  WHERE delivery_partner_id = ?
  `,
  [deliveryPartnerId]
);


    // Record assignment in delivery status history
    const previousStatus = deliveryRows[0].delivery_status;

    if (previousStatus !== "assigned") {
      await connection.query(
        `
        INSERT INTO delivery_status_history (
          delivery_id,
          previous_status,
          new_status,
          notes
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          deliveryId,
          previousStatus,
          "assigned",
          "Delivery partner assigned by admin"
        ]
      );
    }


    if (result.affectedRows === 0) {
      const error = new Error("Delivery assignment failed");
      error.statusCode = 500;
      throw error;
    }

    return {
      deliveryId: Number(deliveryId),
      deliveryPartnerId: Number(deliveryPartnerId),
      deliveryStatus: "assigned"
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

async function verifyDeliveryOtp(
  deliveryId,
  deliveryOtp
) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `
      SELECT
        delivery_id,
        order_id,
        delivery_partner_id,
        delivery_status,
        delivery_otp_verified
      FROM deliveries
      WHERE delivery_id = ?
      `,
      [deliveryId]
    );

    if (rows.length === 0) {
      const error = new Error("Delivery not found");
      error.statusCode = 404;
      throw error;
    }

    const delivery = rows[0];

    if (delivery.delivery_status !== "out_for_delivery") {
      const error = new Error(
        "OTP can only be verified for an out-for-delivery order"
      );
      error.statusCode = 400;
      throw error;
    }

    if (delivery.delivery_otp_verified) {
      const error = new Error(
        "Delivery OTP has already been verified"
      );
      error.statusCode = 400;
      throw error;
    }

    if (String(delivery.delivery_otp) !== String(deliveryOtp)) {
      const error = new Error("Invalid delivery OTP");
      error.statusCode = 400;
      throw error;
    }

    await connection.query(
      `
      UPDATE deliveries
      SET delivery_otp_verified = TRUE
      WHERE delivery_id = ?
      `,
      [deliveryId]
    );

    return {
      deliveryId: Number(deliveryId),
      deliveryOtpVerified: true
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// ============================================
// RIDER DIRECTORY
// ============================================

async function getDeliveryPartners({
  page = 1,
  limit = 20,
  search = "",
  verificationStatus = "",
  availabilityStatus = ""
} = {}) {
  let connection;

  try {
    connection = await pool.getConnection();

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`
        (
          u.name LIKE ?
          OR u.email LIKE ?
          OR u.phone LIKE ?
          OR dp.vehicle_number LIKE ?
        )
      `);

      const value = `%${search}%`;

      params.push(value, value, value, value);
    }

    const allowedVerification = [
      "pending",
      "verified",
      "rejected"
    ];

    const allowedAvailability = [
      "available",
      "unavailable",
      "busy",
      "suspended"
    ];

    if (
      verificationStatus &&
      !allowedVerification.includes(verificationStatus)
    ) {
      const error = new Error("Invalid verification status");
      error.statusCode = 400;
      throw error;
    }

    if (
      availabilityStatus &&
      !allowedAvailability.includes(availabilityStatus)
    ) {
      const error = new Error("Invalid availability status");
      error.statusCode = 400;
      throw error;
    }

    if (verificationStatus) {
      conditions.push("dp.verification_status = ?");
      params.push(verificationStatus);
    }

    if (availabilityStatus) {
      conditions.push("dp.availability_status = ?");
      params.push(availabilityStatus);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countRows = await connection.query(
      `
      SELECT COUNT(*) AS total
      FROM delivery_partners dp
      INNER JOIN users u
        ON u.user_id = dp.user_id
      ${whereClause}
      `,
      params
    );

    const total = Number(countRows[0].total);
    const offset = (page - 1) * limit;

    const rows = await connection.query(
      `
      SELECT
        dp.delivery_partner_id,
        dp.user_id,
        u.name,
        u.email,
        u.phone,
        u.status AS account_status,
        dp.vehicle_type,
        dp.vehicle_number,
        dp.availability_status,
        dp.verification_status,
        dp.total_deliveries,
        dp.successful_deliveries,
        dp.created_at,
        dp.updated_at
      FROM delivery_partners dp
      INNER JOIN users u
        ON u.user_id = dp.user_id
      ${whereClause}
      ORDER BY dp.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    return {
      riders: rows.map((rider) => ({
        deliveryPartnerId: Number(rider.delivery_partner_id),
        userId: Number(rider.user_id),
        name: rider.name,
        email: rider.email,
        phone: rider.phone,
        accountStatus: rider.account_status,
        vehicleType: rider.vehicle_type,
        vehicleNumber: rider.vehicle_number,
        availabilityStatus: rider.availability_status,
        verificationStatus: rider.verification_status,
        totalDeliveries: Number(rider.total_deliveries),
        successfulDeliveries: Number(rider.successful_deliveries),
        createdAt: rider.created_at,
        updatedAt: rider.updated_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } finally {
    if (connection) connection.release();
  }
}


// ============================================
// UPDATE RIDER VERIFICATION STATUS
// ============================================

async function updateDeliveryPartnerVerification(
  deliveryPartnerId,
  verificationStatus
) {
  let connection;

  try {
    connection = await pool.getConnection();

    const allowedStatuses = ["pending", "verified", "rejected"];

    if (!allowedStatuses.includes(verificationStatus)) {
      const error = new Error("Invalid verification status");
      error.statusCode = 400;
      throw error;
    }

    const rows = await connection.query(
      `
      SELECT
        delivery_partner_id,
        verification_status
      FROM delivery_partners
      WHERE delivery_partner_id = ?
      `,
      [deliveryPartnerId]
    );

    if (rows.length === 0) {
      const error = new Error("Delivery partner not found");
      error.statusCode = 404;
      throw error;
    }

    await connection.query(
      `
      UPDATE delivery_partners
      SET verification_status = ?
      WHERE delivery_partner_id = ?
      `,
      [verificationStatus, deliveryPartnerId]
    );

    return {
      deliveryPartnerId: Number(deliveryPartnerId),
      previousStatus: rows[0].verification_status,
      verificationStatus
    };
  } finally {
    if (connection) connection.release();
  }
}


async function updateRiderGpsLocation(
  deliveryPartnerId,
  deliveryId,
  latitude,
  longitude
) {
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Verify this rider is assigned to an active delivery
    const deliveries = await connection.query(
      `
      SELECT delivery_id, delivery_partner_id, delivery_status
      FROM deliveries
      WHERE delivery_id = ?
        AND delivery_partner_id = ?
        AND delivery_status IN (
          'assigned',
          'picked_up',
          'out_for_delivery'
        )
      FOR UPDATE
      `,
      [deliveryId, deliveryPartnerId]
    );

    if (deliveries.length === 0) {
      const error = new Error(
        "No active delivery found for this delivery partner"
      );
      error.statusCode = 404;
      throw error;
    }

    // Update the rider's latest known position
    await connection.query(
      `
      UPDATE delivery_partners
      SET
        current_latitude = ?,
        current_longitude = ?
      WHERE delivery_partner_id = ?
      `,
      [latitude, longitude, deliveryPartnerId]
    );

    // Save this GPS sample for the location timeline
    await connection.query(
      `
      INSERT INTO delivery_location_history (
        delivery_id,
        delivery_partner_id,
        latitude,
        longitude
      )
      VALUES (?, ?, ?, ?)
      `,
      [deliveryId, deliveryPartnerId, latitude, longitude]
    );

    await connection.commit();

    return {
      deliveryId: Number(deliveryId),
      deliveryPartnerId: Number(deliveryPartnerId),
      latitude: Number(latitude),
      longitude: Number(longitude),
      recorded: true
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


async function getDeliveryTracking(deliveryId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const deliveryRows = await connection.query(
      `
      SELECT
        d.delivery_id,
        d.delivery_status,
        d.delivery_partner_id,
        dp.current_latitude,
        dp.current_longitude
      FROM deliveries d
      LEFT JOIN delivery_partners dp
        ON dp.delivery_partner_id = d.delivery_partner_id
      WHERE d.delivery_id = ?
      LIMIT 1
      `,
      [deliveryId]
    );

    if (deliveryRows.length === 0) {
      const error = new Error("Delivery not found");
      error.statusCode = 404;
      throw error;
    }

    const delivery = deliveryRows[0];

    const locations = await connection.query(
      `
      SELECT latitude, longitude, recorded_at
      FROM delivery_location_history
      WHERE delivery_id = ?
      ORDER BY recorded_at DESC, location_id DESC
      LIMIT 50
      `,
      [deliveryId]
    );

    const statusHistory = await connection.query(
      `
      SELECT previous_status, new_status, notes, changed_at
      FROM delivery_status_history
      WHERE delivery_id = ?
      ORDER BY changed_at DESC, history_id DESC
      LIMIT 50
      `,
      [deliveryId]
    );

    return {
      deliveryId: Number(delivery.delivery_id),
      deliveryStatus: delivery.delivery_status,
      deliveryPartnerId: delivery.delivery_partner_id
        ? Number(delivery.delivery_partner_id)
        : null,
      currentLocation: {
        latitude: delivery.current_latitude !== null
          ? Number(delivery.current_latitude)
          : null,
        longitude: delivery.current_longitude !== null
          ? Number(delivery.current_longitude)
          : null
      },
      locationHistory: locations.map((item) => ({
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        recordedAt: item.recorded_at
      })),
      statusHistory: statusHistory.map((item) => ({
        previousStatus: item.previous_status,
        newStatus: item.new_status,
        notes: item.notes,
        changedAt: item.changed_at
      }))
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}


module.exports = {
  getDeliveries,
  getDeliveryById,
  updateDeliveryStatus,
  getAvailableDeliveryPartners,
  assignDeliveryPartner,
  verifyDeliveryOtp,
  updateRiderGpsLocation,
  getDeliveryTracking,
  getDeliveryPartners
};