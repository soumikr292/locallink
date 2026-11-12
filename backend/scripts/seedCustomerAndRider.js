require("dotenv").config();
const { pool } = require("../src/config/database");
const bcrypt = require("bcryptjs");

BigInt.prototype.toJSON = function () {
  return Number(this);
};

async function seed() {
  const conn = await pool.getConnection();
  try {
    const pwdHash = await bcrypt.hash("rider123", 10);
    const custPwdHash = await bcrypt.hash("customer123", 10);

    // 1. Check or create Kamal Hossain (Rider)
    let existingRider = await conn.query("SELECT * FROM users WHERE email = ? OR phone = ?", ["kamal@locallink.com", "9876543210"]);
    let riderUserId;
    if (existingRider.length === 0) {
      const res = await conn.query(
        "INSERT INTO users (name, email, phone, password_hash, role, status, email_verified) VALUES (?, ?, ?, ?, 'delivery_partner', 'active', 1)",
        ["Kamal Hossain", "kamal@locallink.com", "9876543210", pwdHash]
      );
      riderUserId = Number(res.insertId);
      console.log("Created rider Kamal Hossain ID:", riderUserId);
    } else {
      riderUserId = Number(existingRider[0].user_id);
      await conn.query("UPDATE users SET name = 'Kamal Hossain', role = 'delivery_partner', status = 'active' WHERE user_id = ?", [riderUserId]);
      console.log("Rider user exists/updated ID:", riderUserId);
    }

    // Check delivery_partners entry for Kamal
    let existingDP = await conn.query("SELECT * FROM delivery_partners WHERE user_id = ?", [riderUserId]);
    let partnerId;
    if (existingDP.length === 0) {
      const dpRes = await conn.query(
        "INSERT INTO delivery_partners (user_id, vehicle_type, vehicle_number, availability_status, verification_status, current_latitude, current_longitude, total_deliveries, successful_deliveries) VALUES (?, 'scooter', 'WB-74-X-9821', 'available', 'verified', 22.4420, 88.3990, 48, 48)",
        [riderUserId]
      );
      partnerId = Number(dpRes.insertId);
      console.log("Created delivery partner entry ID:", partnerId);
    } else {
      partnerId = Number(existingDP[0].delivery_partner_id);
      await conn.query(
        "UPDATE delivery_partners SET vehicle_type = 'scooter', vehicle_number = 'WB-74-X-9821', availability_status = 'available', verification_status = 'verified', current_latitude = 22.4420, current_longitude = 88.3990, total_deliveries = 48, successful_deliveries = 48 WHERE delivery_partner_id = ?",
        [partnerId]
      );
      console.log("Updated delivery partner ID:", partnerId);
    }

    // 2. Check or create Tanvir Ahmed (Customer)
    let existingCust = await conn.query("SELECT * FROM users WHERE email = ? OR phone = ?", ["tanvir@locallink.com", "9876543211"]);
    let customerUserId;
    if (existingCust.length === 0) {
      const custRes = await conn.query(
        "INSERT INTO users (name, email, phone, password_hash, role, status, email_verified) VALUES (?, ?, ?, ?, 'customer', 'active', 1)",
        ["Tanvir Ahmed", "tanvir@locallink.com", "9876543211", custPwdHash]
      );
      customerUserId = Number(custRes.insertId);
      console.log("Created customer Tanvir Ahmed ID:", customerUserId);
    } else {
      customerUserId = Number(existingCust[0].user_id);
      await conn.query("UPDATE users SET name = 'Tanvir Ahmed', role = 'customer', status = 'active' WHERE user_id = ?", [customerUserId]);
      console.log("Customer user exists ID:", customerUserId);
    }

    // 3. Make sure multiple local sellers exist with proper shop names & coordinates for compare feature
    // Shop 1: Ratan Fresh Stall #14 (seller_id: 3)
    const s1 = await conn.query("SELECT * FROM seller_profiles WHERE seller_id = 3");
    if (s1.length > 0) {
      await conn.query("UPDATE seller_profiles SET shop_name = 'Ratan Fresh (Stall #14)', shop_address = 'Stall #14, Rajpur Sonarpur Main Bazaar', city = 'Rajpur Sonarpur' WHERE seller_id = 3");
    }

    // Shop 2: Mondal Fish Corner Stall #07 (seller_id: 10 or create)
    const s2 = await conn.query("SELECT * FROM seller_profiles WHERE seller_id = 10");
    if (s2.length > 0) {
      await conn.query("UPDATE seller_profiles SET shop_name = 'Mondal Fish Corner (Stall #07)', shop_address = 'Stall #07, Sonarpur Daily Fish Market', city = 'Sonarpur' WHERE seller_id = 10");
    }

    // 4. Ensure products match the template:
    // - Fresh Katla Fish (1 kg)
    // - Country Potatoes (1 kg)
    // - Gobindabhog Rice (1 kg)
    // - Mustard Oil - Fortune (1L)
    const prods = [
      {
        seller_id: 3,
        name: "Fresh Katla Fish (1 kg)",
        slug: "fresh-katla-fish-1kg",
        price: 320,
        discount_price: 300,
        stock_quantity: 25,
        brand: "Sonarpur Fresh Catch",
        category_id: 4,
        image_url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500&auto=format&fit=crop&q=80",
        description: "Fresh river Katla caught today morning from local freshwater ponds. Certified fresh quality."
      },
      {
        seller_id: 3,
        name: "Country Potatoes (1 kg)",
        slug: "country-potatoes-1kg",
        price: 28,
        discount_price: 25,
        stock_quantity: 120,
        brand: "Bengal Farm Fresh",
        category_id: 2,
        image_url: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop&q=80",
        description: "Fresh organic country potatoes harvested directly from local farms in Sonarpur."
      },
      {
        seller_id: 3,
        name: "Gobindabhog Rice (1 kg)",
        slug: "gobindabhog-rice-1kg",
        price: 95,
        discount_price: 90,
        stock_quantity: 80,
        brand: "Sonar Bangla",
        category_id: 16,
        image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80",
        description: "Aromatic traditional premium Gobindabhog rice from Bengal paddy fields. Perfect for khichdi & desserts."
      },
      {
        seller_id: 3,
        name: "Mustard Oil - Fortune (1L)",
        slug: "mustard-oil-fortune-1l",
        price: 160,
        discount_price: 155,
        stock_quantity: 45,
        brand: "Fortune",
        category_id: 18,
        image_url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80",
        description: "Pure Kachi Ghani mustard oil for authentic Bengali cooking and rich traditional flavor."
      },
      {
        seller_id: 10,
        name: "Fresh Katla Fish (1 kg)",
        slug: "mondal-fresh-katla-fish-1kg",
        price: 340,
        discount_price: 325,
        stock_quantity: 18,
        brand: "Mondal Fish Supply",
        category_id: 4,
        image_url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500&auto=format&fit=crop&q=80",
        description: "Sweet water medium-sized Katla fish, dressed and cleaned upon request."
      }
    ];

    for (const p of prods) {
      const existing = await conn.query("SELECT product_id FROM products WHERE slug = ?", [p.slug]);
      if (existing.length === 0) {
        const ins = await conn.query(
          "INSERT INTO products (seller_id, name, slug, description, sku, price, discount_price, stock_quantity, brand, category_id, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')",
          [p.seller_id, p.name, p.slug, p.description, `SKU-${Date.now().toString().slice(-5)}-${Math.floor(Math.random()*900)}`, p.price, p.discount_price, p.stock_quantity, p.brand, p.category_id, p.image_url]
        );
        const pid = Number(ins.insertId);
        // create inventory
        await conn.query("INSERT INTO inventory (product_id, stock_quantity, reserved_quantity, low_stock_threshold) VALUES (?, ?, 0, 5)", [pid, p.stock_quantity]);
        console.log(`Created product: ${p.name} (ID: ${pid})`);
      }
    }

    // 5. Ensure Order #LL-8942 is active and assigned to Kamal Hossain
    let orderRow = await conn.query("SELECT order_id FROM orders WHERE order_number = 'LL-8942' LIMIT 1");
    let activeOrderId;
    if (orderRow.length === 0) {
      const insOrder = await conn.query(
        "INSERT INTO orders (customer_id, order_number, subtotal, delivery_charge, discount_amount, total_amount, order_status, payment_status, fulfillment_type, delivery_address, customer_note) VALUES (?, 'LL-8942', 95.00, 30.00, 0.00, 125.00, 'out_for_delivery', 'paid', 'delivery', 'House #42, Main Road, Rajpur Block C', 'Please deliver fresh')",
        [customerUserId]
      );
      activeOrderId = Number(insOrder.insertId);

      const riceProd = await conn.query("SELECT product_id FROM products WHERE slug = 'gobindabhog-rice-1kg' LIMIT 1");
      const riceId = riceProd.length > 0 ? Number(riceProd[0].product_id) : 2;

      await conn.query(
        "INSERT INTO order_items (order_id, product_id, seller_id, product_name, sku, quantity, unit_price, agreed_price, discount_amount, final_price) VALUES (?, ?, 3, 'Gobindabhog Rice (1 kg)', 'SKU-RICE-001', 1, 95.00, 95.00, 0.00, 95.00)",
        [activeOrderId, riceId]
      );
      console.log("Created order #LL-8942 with ID:", activeOrderId);
    } else {
      activeOrderId = Number(orderRow[0].order_id);
      await conn.query("UPDATE orders SET customer_id = ?, order_status = 'out_for_delivery' WHERE order_id = ?", [customerUserId, activeOrderId]);
      console.log("Found order #LL-8942 with ID:", activeOrderId);
    }

    // Ensure delivery record exists
    const del = await conn.query("SELECT delivery_id FROM deliveries WHERE order_id = ?", [activeOrderId]);
    if (del.length === 0) {
      await conn.query(
        "INSERT INTO deliveries (order_id, delivery_partner_id, pickup_address, customer_address, customer_phone, delivery_status, pickup_latitude, pickup_longitude, customer_latitude, customer_longitude, delivery_instructions, estimated_distance_km, estimated_duration_minutes, delivery_otp) VALUES (?, ?, 'Green Grocery Hub (Stall #14), Rajpur Bazaar', 'House #42, Main Road, Rajpur Block C', '9876543211', 'out_for_delivery', 22.4390, 88.3965, 22.4460, 88.4020, 'Call customer on arrival', 1.8, 12, '8942')",
        [activeOrderId, partnerId]
      );
      console.log("Created delivery for order #LL-8942");
    } else {
      await conn.query(
        "UPDATE deliveries SET delivery_partner_id = ?, delivery_status = 'out_for_delivery', pickup_address = 'Green Grocery Hub (Stall #14), Rajpur Bazaar', customer_address = 'House #42, Main Road, Rajpur Block C', customer_phone = '9876543211', pickup_latitude = 22.4390, pickup_longitude = 88.3965, customer_latitude = 22.4460, customer_longitude = 88.4020, delivery_otp = '8942', estimated_distance_km = 1.8, estimated_duration_minutes = 12 WHERE delivery_id = ?",
        [partnerId, del[0].delivery_id]
      );
      console.log("Updated delivery for Kamal Hossain");
    }

    // Also ensure a nearby available order exists in the pool (e.g., Order #LL-8943)
    let poolOrder = await conn.query("SELECT order_id FROM orders WHERE order_number = 'LL-8943' LIMIT 1");
    let poolOrderId;
    if (poolOrder.length === 0) {
      const insPool = await conn.query(
        "INSERT INTO orders (customer_id, order_number, subtotal, delivery_charge, discount_amount, total_amount, order_status, payment_status, fulfillment_type, delivery_address, customer_note) VALUES (?, 'LL-8943', 320.00, 35.00, 0.00, 355.00, 'ready_for_pickup', 'paid', 'delivery', 'Apt 3B, Sonarpur Green Enclave, Sector 4', 'Handle with care')",
        [customerUserId]
      );
      poolOrderId = Number(insPool.insertId);
      await conn.query(
        "INSERT INTO order_items (order_id, product_id, seller_id, product_name, sku, quantity, unit_price, agreed_price, discount_amount, final_price) VALUES (?, 3, 3, 'Fresh Katla Fish (1 kg)', 'SKU-KATLA-001', 1, 320.00, 320.00, 0.00, 320.00)",
        [poolOrderId]
      );
      await conn.query(
        "INSERT INTO deliveries (order_id, delivery_partner_id, pickup_address, customer_address, customer_phone, delivery_status, pickup_latitude, pickup_longitude, customer_latitude, customer_longitude, delivery_instructions, estimated_distance_km, estimated_duration_minutes, delivery_otp) VALUES (?, NULL, 'Ratan Fresh (Stall #14), Sonarpur Bazaar', 'Apt 3B, Sonarpur Green Enclave, Sector 4', '9876543211', 'pending', 22.4390, 88.3965, 22.4510, 88.4080, 'Fragile - Fresh Fish', 1.2, 10, '8943')",
        [poolOrderId]
      );
      console.log("Created nearby pool order #LL-8943");
    }

    console.log("✅ Seed completed successfully!");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    conn.release();
    pool.end();
  }
}

seed();
