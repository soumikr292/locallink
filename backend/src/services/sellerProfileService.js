const { pool } = require("../config/database");

// Get seller profile and settings
async function getFullSellerProfile(sellerId) {
  let connection;

  try {
    connection = await pool.getConnection();

    const rows = await connection.query(
      `SELECT
         u.user_id,
         u.name AS owner_name,
         u.email AS account_email,
         u.phone AS account_phone,
         u.avatar_url,
         u.status AS account_status,
         u.created_at AS member_since,
         p.profile_id,
         p.shop_name,
         p.shop_slug,
         p.shop_description,
         p.shop_logo,
         p.shop_banner,
         p.business_email,
         p.business_phone,
         p.shop_address,
         p.city,
         p.pincode,
         p.business_category,
         p.opening_time,
         p.closing_time,
         p.is_vacation_mode,
         p.vacation_message,
         p.bank_name,
         p.account_holder_name,
         p.account_number,
         p.ifsc_code,
         p.upi_id,
         p.commission_rate,
         p.verification_status,
         p.updated_at
       FROM users u
       LEFT JOIN seller_profiles p ON u.user_id = p.seller_id
       WHERE u.user_id = ?
       LIMIT 1`,
      [Number(sellerId)]
    );

    if (rows.length === 0) {
      const error = new Error("Seller profile not found");
      error.statusCode = 404;
      throw error;
    }

    const r = rows[0];

    return {
      ownerName: r.owner_name,
      accountEmail: r.account_email,
      accountPhone: r.account_phone,
      accountStatus: r.account_status,
      avatarUrl: r.avatar_url || r.shop_logo || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      memberSince: r.member_since,
      shop: {
        profileId: r.profile_id ? Number(r.profile_id) : null,
        shopName: r.shop_name || r.owner_name,
        shopSlug: r.shop_slug,
        shopDescription: r.shop_description || "",
        shopLogo: r.shop_logo || r.avatar_url,
        shopBanner: r.shop_banner,
        businessEmail: r.business_email || r.account_email,
        businessPhone: r.business_phone || r.account_phone,
        shopAddress: r.shop_address || "",
        city: r.city || "Kolkata",
        pincode: r.pincode || "",
        businessCategory: r.business_category || "General Store",
        openingTime: r.opening_time || "08:00 AM",
        closingTime: r.closing_time || "10:00 PM",
        isVacationMode: Boolean(r.is_vacation_mode),
        vacationMessage: r.vacation_message || "",
        verificationStatus: r.verification_status || "verified",
        commissionRate: Number(r.commission_rate || 5.0)
      },
      payoutDetails: {
        bankName: r.bank_name || "",
        accountHolderName: r.account_holder_name || "",
        accountNumber: r.account_number || "",
        ifscCode: r.ifsc_code || "",
        upiId: r.upi_id || ""
      }
    };
  } finally {
    if (connection) connection.release();
  }
}

// Update seller profile & store settings
async function updateFullSellerProfile(sellerId, data) {
  let connection;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // 1. Update users table if owner name, phone, or avatar changed
    if (data.ownerName || data.accountPhone || data.avatarUrl || data.shopLogo) {
      const userFields = [];
      const userParams = [];
      if (data.ownerName) {
        userFields.push("name = ?");
        userParams.push(data.ownerName.trim());
      }
      if (data.accountPhone) {
        userFields.push("phone = ?");
        userParams.push(data.accountPhone.trim());
      }
      if (data.avatarUrl || data.shopLogo) {
        userFields.push("avatar_url = ?");
        userParams.push(data.avatarUrl || data.shopLogo);
      }
      if (userFields.length > 0) {
        await connection.query(
          `UPDATE users SET ${userFields.join(", ")} WHERE user_id = ?`,
          [...userParams, Number(sellerId)]
        );
      }
    }

    // 2. Update or insert seller_profiles
    const existing = await connection.query(
      "SELECT profile_id FROM seller_profiles WHERE seller_id = ? LIMIT 1",
      [Number(sellerId)]
    );

    if (existing.length === 0) {
      await connection.query(
        `INSERT INTO seller_profiles (
           seller_id, shop_name, shop_description, shop_logo, shop_banner,
           business_email, business_phone, shop_address, city, pincode,
           business_category, opening_time, closing_time, is_vacation_mode,
           vacation_message, bank_name, account_holder_name, account_number, ifsc_code, upi_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(sellerId),
          data.shopName || "My Local Store",
          data.shopDescription || null,
          data.shopLogo || null,
          data.shopBanner || null,
          data.businessEmail || null,
          data.businessPhone || null,
          data.shopAddress || null,
          data.city || "Kolkata",
          data.pincode || null,
          data.businessCategory || "General Store",
          data.openingTime || "08:00 AM",
          data.closingTime || "10:00 PM",
          data.isVacationMode ? 1 : 0,
          data.vacationMessage || null,
          data.bankName || null,
          data.accountHolderName || null,
          data.accountNumber || null,
          data.ifscCode || null,
          data.upiId || null
        ]
      );
    } else {
      const pFields = [];
      const pParams = [];

      if (data.shopName !== undefined) {
        pFields.push("shop_name = ?");
        pParams.push(data.shopName.trim());
      }
      if (data.shopDescription !== undefined) {
        pFields.push("shop_description = ?");
        pParams.push(data.shopDescription);
      }
      if (data.shopLogo !== undefined) {
        pFields.push("shop_logo = ?");
        pParams.push(data.shopLogo);
      }
      if (data.shopBanner !== undefined) {
        pFields.push("shop_banner = ?");
        pParams.push(data.shopBanner);
      }
      if (data.businessEmail !== undefined) {
        pFields.push("business_email = ?");
        pParams.push(data.businessEmail);
      }
      if (data.businessPhone !== undefined) {
        pFields.push("business_phone = ?");
        pParams.push(data.businessPhone);
      }
      if (data.shopAddress !== undefined) {
        pFields.push("shop_address = ?");
        pParams.push(data.shopAddress);
      }
      if (data.city !== undefined) {
        pFields.push("city = ?");
        pParams.push(data.city);
      }
      if (data.pincode !== undefined) {
        pFields.push("pincode = ?");
        pParams.push(data.pincode);
      }
      if (data.businessCategory !== undefined) {
        pFields.push("business_category = ?");
        pParams.push(data.businessCategory);
      }
      if (data.openingTime !== undefined) {
        pFields.push("opening_time = ?");
        pParams.push(data.openingTime);
      }
      if (data.closingTime !== undefined) {
        pFields.push("closing_time = ?");
        pParams.push(data.closingTime);
      }
      if (data.isVacationMode !== undefined) {
        pFields.push("is_vacation_mode = ?");
        pParams.push(data.isVacationMode ? 1 : 0);
      }
      if (data.vacationMessage !== undefined) {
        pFields.push("vacation_message = ?");
        pParams.push(data.vacationMessage);
      }
      if (data.bankName !== undefined) {
        pFields.push("bank_name = ?");
        pParams.push(data.bankName);
      }
      if (data.accountHolderName !== undefined) {
        pFields.push("account_holder_name = ?");
        pParams.push(data.accountHolderName);
      }
      if (data.accountNumber !== undefined) {
        pFields.push("account_number = ?");
        pParams.push(data.accountNumber);
      }
      if (data.ifscCode !== undefined) {
        pFields.push("ifsc_code = ?");
        pParams.push(data.ifscCode);
      }
      if (data.upiId !== undefined) {
        pFields.push("upi_id = ?");
        pParams.push(data.upiId);
      }

      if (pFields.length > 0) {
        await connection.query(
          `UPDATE seller_profiles SET ${pFields.join(", ")} WHERE seller_id = ?`,
          [...pParams, Number(sellerId)]
        );
      }
    }

    await connection.commit();

    return {
      message: "Store profile & settings saved successfully!"
    };
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getFullSellerProfile,
  updateFullSellerProfile
};
