const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../config/database");
const { generateToken } = require("../utils/jwt");

const router = express.Router();

function getPortalRedirect(role) {
  switch (role) {
    case "customer":
      return { redirectUrl: "customer.html", storageKey: "locallinkCustomerToken", userKey: "locallinkCustomerUser", roleLabel: "Customer Marketplace" };
    case "seller":
      return { redirectUrl: "seller.html", storageKey: "locallinkSellerToken", userKey: "locallinkSellerUser", roleLabel: "Retail Merchant Hub" };
    case "wholesaler":
      return { redirectUrl: "wholesaler.html", storageKey: "locallinkWholesalerToken", userKey: "locallinkWholesalerUser", roleLabel: "Wholesale Mandi Hub" };
    case "delivery_partner":
      return { redirectUrl: "delivery.html", storageKey: "locallinkRiderToken", userKey: "locallinkRiderUser", roleLabel: "Delivery Partner Console" };
    case "staff":
    case "admin":
    case "super_admin":
      return { redirectUrl: "index.html", storageKey: "locallinkAdminToken", userKey: "locallinkAdminUser", roleLabel: "Admin & Operations Control Center" };
    default:
      return { redirectUrl: "customer.html", storageKey: "locallinkCustomerToken", userKey: "locallinkCustomerUser", roleLabel: "Customer Marketplace" };
  }
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  let connection;
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Email/Phone and password are required." });
    }

    const cleanId = String(identifier).trim();
    connection = await pool.getConnection();

    const rows = await connection.query(
      `SELECT user_id, name, email, phone, password_hash, role, status
       FROM users
       WHERE (LOWER(email) = LOWER(?) OR phone = ?)
       LIMIT 1`,
      [cleanId, cleanId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Account not found with this email or phone." });
    }

    const user = rows[0];

    if (user.status === "inactive" || user.status === "suspended") {
      return res.status(403).json({ success: false, message: `Your account is currently ${user.status}. Please contact administrator.` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Incorrect password. Please verify and try again." });
    }

    // Update last login
    await connection.query("UPDATE users SET last_login_at = NOW() WHERE user_id = ?", [user.user_id]);

    const userId = Number(user.user_id);
    const token = generateToken({
      userId,
      role: user.role,
      email: user.email,
      name: user.name
    });

    const portal = getPortalRedirect(user.role);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}! Accessing ${portal.roleLabel}...`,
      data: {
        token,
        user: {
          id: userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        },
        ...portal
      }
    });
  } catch (error) {
    console.error("Unified login error:", error);
    return res.status(500).json({ success: false, message: "Authentication server error. Please try again." });
  } finally {
    if (connection) connection.release();
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  let connection;
  try {
    const {
      name,
      email,
      phone,
      password,
      role = "customer",
      shopName,
      shopAddress,
      city = "Sonarpur",
      vehicleType = "Motorcycle"
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    const validRoles = ["customer", "seller", "wholesaler", "delivery_partner", "staff", "admin"];
    const targetRole = validRoles.includes(role) ? role : "customer";

    connection = await pool.getConnection();

    // Check if email already exists
    const existing = await connection.query("SELECT user_id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [email.trim()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "An account with this email address already exists. Please sign in." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const userRes = await connection.query(
      `INSERT INTO users (name, email, phone, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [name.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, passwordHash, targetRole]
    );

    const userId = Number(userRes.insertId);

    // Role-specific setup
    if (targetRole === "seller" || targetRole === "wholesaler") {
      const generatedSlug = (shopName || name).toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString().slice(-4);
      await connection.query(
        `INSERT INTO seller_profiles (seller_id, shop_name, shop_slug, shop_address, city, business_category, verification_status)
         VALUES (?, ?, ?, ?, ?, ?, 'verified')`,
        [
          userId,
          shopName ? shopName.trim() : `${name}'s ${targetRole === 'wholesaler' ? 'Wholesale Mandi' : 'Daily Stall'}`,
          generatedSlug,
          shopAddress ? shopAddress.trim() : "Sonarpur Daily Bazaar",
          city,
          targetRole === "wholesaler" ? "Wholesale Mandi" : "Retail Bazaar"
        ]
      );
    } else if (targetRole === "delivery_partner") {
      await connection.query(
        `INSERT INTO delivery_partners (user_id, vehicle_type, vehicle_number, driving_license, status, is_available)
         VALUES (?, ?, 'WB-01-APP', 'DL-PENDING', 'approved', 1)`,
        [userId, vehicleType]
      );
    }

    const token = generateToken({
      userId,
      role: targetRole,
      email: email.trim().toLowerCase(),
      name: name.trim()
    });

    const portal = getPortalRedirect(targetRole);

    return res.status(201).json({
      success: true,
      message: `Account created successfully! Welcome to LocalLink as a ${portal.roleLabel}.`,
      data: {
        token,
        user: {
          id: userId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone ? phone.trim() : null,
          role: targetRole
        },
        ...portal
      }
    });
  } catch (error) {
    console.error("Unified register error:", error);
    return res.status(500).json({ success: false, message: "Registration failed: " + (error.message || "Server error") });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/auth/demo-accounts
router.get("/demo-accounts", (req, res) => {
  res.status(200).json({
    success: true,
    data: [
      {
        role: "customer",
        label: "Customer / Buyer",
        badge: "Household Shopper",
        email: "amit.sen@example.com",
        password: "Customer@123",
        icon: "fa-bag-shopping",
        color: "emerald",
        targetPortal: "Customer Marketplace (customer.html)"
      },
      {
        role: "seller",
        label: "Retail Stall Seller",
        badge: "Daily Wet Bazaar Merchant",
        email: "testseller@locallink.com",
        password: "Seller@123",
        icon: "fa-store",
        color: "amber",
        targetPortal: "Seller Hub (seller.html)"
      },
      {
        role: "wholesaler",
        label: "Wholesale Mandi Supplier",
        badge: "Bulk Stockist & Mandi Trader",
        email: "wholesaler@locallink.com",
        password: "Wholesale@123",
        icon: "fa-boxes-packing",
        color: "orange",
        targetPortal: "Wholesale Mandi Hub (wholesaler.html)"
      },
      {
        role: "delivery_partner",
        label: "Delivery Partner",
        badge: "Neighborhood Dispatch Fleet",
        email: "kamal@locallink.com",
        password: "Rider@123",
        icon: "fa-motorcycle",
        color: "sky",
        targetPortal: "Rider Console (delivery.html)"
      },
      {
        role: "staff",
        label: "Market Operations Staff",
        badge: "Floor Supervisor & Support",
        email: "staff@locallink.com",
        password: "Admin@12345678",
        icon: "fa-clipboard-user",
        color: "indigo",
        targetPortal: "Operations Hub (index.html)"
      },
      {
        role: "admin",
        label: "Platform Super Admin",
        badge: "Municipal Control & Governance",
        email: "superadmin123@gmail.com",
        password: "Admin@12345678",
        icon: "fa-shield-halved",
        color: "purple",
        targetPortal: "Admin Center (index.html)"
      }
    ]
  });
});

module.exports = router;
