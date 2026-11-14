const { pool } = require("../config/database");
const { generateToken } = require("../utils/jwt");
const bcrypt = require("bcryptjs");

// Proximity / distance calculator based on customer locality & market stall location
function calculateMarketplaceProximity(customerLocality = "", shopAddress = "", shopCity = "") {
  const normCustomer = (customerLocality || "").toLowerCase().trim();
  const normShop = `${shopAddress || ""} ${shopCity || ""}`.toLowerCase().trim();

  let distanceKm = 1.2;
  let deliveryTime = "15-20 mins";
  let isNearby = true;

  if (normCustomer.includes("rajpur")) {
    if (normShop.includes("rajpur")) {
      distanceKm = 0.6;
      deliveryTime = "10-12 mins";
      isNearby = true;
    } else if (normShop.includes("sonarpur")) {
      distanceKm = 1.8;
      deliveryTime = "15-18 mins";
      isNearby = true;
    } else if (normShop.includes("garia") || normShop.includes("mahamayatala")) {
      distanceKm = 5.4;
      deliveryTime = "30-35 mins";
      isNearby = false;
    } else {
      distanceKm = 9.5;
      deliveryTime = "45 mins";
      isNearby = false;
    }
  } else if (normCustomer.includes("sonarpur")) {
    if (normShop.includes("sonarpur")) {
      distanceKm = 0.4;
      deliveryTime = "8-10 mins";
      isNearby = true;
    } else if (normShop.includes("rajpur")) {
      distanceKm = 1.6;
      deliveryTime = "15-18 mins";
      isNearby = true;
    } else if (normShop.includes("garia") || normShop.includes("mahamayatala")) {
      distanceKm = 4.2;
      deliveryTime = "25-30 mins";
      isNearby = false;
    } else {
      distanceKm = 10.2;
      deliveryTime = "50 mins";
      isNearby = false;
    }
  } else if (normCustomer.includes("garia") || normCustomer.includes("mahamayatala")) {
    if (normShop.includes("garia") || normShop.includes("mahamayatala")) {
      distanceKm = 0.8;
      deliveryTime = "12-15 mins";
      isNearby = true;
    } else if (normShop.includes("sonarpur")) {
      distanceKm = 4.0;
      deliveryTime = "25 mins";
      isNearby = true;
    } else if (normShop.includes("rajpur")) {
      distanceKm = 5.2;
      deliveryTime = "30 mins";
      isNearby = false;
    } else {
      distanceKm = 8.5;
      deliveryTime = "40 mins";
      isNearby = false;
    }
  } else {
    // Default Rajpur Sonarpur municipal market hub
    if (normShop.includes("rajpur") || normShop.includes("sonarpur")) {
      distanceKm = 1.2;
      deliveryTime = "15 mins";
      isNearby = true;
    } else {
      distanceKm = 4.8;
      deliveryTime = "28 mins";
      isNearby = true;
    }
  }

  return { distanceKm, deliveryTime, isNearby };
}

// 1. Customer Authentication (Strict bcrypt auth + explicit demo:true support)
async function authenticateCustomer({ email, phone, password, demo = false }) {
  let conn;
  try {
    conn = await pool.getConnection();

    let user;
    if (demo === true) {
      const rows = await conn.query("SELECT * FROM users WHERE email = 'tanvir@locallink.com' AND role = 'customer' LIMIT 1");
      if (rows.length > 0) {
        user = rows[0];
      } else {
        const hash = await bcrypt.hash("customer123", 10);
        const ins = await conn.query(
          `INSERT INTO users (name, email, phone, password_hash, role, status, email_verified, address, locality, city, pincode, avatar_url)
           VALUES ('Tanvir Ahmed', 'tanvir@locallink.com', '9876543211', ?, 'customer', 'active', 1,
                   'House #42, Main Road, Rajpur Block C', 'Rajpur Block C', 'Rajpur Sonarpur', '700149',
                   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80')`,
          [hash]
        );
        user = {
          user_id: Number(ins.insertId),
          name: "Tanvir Ahmed",
          email: "tanvir@locallink.com",
          phone: "9876543211",
          role: "customer",
          address: "House #42, Main Road, Rajpur Block C",
          locality: "Rajpur Block C",
          city: "Rajpur Sonarpur",
          pincode: "700149",
          avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        };
      }
    } else {
      const identifier = (email || phone || "").trim();
      if (!identifier || !password) {
        const err = new Error("Email/phone and password are required");
        err.statusCode = 400;
        throw err;
      }

      const rows = await conn.query(
        "SELECT * FROM users WHERE (email = ? OR phone = ?) AND role = 'customer' LIMIT 1",
        [identifier.toLowerCase(), identifier]
      );

      if (rows.length === 0) {
        const err = new Error("Invalid customer email/phone or password");
        err.statusCode = 401;
        throw err;
      }

      user = rows[0];
      if (user.status && user.status !== "active") {
        const err = new Error("This customer account is currently inactive");
        err.statusCode = 403;
        throw err;
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        const err = new Error("Invalid customer email/phone or password");
        err.statusCode = 401;
        throw err;
      }
    }

    const token = generateToken({
      userId: Number(user.user_id),
      role: "customer",
      email: user.email,
      name: user.name
    });

    return {
      token,
      user: {
        id: Number(user.user_id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: "customer",
        avatarUrl: user.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
        address: user.address || "House #42, Main Road, Rajpur Block C",
        locality: user.locality || "Rajpur Block C",
        city: user.city || "Rajpur Sonarpur",
        pincode: user.pincode || "700149"
      }
    };
  } finally {
    if (conn) conn.release();
  }
}

// 1b. Customer Registration
async function registerCustomer({ name, email, phone, password, address, locality, city, pincode, avatarUrl }) {
  let conn;
  try {
    if (!name || !name.trim() || !email || !email.trim()) {
      const err = new Error("Full name and email address are required.");
      err.statusCode = 400;
      throw err;
    }
    if (!password || String(password).length < 6) {
      const err = new Error("Password must be at least 6 characters long.");
      err.statusCode = 400;
      throw err;
    }

    conn = await pool.getConnection();

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone ? phone.trim() : null;
    const existing = cleanPhone
      ? await conn.query("SELECT user_id FROM users WHERE email = ? OR phone = ? LIMIT 1", [cleanEmail, cleanPhone])
      : await conn.query("SELECT user_id FROM users WHERE email = ? LIMIT 1", [cleanEmail]);

    if (existing.length > 0) {
      const err = new Error("An account already exists with this email or phone number.");
      err.statusCode = 409;
      throw err;
    }

    const hash = await bcrypt.hash(String(password), 10);
    const resolvedAvatar = avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";
    const resolvedAddress = address || "Rajpur Bazaar Main Road";
    const resolvedLocality = locality || "Rajpur";
    const resolvedCity = city || "Rajpur Sonarpur";
    const resolvedPincode = pincode || "700149";

    const ins = await conn.query(
      `INSERT INTO users (name, email, phone, password_hash, role, status, email_verified, address, locality, city, pincode, avatar_url)
       VALUES (?, ?, ?, ?, 'customer', 'active', 1, ?, ?, ?, ?, ?)`,
      [name.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, hash, resolvedAddress, resolvedLocality, resolvedCity, resolvedPincode, resolvedAvatar]
    );

    const userId = Number(ins.insertId);
    const token = generateToken({
      userId,
      role: "customer",
      email: email.trim().toLowerCase(),
      name: name.trim()
    });

    return {
      token,
      user: {
        id: userId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        role: "customer",
        avatarUrl: resolvedAvatar,
        address: resolvedAddress,
        locality: resolvedLocality,
        city: resolvedCity,
        pincode: resolvedPincode
      }
    };
  } finally {
    if (conn) conn.release();
  }
}

// 1c. Get Customer Profile & Stats
async function getCustomerProfile(userId) {
  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      `SELECT user_id, name, email, phone, role, status, avatar_url, address, locality, city, pincode, created_at
       FROM users WHERE user_id = ? LIMIT 1`,
      [Number(userId)]
    );

    if (rows.length === 0) {
      const err = new Error("Customer profile not found");
      err.statusCode = 404;
      throw err;
    }

    const u = rows[0];

    const statsRows = await conn.query(
      `SELECT
         COUNT(*) AS total_orders,
         COALESCE(SUM(total_amount), 0) AS total_spent,
         COUNT(CASE WHEN order_status IN ('confirmed', 'processing', 'out_for_delivery') THEN 1 END) AS active_orders
       FROM orders WHERE customer_id = ?`,
      [Number(userId)]
    );

    const stats = statsRows[0] || { total_orders: 0, total_spent: 0, active_orders: 0 };

    return {
      id: Number(u.user_id),
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      avatarUrl: u.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      address: u.address || "House #42, Main Road, Rajpur Block C",
      locality: u.locality || "Rajpur Block C",
      city: u.city || "Rajpur Sonarpur",
      pincode: u.pincode || "700149",
      memberSince: u.created_at,
      stats: {
        totalOrders: Number(stats.total_orders || 0),
        totalSpent: Number(stats.total_spent || 0),
        activeOrders: Number(stats.active_orders || 0)
      }
    };
  } finally {
    if (conn) conn.release();
  }
}

// 1d. Update Customer Profile & Address
async function updateCustomerProfile(userId, data) {
  let conn;
  try {
    conn = await pool.getConnection();

    const fields = [];
    const params = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      params.push(data.name.trim());
    }
    if (data.phone !== undefined) {
      fields.push("phone = ?");
      params.push(data.phone.trim());
    }
    if (data.avatarUrl !== undefined) {
      fields.push("avatar_url = ?");
      params.push(data.avatarUrl);
    }
    if (data.address !== undefined) {
      fields.push("address = ?");
      params.push(data.address.trim());
    }
    if (data.locality !== undefined) {
      fields.push("locality = ?");
      params.push(data.locality.trim());
    }
    if (data.city !== undefined) {
      fields.push("city = ?");
      params.push(data.city.trim());
    }
    if (data.pincode !== undefined) {
      fields.push("pincode = ?");
      params.push(data.pincode.trim());
    }

    if (fields.length > 0) {
      await conn.query(
        `UPDATE users SET ${fields.join(", ")} WHERE user_id = ?`,
        [...params, Number(userId)]
      );
    }

    return await getCustomerProfile(userId);
  } finally {
    if (conn) conn.release();
  }
}

// 2. Fetch Catalog Products with filter, search, and local store proximity
async function getCustomerProducts({ category, search, locality, city, address, nearbyOnly = false, limit = 100 }) {
  let conn;
  try {
    conn = await pool.getConnection();

    const conditions = ["p.status = 'active'"];
    const params = [];

    if (category && category !== "all") {
      if (category === "fish") {
        conditions.push("(p.category_id IN (4, 12, 13, 14) OR LOWER(p.name) LIKE '%fish%' OR LOWER(p.name) LIKE '%katla%' OR LOWER(p.name) LIKE '%rohu%')");
      } else if (category === "vegetables") {
        conditions.push("(p.category_id IN (2, 15, 35) OR LOWER(p.name) LIKE '%potato%' OR LOWER(p.name) LIKE '%veg%' OR LOWER(p.name) LIKE '%palak%')");
      } else if (category === "grocery") {
        conditions.push("(p.category_id IN (1, 16, 17, 18, 19, 20) OR LOWER(p.name) LIKE '%rice%' OR LOWER(p.name) LIKE '%oil%' OR LOWER(p.name) LIKE '%turmeric%' OR LOWER(p.name) LIKE '%maida%')");
      } else if (!isNaN(Number(category))) {
        conditions.push("p.category_id = ?");
        params.push(Number(category));
      }
    }

    if (search && search.trim()) {
      const synonymMap = {
        mach: "fish",
        macher: "fish",
        alu: "potato",
        aloo: "potato",
        tel: "oil",
        chal: "rice",
        chawal: "rice",
        dim: "egg",
        deem: "egg",
        murgi: "chicken",
        ghee: "ghee",
        noon: "salt",
        lobon: "salt",
        dal: "dal",
        daal: "dal"
      };

      const rawSearch = search.trim().toLowerCase();
      // Separate glued units like 1kg -> 1 kg, 500g -> 500 g, 1l -> 1 l, remove punctuation
      const separated = rawSearch.replace(/(\d+)(kg|g|gm|l|ml|ltr)/gi, "$1 $2");
      const cleanedSearch = separated.replace(/[()[\]{}.,+_-]/g, " ");
      const words = cleanedSearch.split(/\s+/).filter(Boolean);

      if (words.length > 0) {
        for (const word of words) {
          const synonym = synonymMap[word];
          if (synonym) {
            const q1 = `%${word}%`;
            const q2 = `%${synonym}%`;
            conditions.push(`(
              LOWER(p.name) LIKE ? OR LOWER(p.name) LIKE ? OR
              LOWER(COALESCE(p.description, '')) LIKE ? OR LOWER(COALESCE(p.description, '')) LIKE ? OR
              LOWER(COALESCE(p.brand, '')) LIKE ? OR LOWER(COALESCE(p.brand, '')) LIKE ? OR
              LOWER(COALESCE(sp.shop_name, '')) LIKE ? OR
              LOWER(COALESCE(c.name, '')) LIKE ? OR LOWER(COALESCE(c.name, '')) LIKE ?
            )`);
            params.push(q1, q2, q1, q2, q1, q2, q1, q1, q2);
          } else {
            const q = `%${word}%`;
            conditions.push(`(
              LOWER(p.name) LIKE ? OR
              LOWER(COALESCE(p.description, '')) LIKE ? OR
              LOWER(COALESCE(p.brand, '')) LIKE ? OR
              LOWER(COALESCE(sp.shop_name, '')) LIKE ? OR
              LOWER(COALESCE(c.name, '')) LIKE ?
            )`);
            params.push(q, q, q, q, q);
          }
        }
      }
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await conn.query(
      `SELECT
         p.product_id,
         p.seller_id,
         p.name,
         p.slug,
         p.description,
         p.price,
         p.discount_price,
         p.stock_quantity,
         p.brand,
         p.category_id,
         c.name AS category_name,
         p.image_url,
         p.created_at,
         COALESCE(sp.shop_name, 'Local Vendor Stall') AS shop_name,
         COALESCE(sp.shop_address, 'Sonarpur Market') AS shop_address,
         COALESCE(sp.city, 'Rajpur Sonarpur') AS city,
         sp.shop_logo
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.category_id
       LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
       ${whereSql}
       ORDER BY p.product_id DESC
       LIMIT ?`,
      [...params, Number(limit) || 100]
    );

    const activeLocality = locality || address || "Rajpur";

    const mapped = rows.map(r => {
      const catLower = (r.category_name || "").toLowerCase();
      const nameLower = r.name.toLowerCase();
      const isFishOrVeg = [4, 12, 13, 14, 2, 15, 35].includes(Number(r.category_id)) ||
                          nameLower.includes("fish") || nameLower.includes("katla") ||
                          nameLower.includes("potato") || nameLower.includes("vegetable");

      let categoryKey = "grocery";
      if (catLower.includes("fish") || nameLower.includes("fish") || nameLower.includes("katla")) categoryKey = "fish";
      else if (catLower.includes("veg") || nameLower.includes("potato") || nameLower.includes("carrot")) categoryKey = "vegetables";

      const proximity = calculateMarketplaceProximity(activeLocality, r.shop_address, r.city);

      return {
        id: Number(r.product_id),
        sellerId: Number(r.seller_id),
        name: r.name,
        slug: r.slug,
        description: r.description || "Fresh local marketplace quality guaranteed.",
        price: Number(r.price),
        discountPrice: r.discount_price ? Number(r.discount_price) : null,
        stockQuantity: Number(r.stock_quantity),
        brand: r.brand || "Local Fresh",
        categoryId: r.category_id ? Number(r.category_id) : null,
        categoryName: r.category_name || "Daily Essentials",
        categoryKey,
        imageUrl: r.image_url,
        isLivePhoto: isFishOrVeg,
        shopName: r.shop_name,
        shopAddress: r.shop_address,
        shopLogo: r.shop_logo,
        city: r.city,
        distanceKm: proximity.distanceKm,
        deliveryTime: proximity.deliveryTime,
        isNearby: proximity.isNearby
      };
    });

    // If nearbyOnly is requested, filter to nearby stores only (distance <= 5.0 km)
    let filtered = mapped;
    if (nearbyOnly === true || nearbyOnly === "true") {
      filtered = mapped.filter(p => p.isNearby || p.distanceKm <= 5.0);
      if (filtered.length === 0) {
        filtered = mapped; // fallback to show marketplace catalog
      }
    }

    // Sort by nearest distance first
    filtered.sort((a, b) => a.distanceKm - b.distanceKm);

    return filtered;
  } finally {
    if (conn) conn.release();
  }
}

// 3. Multi-Store Price Comparison (searches across stalls for single item or all products)
async function getCompareItems(itemName = "") {
  let conn;
  try {
    conn = await pool.getConnection();

    const queryTerm = (itemName || "").trim().toLowerCase();
    let rows = [];

    if (!queryTerm || queryTerm === "all" || queryTerm === "compare") {
      // Return broad catalog comparison across vendors
      rows = await conn.query(
        `SELECT
           p.product_id,
           p.seller_id,
           p.name,
           p.price,
           p.discount_price,
           p.stock_quantity,
           p.image_url,
           c.name AS category_name,
           COALESCE(sp.shop_name, 'Local Vendor Stall') AS shop_name,
           COALESCE(sp.shop_address, 'Sonarpur Daily Market') AS shop_address,
           COALESCE(sp.city, 'Rajpur Sonarpur') AS city,
           COALESCE(AVG(r.rating), 4.8) AS avg_rating,
           COUNT(r.review_id) AS review_count
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.category_id
         LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
         LEFT JOIN reviews r ON p.product_id = r.product_id
         WHERE p.status = 'active'
         GROUP BY p.product_id
         ORDER BY p.price ASC
         LIMIT 30`
      );
    } else {
      // Search matching term across product name, description, brand, or category
      const searchTerm = `%${queryTerm}%`;
      rows = await conn.query(
        `SELECT
           p.product_id,
           p.seller_id,
           p.name,
           p.price,
           p.discount_price,
           p.stock_quantity,
           p.image_url,
           c.name AS category_name,
           COALESCE(sp.shop_name, 'Local Vendor Stall') AS shop_name,
           COALESCE(sp.shop_address, 'Sonarpur Daily Market') AS shop_address,
           COALESCE(sp.city, 'Rajpur Sonarpur') AS city,
           COALESCE(AVG(r.rating), 4.8) AS avg_rating,
           COUNT(r.review_id) AS review_count
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.category_id
         LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
         LEFT JOIN reviews r ON p.product_id = r.product_id
         WHERE (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(c.name) LIKE ?) AND p.status = 'active'
         GROUP BY p.product_id
         ORDER BY p.price ASC
         LIMIT 30`,
        [searchTerm, searchTerm, searchTerm]
      );

      // If no direct matches, split query words (e.g. "katla fish 1kg" -> search "katla")
      if (rows.length === 0) {
        const words = queryTerm.split(/\s+/).filter(w => w.length > 2);
        for (const w of words) {
          const wTerm = `%${w}%`;
          const subRows = await conn.query(
            `SELECT
               p.product_id,
               p.seller_id,
               p.name,
               p.price,
               p.discount_price,
               p.stock_quantity,
               p.image_url,
               c.name AS category_name,
               COALESCE(sp.shop_name, 'Local Vendor Stall') AS shop_name,
               COALESCE(sp.shop_address, 'Sonarpur Daily Market') AS shop_address,
               COALESCE(sp.city, 'Rajpur Sonarpur') AS city,
               4.8 AS avg_rating,
               10 AS review_count
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.category_id
             LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
             WHERE LOWER(p.name) LIKE ? AND p.status = 'active'
             GROUP BY p.product_id
             ORDER BY p.price ASC
             LIMIT 15`,
            [wTerm]
          );
          if (subRows.length > 0) {
            rows.push(...subRows);
            break;
          }
        }
      }
    }

    const minPrice = rows.length > 0 ? Math.min(...rows.map(r => Number(r.price))) : 0;

    return rows.map((r, index) => {
      const price = Number(r.price);
      return {
        productId: Number(r.product_id),
        sellerId: Number(r.seller_id),
        name: r.name,
        price,
        discountPrice: r.discount_price ? Number(r.discount_price) : null,
        stockQuantity: Number(r.stock_quantity),
        categoryName: r.category_name || "Market Item",
        shopName: r.shop_name || `Stall #${r.seller_id || index + 1}`,
        shopAddress: r.shop_address || "Sonarpur Daily Market",
        distanceKm: Number((0.4 + (index % 5) * 0.3).toFixed(1)),
        rating: Number(Number(r.avg_rating || 4.8).toFixed(1)),
        reviewCount: Number(r.review_count || 10),
        isLowestPrice: price === minPrice,
        imageUrl: r.image_url
      };
    });
  } finally {
    if (conn) conn.release();
  }
}

// 4. AI Bargain Negotiation Logic (Resilient product matching)
async function processBargainOffer({ productId, offerPrice, customerMessage }) {
  let conn;
  try {
    conn = await pool.getConnection();

    let rows = [];
    if (productId && Number(productId) > 0) {
      rows = await conn.query(
        `SELECT p.product_id, p.name, p.price, p.discount_price, sp.shop_name
         FROM products p
         LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
         WHERE p.product_id = ? AND p.status = 'active' LIMIT 1`,
        [Number(productId)]
      );
    }

    // If not found by ID, try finding by keywords from customer message or product name
    if (rows.length === 0) {
      const msg = (customerMessage || "").toLowerCase();
      let term = "";
      if (msg.includes("fish") || msg.includes("katla") || msg.includes("rohu")) term = "fish";
      else if (msg.includes("potato") || msg.includes("aloo")) term = "potato";
      else if (msg.includes("rice")) term = "rice";
      else if (msg.includes("oil")) term = "oil";
      else if (msg.includes("tea")) term = "tea";
      else if (msg.includes("milk")) term = "milk";

      if (term) {
        rows = await conn.query(
          `SELECT p.product_id, p.name, p.price, p.discount_price, sp.shop_name
           FROM products p
           LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
           WHERE LOWER(p.name) LIKE ? AND p.status = 'active' LIMIT 1`,
          [`%${term}%`]
        );
      }
    }

    // Fallback to first available active product so bargain never fails
    if (rows.length === 0) {
      rows = await conn.query(
        `SELECT p.product_id, p.name, p.price, p.discount_price, sp.shop_name
         FROM products p
         LEFT JOIN seller_profiles sp ON p.seller_id = sp.seller_id
         WHERE p.status = 'active'
         ORDER BY p.product_id ASC LIMIT 1`
      );
    }

    if (rows.length === 0) {
      const err = new Error("No active products available for bargaining right now.");
      err.statusCode = 404;
      throw err;
    }

    const p = rows[0];
    const regularPrice = Number(p.price);
    // Minimum acceptable floor price: either discount_price set by vendor or 85% of regular price
    const floorPrice = p.discount_price ? Number(p.discount_price) : Math.round(regularPrice * 0.85);

    const userOffer = Number(offerPrice);

    if (isNaN(userOffer) || userOffer <= 0) {
      return {
        status: "invalid",
        product: {
          id: Number(p.product_id),
          name: p.name,
          regularPrice,
          shopName: p.shop_name || "Sonarpur Market Vendor"
        },
        message: `Please state your offer price in ₹ (e.g. type "₹${Math.round(regularPrice * 0.9)}").`
      };
    }

    if (userOffer >= floorPrice) {
      // ACCEPTED DEAL!
      const agreedPrice = Math.min(userOffer, regularPrice);
      return {
        status: "accepted",
        product: {
          id: Number(p.product_id),
          name: p.name,
          regularPrice,
          agreedPrice,
          shopName: p.shop_name || "Sonarpur Market Vendor"
        },
        agreedPrice,
        message: `Deal locked! I checked with vendor ${p.shop_name || 'Stall #14'}. Your offer of ₹${agreedPrice} meets their allowable floor price! Proceed to checkout to lock in this special rate.`
      };
    } else {
      // COUNTER OFFER
      const counterPrice = Math.round(floorPrice + (regularPrice - floorPrice) * 0.3);
      return {
        status: "counter",
        product: {
          id: Number(p.product_id),
          name: p.name,
          regularPrice,
          shopName: p.shop_name || "Sonarpur Market Vendor"
        },
        counterPrice,
        floorPrice,
        message: `₹${userOffer} is below the vendor's floor limit. The vendor cannot sell below cost, but I can autonomously approve a counter-offer of ₹${counterPrice} (saved ₹${regularPrice - counterPrice}). Would that work for you?`
      };
    }
  } finally {
    if (conn) conn.release();
  }
}

// 5. Create Customer Order
async function createCustomerOrder(customerId, orderData) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const {
      items = [],
      deliveryAddress = "House #42, Main Road, Rajpur Block C",
      customerPhone = "9876543211",
      customerNote = "",
      paymentMethod = "upi",
      paymentStatus = "paid",
      transactionId = null
    } = orderData;

    if (!items || items.length === 0) {
      const err = new Error("Cart is empty");
      err.statusCode = 400;
      throw err;
    }

    let subtotal = 0;
    const resolvedItems = [];
    let primarySellerId = 3;

    for (const item of items) {
      const pid = Number(item.productId ?? item.id);
      if (!Number.isInteger(pid) || pid <= 0) continue;

      const pRows = await conn.query(
        "SELECT product_id, seller_id, name, sku, price, discount_price, stock_quantity FROM products WHERE product_id = ? LIMIT 1",
        [pid]
      );

      if (pRows.length === 0) continue;
      const p = pRows[0];
      primarySellerId = Number(p.seller_id) || primarySellerId;

      const qty = Math.max(1, Number(item.quantity) || 1);
      // If customer negotiated an agreedPrice, honor it; otherwise regular price
      const unitPrice = Number(p.price);
      const agreedPrice = item.agreedPrice !== undefined && item.agreedPrice !== null
        ? Number(item.agreedPrice)
        : unitPrice;
      const finalPrice = Number((agreedPrice * qty).toFixed(2));
      subtotal += finalPrice;

      resolvedItems.push({
        productId: Number(p.product_id),
        sellerId: Number(p.seller_id),
        name: p.name,
        sku: p.sku || `SKU-${p.product_id}`,
        quantity: qty,
        unitPrice,
        agreedPrice,
        finalPrice
      });
    }

    if (resolvedItems.length === 0) {
      const err = new Error("No valid marketplace products found in order");
      err.statusCode = 400;
      throw err;
    }

    const deliveryCharge = subtotal >= 500 ? 0 : 30.00;
    const totalAmount = Number((subtotal + deliveryCharge).toFixed(2));
    const orderNumber = `LL-${Math.floor(1000 + Math.random() * 9000)}`;

    const validMethod = ["cod", "upi", "card", "net_banking", "wallet"].includes(paymentMethod) ? paymentMethod : "upi";
    const finalPaymentStatus = validMethod === "cod" ? "pending" : (paymentStatus || "paid");
    const txnId = transactionId || `TXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // Insert Order with initial 'pending' status awaiting seller approval
    const insOrder = await conn.query(
      `INSERT INTO orders (
         customer_id, order_number, subtotal, delivery_charge, discount_amount,
         total_amount, order_status, payment_status, fulfillment_type,
         delivery_address, customer_note
       ) VALUES (?, ?, ?, ?, 0.00, ?, 'pending', ?, 'delivery', ?, ?)`,
      [customerId, orderNumber, subtotal, deliveryCharge, totalAmount, finalPaymentStatus, deliveryAddress, customerNote]
    );

    const orderId = Number(insOrder.insertId);

    // Record entry in payments table
    try {
      await conn.query(
        `INSERT INTO payments (
           order_id, customer_id, payment_reference, payment_method, amount, payment_status, transaction_id, paid_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ${finalPaymentStatus === 'paid' ? 'NOW()' : 'NULL'})`,
        [orderId, customerId, `PAY_${orderNumber}`, validMethod, totalAmount, finalPaymentStatus, txnId]
      );
    } catch (payErr) {
      console.warn("Payment recording note (non-fatal):", payErr.message);
    }

    // Insert Order Items
    for (const item of resolvedItems) {
      await conn.query(
        `INSERT INTO order_items (
           order_id, product_id, seller_id, product_name, sku,
           quantity, unit_price, agreed_price, discount_amount, final_price
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?)`,
        [orderId, item.productId, item.sellerId, item.name, item.sku, item.quantity, item.unitPrice, item.agreedPrice, item.finalPrice]
      );
    }

    // Get seller shop address
    const sp = await conn.query("SELECT shop_name, shop_address FROM seller_profiles WHERE seller_id = ? LIMIT 1", [primarySellerId]);
    const shopName = sp.length > 0 && sp[0].shop_name ? sp[0].shop_name : "Sonarpur Central Hub";
    const shopAddress = sp.length > 0 && sp[0].shop_address ? sp[0].shop_address : "Sonarpur Market";
    const pickupAddr = `${shopName}, ${shopAddress}`;
    const pickupLat = 22.4390;
    const pickupLng = 88.3965;
    const otp = `${Math.floor(1000 + Math.random() * 9000)}`;

    // Insert Deliveries entry as unassigned ('pending') awaiting seller approval and rider pickup
    await conn.query(
      `INSERT INTO deliveries (
         order_id, delivery_partner_id, pickup_address, customer_address,
         customer_phone, delivery_status, pickup_latitude, pickup_longitude,
         customer_latitude, customer_longitude, delivery_instructions,
         estimated_distance_km, estimated_duration_minutes, delivery_otp
       ) VALUES (?, NULL, ?, ?, ?, 'pending', ?, ?, 22.4460, 88.4020, ?, 1.8, 12, ?)`,
      [orderId, pickupAddr, deliveryAddress, customerPhone, pickupLat, pickupLng, customerNote || "Standard express delivery", otp]
    );

    await conn.commit();

    return {
      orderId,
      orderNumber,
      totalAmount,
      deliveryCharge,
      orderStatus: "pending",
      paymentStatus: finalPaymentStatus,
      paymentMethod: validMethod,
      transactionId: txnId,
      deliveryOtp: otp,
      itemCount: resolvedItems.length,
      assignedRider: null,
      message: "Order placed successfully! Sent to seller for approval."
    };
  } catch (err) {
    if (conn) await conn.rollback();
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// 6. Get Customer Orders with live delivery info
async function getCustomerOrders(customerId) {
  let conn;
  try {
    conn = await pool.getConnection();

    const orders = await conn.query(
      `SELECT
         o.order_id,
         o.order_number,
         o.subtotal,
         o.delivery_charge,
         o.discount_amount,
         o.total_amount,
         o.order_status,
         o.payment_status,
         o.delivery_address,
         o.customer_note,
         o.created_at,
         d.delivery_id,
         d.delivery_status,
         d.delivery_otp,
         d.estimated_distance_km,
         d.estimated_duration_minutes,
         d.pickup_latitude,
         d.pickup_longitude,
         d.customer_latitude,
         d.customer_longitude,
         d.pickup_address,
         u_rider.name AS rider_name,
         u_rider.phone AS rider_phone,
         dp.vehicle_type,
         dp.vehicle_number,
         dp.current_latitude AS rider_latitude,
         dp.current_longitude AS rider_longitude
       FROM orders o
       LEFT JOIN deliveries d ON o.order_id = d.order_id
       LEFT JOIN delivery_partners dp ON d.delivery_partner_id = dp.delivery_partner_id
       LEFT JOIN users u_rider ON dp.user_id = u_rider.user_id
       WHERE o.customer_id = ?
       ORDER BY o.order_id DESC`,
      [Number(customerId)]
    );

    for (const ord of orders) {
      const items = await conn.query(
        `SELECT
           oi.order_item_id,
           oi.product_id,
           oi.product_name,
           oi.quantity,
           oi.unit_price,
           oi.agreed_price,
           oi.final_price,
           p.image_url,
           sp.shop_name
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.product_id
         LEFT JOIN seller_profiles sp ON oi.seller_id = sp.seller_id
         WHERE oi.order_id = ?`,
        [ord.order_id]
      );
      ord.items = items;
    }

    return orders;
  } finally {
    if (conn) conn.release();
  }
}

// 7. Get Real-Time Live Order Tracking Data for Map (Scoped to Customer Owner)
async function getOrderTrackingData(orderId, customerId = null) {
  let conn;
  try {
    conn = await pool.getConnection();

    const params = [Number(orderId)];
    const ownerClause = customerId ? "AND o.customer_id = ?" : "";
    if (customerId) params.push(Number(customerId));

    const rows = await conn.query(
      `SELECT
         o.order_id,
         o.order_number,
         o.order_status,
         o.delivery_address,
         d.delivery_id,
         d.delivery_status,
         d.delivery_otp,
         COALESCE(d.pickup_latitude, 22.4390) AS pickup_latitude,
         COALESCE(d.pickup_longitude, 88.3965) AS pickup_longitude,
         COALESCE(d.customer_latitude, 22.4460) AS customer_latitude,
         COALESCE(d.customer_longitude, 88.4020) AS customer_longitude,
         d.pickup_address,
         d.customer_address,
         d.estimated_distance_km,
         d.estimated_duration_minutes,
         u_rider.name AS rider_name,
         u_rider.phone AS rider_phone,
         dp.vehicle_type,
         dp.vehicle_number,
         COALESCE(dp.current_latitude, 22.4420) AS rider_latitude,
         COALESCE(dp.current_longitude, 88.3990) AS rider_longitude
       FROM orders o
       INNER JOIN deliveries d ON o.order_id = d.order_id
       LEFT JOIN delivery_partners dp ON d.delivery_partner_id = dp.delivery_partner_id
       LEFT JOIN users u_rider ON dp.user_id = u_rider.user_id
       WHERE o.order_id = ? ${ownerClause} LIMIT 1`,
      params
    );

    if (rows.length === 0) {
      const err = new Error("Tracking details not found for this order");
      err.statusCode = 404;
      throw err;
    }

    const t = rows[0];
    const hasRider = Boolean(t.rider_name);

    return {
      orderId: Number(t.order_id),
      orderNumber: t.order_number,
      orderStatus: t.order_status,
      deliveryStatus: t.delivery_status,
      deliveryOtp: t.delivery_otp,
      pickup: {
        address: t.pickup_address || "Sonarpur Central Hub",
        lat: Number(t.pickup_latitude),
        lng: Number(t.pickup_longitude)
      },
      customer: {
        address: t.customer_address || t.delivery_address,
        lat: Number(t.customer_latitude),
        lng: Number(t.customer_longitude)
      },
      rider: hasRider ? {
        name: t.rider_name,
        phone: t.rider_phone,
        vehicle: `${t.vehicle_type || 'Scooter'} (${t.vehicle_number || 'WB-74-X-9821'})`,
        lat: Number(t.rider_latitude),
        lng: Number(t.rider_longitude)
      } : null,
      estimatedDistanceKm: Number(t.estimated_distance_km || 1.8),
      estimatedDurationMinutes: Number(t.estimated_duration_minutes || 12)
    };
  } finally {
    if (conn) conn.release();
  }
}

// 8. Submit Customer Review for Product
async function submitProductReview({ customerId, productId, orderId, rating, comment }) {
  let conn;
  try {
    conn = await pool.getConnection();

    const ins = await conn.query(
      `INSERT INTO reviews (
         product_id, customer_id, order_id, rating, comment, review_status
       ) VALUES (?, ?, ?, ?, ?, 'approved')`,
      [Number(productId), Number(customerId), orderId ? Number(orderId) : null, Number(rating), comment || "Great fresh product!"]
    );

    return {
      reviewId: Number(ins.insertId),
      productId: Number(productId),
      rating: Number(rating),
      comment
    };
  } finally {
    if (conn) conn.release();
  }
}

module.exports = {
  authenticateCustomer,
  registerCustomer,
  getCustomerProfile,
  updateCustomerProfile,
  getCustomerProducts,
  getCompareItems,
  processBargainOffer,
  createCustomerOrder,
  getCustomerOrders,
  getOrderTrackingData,
  submitProductReview
};
