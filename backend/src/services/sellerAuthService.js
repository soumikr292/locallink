const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");
const { generateToken } = require("../utils/jwt");

async function loginSeller(loginIdentifier, password) {
  let connection;

  try {
    connection = await pool.getConnection();

    // Find by email or phone
    const rows = await connection.query(
      `SELECT u.user_id, u.name, u.email, u.phone, u.password_hash, u.role, u.status,
              p.profile_id, p.shop_name, p.shop_description, p.shop_logo, p.shop_banner,
              p.business_email, p.business_phone, p.shop_address, p.city, p.pincode,
              p.business_category, p.opening_time, p.closing_time, p.is_vacation_mode,
              p.verification_status, p.commission_rate, p.upi_id
       FROM users u
       LEFT JOIN seller_profiles p ON u.user_id = p.seller_id
       WHERE u.email = ? OR u.phone = ?
       LIMIT 1`,
      [loginIdentifier, loginIdentifier]
    );

    if (rows.length === 0) {
      const err = new Error("Invalid email/phone or password");
      err.statusCode = 401;
      throw err;
    }

    const seller = rows[0];

    // Must be a seller
    if (seller.role !== "seller") {
      const err = new Error("This account is not registered as a seller");
      err.statusCode = 403;
      throw err;
    }

    // Check account status
    if (seller.status === "suspended") {
      const err = new Error("Your seller account has been suspended. Please contact platform support.");
      err.statusCode = 403;
      throw err;
    }

    if (seller.status === "inactive") {
      const err = new Error("Your seller account is inactive. Please contact support.");
      err.statusCode = 403;
      throw err;
    }

    if (seller.status === "pending") {
      const err = new Error("Your seller application is currently pending admin approval. You will receive an email once approved.");
      err.statusCode = 403;
      throw err;
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, seller.password_hash);
    if (!passwordValid) {
      const err = new Error("Invalid email/phone or password");
      err.statusCode = 401;
      throw err;
    }

    // Update last_login_at
    await connection.query("UPDATE users SET last_login_at = NOW() WHERE user_id = ?", [seller.user_id]);

    const userId = Number(seller.user_id);
    const token = generateToken({
      userId,
      role: "seller"
    });

    return {
      token,
      user: {
        id: userId,
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        role: seller.role,
        status: seller.status
      },
      shop: {
        profileId: seller.profile_id ? Number(seller.profile_id) : null,
        shopName: seller.shop_name || seller.name,
        shopDescription: seller.shop_description,
        shopLogo: seller.shop_logo,
        shopBanner: seller.shop_banner,
        businessEmail: seller.business_email || seller.email,
        businessPhone: seller.business_phone || seller.phone,
        shopAddress: seller.shop_address,
        city: seller.city,
        pincode: seller.pincode,
        businessCategory: seller.business_category,
        openingTime: seller.opening_time,
        closingTime: seller.closing_time,
        isVacationMode: Boolean(seller.is_vacation_mode),
        verificationStatus: seller.verification_status || "verified",
        commissionRate: Number(seller.commission_rate || 5.0),
        upiId: seller.upi_id
      }
    };
  } finally {
    if (connection) connection.release();
  }
}

async function registerSeller(data) {
  const {
    name,
    shopName,
    email,
    phone,
    password,
    shopAddress,
    city = "Kolkata",
    pincode,
    businessCategory = "General Store"
  } = data;

  let connection;

  try {
    connection = await pool.getConnection();

    // Check existing email
    const existingEmail = await connection.query(
      "SELECT user_id FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (existingEmail.length > 0) {
      const err = new Error("An account with this email already exists");
      err.statusCode = 409;
      throw err;
    }

    // Check existing phone
    if (phone) {
      const existingPhone = await connection.query(
        "SELECT user_id FROM users WHERE phone = ? LIMIT 1",
        [phone]
      );
      if (existingPhone.length > 0) {
        const err = new Error("An account with this phone number already exists");
        err.statusCode = 409;
        throw err;
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    await connection.beginTransaction();

    // Insert user with role 'seller' and status 'pending' (requires admin approval)
    const userResult = await connection.query(
      `INSERT INTO users (name, email, phone, password_hash, role, status, email_verified)
       VALUES (?, ?, ?, ?, 'seller', 'pending', 0)`,
      [name, email, phone, passwordHash]
    );

    const newSellerId = Number(userResult.insertId);

    // Create seller profile
    await connection.query(
      `INSERT INTO seller_profiles (
        seller_id, shop_name, business_email, business_phone, shop_address, city, pincode, business_category, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [newSellerId, shopName, email, phone, shopAddress || "", city, pincode || "", businessCategory]
    );

    // Add initial welcome notification
    await connection.query(
      `INSERT INTO seller_notifications (seller_id, title, message, type)
       VALUES (?, ?, ?, 'system')`,
      [
        newSellerId,
        "Welcome to LocalLink Seller Hub!",
        "Your seller registration has been received. Our marketplace administration team will review your shop details shortly. Once approved, you can start listing products and accepting orders!"
      ]
    );

    await connection.commit();

    return {
      userId: newSellerId,
      name,
      shopName,
      email,
      status: "pending",
      message: "Seller registration successful. Your account is pending admin approval."
    };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

async function resetSellerPassword(email, newPassword) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      "SELECT user_id, role FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0 || rows[0].role !== "seller") {
      const err = new Error("No seller account found with that email address");
      err.statusCode = 404;
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await connection.query(
      "UPDATE users SET password_hash = ? WHERE user_id = ?",
      [passwordHash, rows[0].user_id]
    );

    return {
      message: "Password has been successfully updated. You may now log in."
    };
  } finally {
    if (connection) connection.release();
  }
}

async function getSellerProfile(sellerId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `SELECT u.user_id, u.name, u.email, u.phone, u.role, u.status, u.created_at,
              p.profile_id, p.shop_name, p.shop_description, p.shop_logo, p.shop_banner,
              p.business_email, p.business_phone, p.shop_address, p.city, p.pincode,
              p.business_category, p.opening_time, p.closing_time, p.is_vacation_mode,
              p.vacation_message, p.bank_name, p.account_holder_name, p.account_number,
              p.ifsc_code, p.upi_id, p.commission_rate, p.verification_status
       FROM users u
       LEFT JOIN seller_profiles p ON u.user_id = p.seller_id
       WHERE u.user_id = ?
       LIMIT 1`,
      [sellerId]
    );

    if (rows.length === 0) {
      const err = new Error("Seller not found");
      err.statusCode = 404;
      throw err;
    }

    const seller = rows[0];

    // Count unread notifications
    const notifCount = await connection.query(
      "SELECT COUNT(*) AS unread FROM seller_notifications WHERE seller_id = ? AND is_read = 0",
      [sellerId]
    );

    return {
      user: {
        id: Number(seller.user_id),
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        role: seller.role,
        status: seller.status,
        joinedAt: seller.created_at
      },
      shop: {
        profileId: seller.profile_id ? Number(seller.profile_id) : null,
        shopName: seller.shop_name || seller.name,
        shopDescription: seller.shop_description,
        shopLogo: seller.shop_logo,
        shopBanner: seller.shop_banner,
        businessEmail: seller.business_email || seller.email,
        businessPhone: seller.business_phone || seller.phone,
        shopAddress: seller.shop_address,
        city: seller.city,
        pincode: seller.pincode,
        businessCategory: seller.business_category,
        openingTime: seller.opening_time,
        closingTime: seller.closing_time,
        isVacationMode: Boolean(seller.is_vacation_mode),
        vacationMessage: seller.vacation_message,
        bankName: seller.bank_name,
        accountHolderName: seller.account_holder_name,
        accountNumber: seller.account_number ? `****${seller.account_number.slice(-4)}` : null,
        ifscCode: seller.ifsc_code,
        upiId: seller.upi_id,
        commissionRate: Number(seller.commission_rate || 5.0),
        verificationStatus: seller.verification_status || "verified"
      },
      unreadNotifications: Number(notifCount[0]?.unread || 0)
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  loginSeller,
  registerSeller,
  resetSellerPassword,
  getSellerProfile
};
