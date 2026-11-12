
const { pool } = require("../config/database");

// ===============================
// SHIPPING ZONES
// ===============================

async function listShippingZones() {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(`
      SELECT
        zone_id,
        zone_name,
        city,
        area,
        pincode,
        status,
        created_at,
        updated_at
      FROM shipping_zones
      ORDER BY zone_id DESC
    `);

    return rows.map((row) => ({
      zoneId: Number(row.zone_id),
      zoneName: row.zone_name,
      city: row.city,
      area: row.area,
      pincode: row.pincode,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } finally {
    if (connection) connection.release();
  }
}

async function createShippingZone(data) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      `INSERT INTO shipping_zones
       (zone_name, city, area, pincode, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.zoneName,
        data.city,
        data.area || null,
        data.pincode || null,
        data.status || "active"
      ]
    );

    return {
      zoneId: Number(result.insertId),
      ...data,
      status: data.status || "active"
    };
  } finally {
    if (connection) connection.release();
  }
}

async function updateShippingZone(zoneId, data) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      `UPDATE shipping_zones
       SET zone_name = ?, city = ?, area = ?, pincode = ?, status = ?
       WHERE zone_id = ?`,
      [
        data.zoneName,
        data.city,
        data.area || null,
        data.pincode || null,
        data.status,
        zoneId
      ]
    );

    if (result.affectedRows === 0) {
      const error = new Error("Shipping zone not found");
      error.statusCode = 404;
      throw error;
    }

    return { zoneId: Number(zoneId), ...data };
  } finally {
    if (connection) connection.release();
  }
}

async function setShippingZoneStatus(zoneId, status) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      "UPDATE shipping_zones SET status = ? WHERE zone_id = ?",
      [status, zoneId]
    );

    if (result.affectedRows === 0) {
      const rows = await connection.query(
        "SELECT zone_id FROM shipping_zones WHERE zone_id = ?",
        [zoneId]
      );

      if (rows.length === 0) {
        const error = new Error("Shipping zone not found");
        error.statusCode = 404;
        throw error;
      }
    }

    return { zoneId: Number(zoneId), status };
  } finally {
    if (connection) connection.release();
  }
}

// ===============================
// SHIPPING METHODS
// ===============================

async function listShippingMethods() {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(`
      SELECT
        method_id,
        method_name,
        description,
        base_charge,
        estimated_delivery_minutes,
        free_delivery_minimum,
        status,
        created_at,
        updated_at
      FROM shipping_methods
      ORDER BY method_id DESC
    `);

    return rows.map((row) => ({
      methodId: Number(row.method_id),
      methodName: row.method_name,
      description: row.description,
      baseCharge: Number(row.base_charge),
      estimatedDeliveryMinutes:
        row.estimated_delivery_minutes === null
          ? null
          : Number(row.estimated_delivery_minutes),
      freeDeliveryMinimum:
        row.free_delivery_minimum === null
          ? null
          : Number(row.free_delivery_minimum),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  } finally {
    if (connection) connection.release();
  }
}

async function createShippingMethod(data) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      `INSERT INTO shipping_methods
       (method_name, description, base_charge,
        estimated_delivery_minutes, free_delivery_minimum, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.methodName,
        data.description || null,
        data.baseCharge,
        data.estimatedDeliveryMinutes ?? null,
        data.freeDeliveryMinimum ?? null,
        data.status || "active"
      ]
    );

    return {
      methodId: Number(result.insertId),
      ...data,
      status: data.status || "active"
    };
  } finally {
    if (connection) connection.release();
  }
}

async function updateShippingMethod(methodId, data) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      `UPDATE shipping_methods
       SET method_name = ?, description = ?, base_charge = ?,
           estimated_delivery_minutes = ?, free_delivery_minimum = ?,
           status = ?
       WHERE method_id = ?`,
      [
        data.methodName,
        data.description || null,
        data.baseCharge,
        data.estimatedDeliveryMinutes ?? null,
        data.freeDeliveryMinimum ?? null,
        data.status,
        methodId
      ]
    );

    if (result.affectedRows === 0) {
      const rows = await connection.query(
        "SELECT method_id FROM shipping_methods WHERE method_id = ?",
        [methodId]
      );

      if (rows.length === 0) {
        const error = new Error("Shipping method not found");
        error.statusCode = 404;
        throw error;
      }
    }

    return { methodId: Number(methodId), ...data };
  } finally {
    if (connection) connection.release();
  }
}

async function setShippingMethodStatus(methodId, status) {
  let connection;

  try {
    connection = await pool.getConnection();

    const result = await connection.query(
      "UPDATE shipping_methods SET status = ? WHERE method_id = ?",
      [status, methodId]
    );

    if (result.affectedRows === 0) {
      const rows = await connection.query(
        "SELECT method_id FROM shipping_methods WHERE method_id = ?",
        [methodId]
      );

      if (rows.length === 0) {
        const error = new Error("Shipping method not found");
        error.statusCode = 404;
        throw error;
      }
    }

    return { methodId: Number(methodId), status };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  listShippingZones,
  createShippingZone,
  updateShippingZone,
  setShippingZoneStatus,
  listShippingMethods,
  createShippingMethod,
  updateShippingMethod,
  setShippingMethodStatus
};
