require("../src/config/env");

const bcrypt = require("bcryptjs");
const { pool } = require("../src/config/database");

async function seed() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log("🌱 Seeding LocalLink database...");

    const passwordHash = await bcrypt.hash("Admin@12345678", 12);

    // 1. Users
    const users = [
      {
        name: "LocalLink Super Admin",
        email: "superadmin123@gmail.com",
        phone: "+919876543210",
        role: "super_admin",
        status: "active"
      },
      {
        name: "Sunil Roy (Operations Staff)",
        email: "staff@locallink.com",
        phone: "+919876543211",
        role: "staff",
        status: "active"
      },
      {
        name: "Kolkata Fresh Organics (Seller)",
        email: "testseller@locallink.com",
        phone: "+919876543212",
        role: "seller",
        status: "active"
      },
      {
        name: "Heritage Artisans & Crafts",
        email: "seller2@locallink.com",
        phone: "+919876543213",
        role: "seller",
        status: "active"
      },
      {
        name: "Rajesh Kumar (Delivery Rider)",
        email: "testdelivery@locallink.com",
        phone: "+919876543214",
        role: "delivery_partner",
        status: "active"
      },
      {
        name: "Vikram Singh (Express Rider)",
        email: "rider2@locallink.com",
        phone: "+919876543215",
        role: "delivery_partner",
        status: "active"
      },
      {
        name: "Priya Sharma",
        email: "testcustomer@locallink.com",
        phone: "+919876543216",
        role: "customer",
        status: "active"
      },
      {
        name: "Amit Sen",
        email: "amit.sen@example.com",
        phone: "+919876543217",
        role: "customer",
        status: "active"
      },
      {
        name: "Sneha Banerjee",
        email: "sneha.banerjee@example.com",
        phone: "+919876543218",
        role: "customer",
        status: "active"
      },
      {
        name: "Rahul Verma",
        email: "rahul.verma@example.com",
        phone: "+919876543219",
        role: "customer",
        status: "active"
      }
    ];

    for (const u of users) {
      await conn.query(
        `INSERT INTO users (name, email, phone, password_hash, role, status, email_verified)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), status = VALUES(status), password_hash = VALUES(password_hash)`,
        [u.name, u.email, u.phone, passwordHash, u.role, u.status]
      );
    }
    console.log("✓ Users seeded.");

    // Retrieve key user IDs
    const userRows = await conn.query("SELECT user_id, email, role FROM users");
    const userMap = {};
    for (const r of userRows) userMap[r.email] = Number(r.user_id);

    const superAdminId = userMap["superadmin123@gmail.com"];
    const seller1Id = userMap["testseller@locallink.com"];
    const seller2Id = userMap["seller2@locallink.com"];
    const rider1Id = userMap["testdelivery@locallink.com"];
    const rider2Id = userMap["rider2@locallink.com"];
    const customer1Id = userMap["testcustomer@locallink.com"];
    const customer2Id = userMap["amit.sen@example.com"];
    const customer3Id = userMap["sneha.banerjee@example.com"];
    const customer4Id = userMap["rahul.verma@example.com"];

    // 2. Delivery Partners
    if (rider1Id) {
      await conn.query(
        `INSERT INTO delivery_partners (user_id, vehicle_type, vehicle_number, availability_status, verification_status, current_latitude, current_longitude, total_deliveries, successful_deliveries)
         VALUES (?, 'motorcycle', 'WB-02-AK-4521', 'available', 'verified', 22.5726, 88.3639, 142, 138)
         ON DUPLICATE KEY UPDATE availability_status = 'available', verification_status = 'verified'`,
        [rider1Id]
      );
    }
    if (rider2Id) {
      await conn.query(
        `INSERT INTO delivery_partners (user_id, vehicle_type, vehicle_number, availability_status, verification_status, current_latitude, current_longitude, total_deliveries, successful_deliveries)
         VALUES (?, 'scooter', 'WB-06-BM-7890', 'available', 'verified', 22.5850, 88.4100, 89, 87)
         ON DUPLICATE KEY UPDATE availability_status = 'available', verification_status = 'verified'`,
        [rider2Id]
      );
    }
    const partnerRows = await conn.query("SELECT delivery_partner_id, user_id FROM delivery_partners");
    const partnerMap = {};
    for (const p of partnerRows) partnerMap[Number(p.user_id)] = Number(p.delivery_partner_id);

    // 3. Categories (Retrieve existing or insert defaults)
    const categoryRows = await conn.query("SELECT category_id, name, slug FROM categories");
    const catMap = {};
    for (const c of categoryRows) catMap[c.slug] = Number(c.category_id);

    // Ensure some foundational categories exist
    const baseCategories = [
      { name: "Fresh Fruits & Vegetables", slug: "fresh-produce", desc: "Farm-fresh organic fruits and seasonal vegetables." },
      { name: "Dairy & Bakery", slug: "dairy-bakery", desc: "Fresh farm milk, artisanal sourdough, paneer, and eggs." },
      { name: "Handicrafts & Decor", slug: "handicrafts-decor", desc: "Local terracotta crafts, handmade candles, and home artifacts." },
      { name: "Gourmet & Beverages", slug: "gourmet-beverages", desc: "Specialty Darjeeling tea, roasted coffee, and cold-pressed oils." },
      { name: "Personal Care & Wellness", slug: "wellness", desc: "Herbal skincare, Ayurvedic soaps, and wellness essentials." }
    ];

    for (const c of baseCategories) {
      if (!catMap[c.slug]) {
        const res = await conn.query(
          `INSERT INTO categories (name, slug, description, status) VALUES (?, ?, ?, 'active')`,
          [c.name, c.slug, c.desc]
        );
        catMap[c.slug] = Number(res.insertId);
      }
    }
    console.log("✓ Categories checked.");

    // 4. Products
    const productsData = [
      {
        sellerId: seller1Id,
        name: "Fresh Organic Alphonso Mangoes (1kg)",
        slug: "fresh-alphonso-mangoes-1kg",
        description: "Directly sourced from coastal orchards. Naturally ripened, sweet and aromatic.",
        sku: "MNG-ALP-001",
        price: 349.00,
        discountPrice: 299.00,
        stock: 50,
        brand: "FarmDirect",
        catSlug: "fresh-produce",
        imageUrl: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=500&auto=format&fit=crop&q=80",
        status: "active"
      },
      {
        sellerId: seller1Id,
        name: "Pure Farm Cow Milk (1L Bottle)",
        slug: "pure-farm-cow-milk-1l",
        description: "A2 unadulterated fresh whole milk chilled within 1 hour of milking.",
        sku: "MLK-COW-002",
        price: 75.00,
        discountPrice: 68.00,
        stock: 120,
        brand: "DairyFresh",
        catSlug: "dairy-bakery",
        imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=80",
        status: "active"
      },
      {
        sellerId: seller1Id,
        name: "Artisanal Whole Wheat Sourdough (400g)",
        slug: "whole-wheat-sourdough-400g",
        description: "Slow-fermented for 24 hours. Crusty exterior with soft airy crumb.",
        sku: "BRD-SRD-003",
        price: 120.00,
        discountPrice: 110.00,
        stock: 25,
        brand: "BakersBoutique",
        catSlug: "dairy-bakery",
        imageUrl: "https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=500&auto=format&fit=crop&q=80",
        status: "active"
      },
      {
        sellerId: seller2Id,
        name: "First Flush Darjeeling Tea (250g Tin)",
        slug: "first-flush-darjeeling-tea-250g",
        description: "Single-estate spring harvest from Mirik Valley with delicate muscatel floral notes.",
        sku: "TEA-DAR-004",
        price: 599.00,
        discountPrice: 520.00,
        stock: 40,
        brand: "HimalayanBlends",
        catSlug: "gourmet-beverages",
        imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80",
        status: "active"
      },
      {
        sellerId: seller1Id,
        name: "Cold-Pressed Kachi Ghani Mustard Oil (1L)",
        slug: "cold-pressed-mustard-oil-1l",
        description: "Wood-churned traditional yellow mustard seed oil with strong natural pungency.",
        sku: "OIL-MST-005",
        price: 210.00,
        discountPrice: 185.00,
        stock: 8, // Low stock on purpose
        brand: "PureGhani",
        catSlug: "gourmet-beverages",
        imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80",
        status: "active"
      },
      {
        sellerId: seller2Id,
        name: "Handcrafted Terracotta Chai Kulhad (Set of 6)",
        slug: "terracotta-kulhad-set-6",
        description: "Made by traditional Bengal potters. Adds authentic earthy flavor to hot tea.",
        sku: "POT-KUL-006",
        price: 280.00,
        discountPrice: 240.00,
        stock: 35,
        brand: "BengalClay",
        catSlug: "handicrafts-decor",
        imageUrl: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=500&auto=format&fit=crop&q=80",
        status: "active"
      },
      {
        sellerId: seller2Id,
        name: "Cold-Processed Neem & Turmeric Herbal Soap (Pack of 3)",
        slug: "neem-turmeric-herbal-soap-3pk",
        description: "Gentle natural cleansing with pure coconut oil, raw neem extracts, and Kasturi turmeric.",
        sku: "SOP-NEM-007",
        price: 195.00,
        discountPrice: 175.00,
        stock: 60,
        brand: "AyurRoots",
        catSlug: "wellness",
        imageUrl: "https://images.unsplash.com/photo-1607006314643-982736181b85?w=500&auto=format&fit=crop&q=80",
        status: "inactive"
      },
      {
        sellerId: seller1Id,
        name: "Farm Fresh Paneer (500g Vacuum Pack)",
        slug: "farm-fresh-paneer-500g",
        description: "Soft, spongy malai paneer prepared fresh every morning from whole buffalo milk.",
        sku: "PNR-MAL-008",
        price: 190.00,
        discountPrice: 170.00,
        stock: 4, // Low stock threshold
        brand: "DairyFresh",
        catSlug: "dairy-bakery",
        imageUrl: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80",
        status: "active"
      }
    ];

    const prodMap = {};
    for (const p of productsData) {
      const categoryId = catMap[p.catSlug] || Object.values(catMap)[0] || null;
      await conn.query(
        `INSERT INTO products (seller_id, name, slug, description, sku, price, discount_price, stock_quantity, brand, category_id, image_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), discount_price = VALUES(discount_price), stock_quantity = VALUES(stock_quantity), status = VALUES(status)`,
        [p.sellerId, p.name, p.slug, p.description, p.sku, p.price, p.discountPrice, p.stock, p.brand, categoryId, p.imageUrl, p.status]
      );
    }
    const currentProds = await conn.query("SELECT product_id, sku, name, price, stock_quantity FROM products");
    for (const p of currentProds) prodMap[p.sku] = p;
    console.log(`✓ Products seeded (${currentProds.length} total).`);

    // 5. Inventory & Adjustments
    for (const p of currentProds) {
      const pid = Number(p.product_id);
      const stock = Number(p.stock_quantity);
      const reserved = Math.min(2, Math.floor(stock / 5));
      const threshold = 10;

      await conn.query(
        `INSERT INTO inventory (product_id, stock_quantity, reserved_quantity, low_stock_threshold)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity), reserved_quantity = VALUES(reserved_quantity)`,
        [pid, stock, reserved, threshold]
      );
    }
    console.log("✓ Inventory synced.");

    // 6. Shipping Zones & Methods
    await conn.query(
      `INSERT INTO shipping_zones (zone_name, city, area, pincode, status)
       VALUES ('Central Kolkata Hub', 'Kolkata', 'Park Street, Esplanade & BBD Bagh', '700016', 'active'),
              ('North Suburban Hub', 'Kolkata', 'Shyambazar, Dum Dum & Ultadanga', '700004', 'active'),
              ('Tech Corridor Hub', 'Kolkata', 'Salt Lake & New Town Action Area I-III', '700091', 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`
    );

    await conn.query(
      `INSERT INTO shipping_methods (method_name, description, base_charge, estimated_delivery_minutes, free_delivery_minimum, status)
       VALUES ('HyperLocal Express (30 Mins)', 'Direct rider dispatched within 10 minutes of packing.', 49.00, 30, 499.00, 'active'),
              ('Standard Same-Day Delivery', 'Scheduled route delivery morning and evening slots.', 29.00, 180, 299.00, 'active'),
              ('Eco-Saver Next-Day Delivery', 'Batched low-carbon electric cycle delivery.', 0.00, 720, 199.00, 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`
    );
    console.log("✓ Shipping zones and methods seeded.");

    // 7. Orders, Order Items & Payments
    const sampleOrders = [
      {
        orderNumber: "LL-2026-9001",
        customerId: customer1Id,
        subtotal: 739.00,
        deliveryCharge: 29.00,
        discountAmount: 50.00,
        totalAmount: 718.00,
        orderStatus: "delivered",
        paymentStatus: "paid",
        fulfillmentType: "delivery",
        address: "Flat 4B, Park Mansions, Park Street, Kolkata - 700016",
        note: "Please ring the bell twice",
        paymentMethod: "upi",
        txId: "UPI_TXN_987623412",
        items: [
          { sku: "MNG-ALP-001", qty: 2, price: 299.00 },
          { sku: "BRD-SRD-003", qty: 1, price: 110.00 },
          { sku: "MLK-COW-002", qty: 1, price: 31.00 }
        ]
      },
      {
        orderNumber: "LL-2026-9002",
        customerId: customer2Id,
        subtotal: 520.00,
        deliveryCharge: 49.00,
        discountAmount: 0.00,
        totalAmount: 569.00,
        orderStatus: "out_for_delivery",
        paymentStatus: "paid",
        fulfillmentType: "delivery",
        address: "House 12/A, Sector 3, Salt Lake, Kolkata - 700091",
        note: "Leave with security guard if not answering",
        paymentMethod: "card",
        txId: "CRD_TXN_654129087",
        items: [
          { sku: "TEA-DAR-004", qty: 1, price: 520.00 }
        ]
      },
      {
        orderNumber: "LL-2026-9003",
        customerId: customer3Id,
        subtotal: 410.00,
        deliveryCharge: 29.00,
        discountAmount: 20.00,
        totalAmount: 419.00,
        orderStatus: "processing",
        paymentStatus: "paid",
        fulfillmentType: "delivery",
        address: "78 Raja Dinendra Street, Shyambazar, Kolkata - 700004",
        note: "Fresh vegetables preferred",
        paymentMethod: "upi",
        txId: "UPI_TXN_876512349",
        items: [
          { sku: "OIL-MST-005", qty: 1, price: 185.00 },
          { sku: "PNR-MAL-008", qty: 1, price: 170.00 },
          { sku: "MLK-COW-002", qty: 1, price: 55.00 }
        ]
      },
      {
        orderNumber: "LL-2026-9004",
        customerId: customer4Id,
        subtotal: 415.00,
        deliveryCharge: 0.00,
        discountAmount: 0.00,
        totalAmount: 415.00,
        orderStatus: "confirmed",
        paymentStatus: "pending",
        fulfillmentType: "delivery",
        address: "Tower 2, Apt 1102, New Town Action Area 1, Kolkata - 700156",
        note: "Cash on delivery order",
        paymentMethod: "cod",
        txId: null,
        items: [
          { sku: "POT-KUL-006", qty: 1, price: 240.00 },
          { sku: "SOP-NEM-007", qty: 1, price: 175.00 }
        ]
      },
      {
        orderNumber: "LL-2026-9005",
        customerId: customer1Id,
        subtotal: 299.00,
        deliveryCharge: 29.00,
        discountAmount: 0.00,
        totalAmount: 328.00,
        orderStatus: "pending",
        paymentStatus: "pending",
        fulfillmentType: "delivery",
        address: "Flat 4B, Park Mansions, Park Street, Kolkata - 700016",
        note: "",
        paymentMethod: "upi",
        txId: null,
        items: [
          { sku: "MNG-ALP-001", qty: 1, price: 299.00 }
        ]
      }
    ];

    for (const o of sampleOrders) {
      if (!o.customerId) continue;
      const orderRes = await conn.query(
        `INSERT INTO orders (customer_id, order_number, subtotal, delivery_charge, discount_amount, total_amount, order_status, payment_status, fulfillment_type, delivery_address, customer_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE order_status = VALUES(order_status), payment_status = VALUES(payment_status), total_amount = VALUES(total_amount)`,
        [o.customerId, o.orderNumber, o.subtotal, o.deliveryCharge, o.discountAmount, o.totalAmount, o.orderStatus, o.paymentStatus, o.fulfillmentType, o.address, o.note]
      );

      // Get inserted or existing order_id
      const orderRow = await conn.query("SELECT order_id FROM orders WHERE order_number = ?", [o.orderNumber]);
      const orderId = Number(orderRow[0]?.order_id);

      if (orderId) {
        // Items
        for (const it of o.items) {
          const product = prodMap[it.sku];
          if (!product) continue;
          await conn.query(
            `INSERT IGNORE INTO order_items (order_id, product_id, seller_id, product_name, sku, quantity, unit_price, final_price)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderId, Number(product.product_id), seller1Id, product.name, it.sku, it.qty, it.price, it.price * it.qty]
          );
        }

        // Payment
        const ref = `PAY-${o.orderNumber}`;
        await conn.query(
          `INSERT INTO payments (order_id, customer_id, payment_reference, payment_method, amount, payment_status, transaction_id, paid_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, IF(? = 'paid', NOW(), NULL))
           ON DUPLICATE KEY UPDATE payment_status = VALUES(payment_status), transaction_id = VALUES(transaction_id)`,
          [orderId, o.customerId, ref, o.paymentMethod, o.totalAmount, o.paymentStatus, o.txId, o.paymentStatus]
        );

        // Deliveries for orders 9001 and 9002
        if (o.orderNumber === "LL-2026-9001") {
          const riderPartnerId = partnerMap[rider1Id] || null;
          await conn.query(
            `INSERT INTO deliveries (order_id, delivery_partner_id, pickup_address, customer_address, delivery_status, estimated_distance_km, estimated_duration_minutes, delivered_at, delivery_otp_verified)
             VALUES (?, ?, 'LocalLink Hub Central, Esplanade', ?, 'delivered', 3.2, 18, NOW(), 1)
             ON DUPLICATE KEY UPDATE delivery_status = 'delivered'`,
            [orderId, riderPartnerId, o.address]
          );
        } else if (o.orderNumber === "LL-2026-9002") {
          const riderPartnerId = partnerMap[rider2Id] || null;
          await conn.query(
            `INSERT INTO deliveries (order_id, delivery_partner_id, pickup_address, customer_address, delivery_status, estimated_distance_km, estimated_duration_minutes, out_for_delivery_at)
             VALUES (?, ?, 'LocalLink Salt Lake Hub, Sector 5', ?, 'out_for_delivery', 2.8, 15, NOW())
             ON DUPLICATE KEY UPDATE delivery_status = 'out_for_delivery'`,
            [orderId, riderPartnerId, o.address]
          );
        }
      }
    }
    console.log("✓ Orders, items, payments and deliveries seeded.");

    // 8. Coupons & Marketing
    const coupons = [
      { code: "WELCOME50", desc: "Flat ₹50 OFF for all new local shoppers", type: "fixed", val: 50.00, min: 299.00, status: "active" },
      { code: "LOCALLOVE20", desc: "20% discount on orders above ₹500", type: "percentage", val: 20.00, min: 500.00, status: "active" },
      { code: "FREESHIP", desc: "100% free delivery on grocery carts", type: "fixed", val: 29.00, min: 199.00, status: "active" }
    ];

    for (const c of coupons) {
      await conn.query(
        `INSERT INTO coupons (code, description, discount_type, discount_value, minimum_order_amount, starts_at, expires_at, status)
         VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY), ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description), status = VALUES(status)`,
        [c.code, c.desc, c.type, c.val, c.min, c.status]
      );
    }

    const banners = [
      {
        title: "Fresh Harvest Festival — 25% Off Local Produce",
        subtitle: "Farm-to-door in under 45 minutes across Kolkata",
        imageUrl: "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1200&auto=format&fit=crop&q=80",
        targetUrl: "/catalog",
        position: "homepage",
        status: "active"
      },
      {
        title: "Artisanal Bakeries & Dairy Delights",
        subtitle: "Support your favorite neighborhood makers today",
        imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&auto=format&fit=crop&q=80",
        targetUrl: "/catalog",
        position: "category_banner",
        status: "active"
      }
    ];

    for (const b of banners) {
      await conn.query(
        `INSERT INTO marketing_banners (title, subtitle, image_url, target_url, position, starts_at, expires_at, status)
         VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), ?)`,
        [b.title, b.subtitle, b.imageUrl, b.targetUrl, b.position, b.status]
      );
    }
    console.log("✓ Coupons and marketing banners seeded.");

    // 9. Customer Reviews
    const firstProd = currentProds[0]?.product_id;
    const secondProd = currentProds[1]?.product_id || firstProd;
    if (firstProd && customer1Id) {
      await conn.query(
        `INSERT INTO reviews (product_id, customer_id, rating, title, review_text, review_status, is_reported)
         VALUES (?, ?, 5, 'Super fresh and flavorful!', 'Received the mangoes in perfect condition, naturally sweet with zero chemical smell.', 'approved', 0),
                (?, ?, 4, 'Very soft and tasty', 'Paneer melted in the mouth. Packaging was chilled nicely.', 'approved', 0)
         ON DUPLICATE KEY UPDATE review_status = 'approved'`,
        [firstProd, customer1Id, secondProd, customer2Id]
      );
    }
    console.log("✓ Reviews seeded.");

    // 10. Content: Pages, Blog Posts, FAQs, Media Library
    const pages = [
      {
        title: "About LocalLink",
        slug: "about-us",
        content: "LocalLink is the hyper-local commerce network connecting neighborhood grocers, bakeries, artisans, and fresh produce growers directly to conscious local consumers.",
        status: "published"
      },
      {
        title: "Terms and Conditions",
        slug: "terms-and-conditions",
        content: "All orders placed on LocalLink are backed by our fresh-guarantee promise. Cancellations are permitted until an order is confirmed by the merchant.",
        status: "published"
      },
      {
        title: "Privacy & Data Policy",
        slug: "privacy-policy",
        content: "We respect your privacy. Delivery location and customer details are strictly shared with the assigned courier partner for active fulfillment only.",
        status: "published"
      }
    ];

    for (const p of pages) {
      await conn.query(
        `INSERT INTO content_pages (title, slug, content, status)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE content = VALUES(content), status = VALUES(status)`,
        [p.title, p.slug, p.content, p.status]
      );
    }

    const blogs = [
      {
        title: "5 Compelling Reasons to Choose Neighborhood Produce Over Supermarkets",
        slug: "5-reasons-choose-local-produce",
        excerpt: "Why buying from local growers lowers your carbon footprint and brings fresher, tastier meals to your dining table.",
        content: "When you purchase fruits and vegetables harvested within 50 kilometers of your home, you skip weeks of refrigerated transit, artificial ripening chambers, and unnecessary plastic wrapping. Discover the LocalLink farm-to-table revolution.",
        status: "published"
      },
      {
        title: "Behind the Scenes: Meet Kolkata's Heritage Clay Craftsmen",
        slug: "meet-kolkata-heritage-craftsmen",
        excerpt: "Tracing the generations of artistry shaping traditional tea kulhads and terracotta home artifacts.",
        content: "Down the winding lanes of Kumartuli and riverside kilns, master artisans have molded clay with passion for centuries. We visit Sri Bimal Pal to see how LocalLink is helping their co-op reach young urban households.",
        status: "published"
      }
    ];

    for (const b of blogs) {
      await conn.query(
        `INSERT INTO blog_posts (title, slug, excerpt, content, status, published_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE excerpt = VALUES(excerpt), content = VALUES(content)`,
        [b.title, b.slug, b.excerpt, b.content, b.status]
      );
    }

    const faqs = [
      {
        question: "How fast is delivery through LocalLink?",
        slug: "how-fast-is-delivery",
        answer: "Hyperlocal orders are fulfilled by dedicated riders within 30 to 45 minutes of dispatch. You can also select scheduled morning and evening time slots at checkout.",
        status: "published",
        sort: 1
      },
      {
        question: "What happens if a product is damaged or out of stock?",
        slug: "damaged-or-out-of-stock-policy",
        answer: "Our immediate refund policy automatically credits your original payment method or wallet upon verification by our support team or delivery rider.",
        status: "published",
        sort: 2
      },
      {
        question: "Can local shops and home bakers register to sell?",
        slug: "how-to-become-a-seller",
        answer: "Yes! Any local business with valid FSSAI / GST or artisan registration can apply through the Seller Portal and get verified within 24 hours.",
        status: "published",
        sort: 3
      }
    ];

    for (const f of faqs) {
      await conn.query(
        `INSERT INTO content_faqs (question, slug, answer, status, sort_order)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE answer = VALUES(answer), status = VALUES(status)`,
        [f.question, f.slug, f.answer, f.status, f.sort]
      );
    }

    const media = [
      {
        title: "LocalLink Logo Badge",
        media_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80",
        media_type: "image",
        alt_text: "LocalLink Marketplace Hero Visual"
      },
      {
        title: "Organic Farm Harvest",
        media_url: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=600&auto=format&fit=crop&q=80",
        media_type: "image",
        alt_text: "Golden sunrise over organic farm fields"
      }
    ];

    for (const m of media) {
      await conn.query(
        `INSERT INTO media_library (title, media_url, media_type, alt_text)
         VALUES (?, ?, ?, ?)`,
        [m.title, m.media_url, m.media_type, m.alt_text]
      );
    }
    console.log("✓ Content pages, blogs, FAQs and media assets seeded.");

    console.log("\n=======================================================");
    console.log("🎉 LocalLink database seeding completed successfully!");
    console.log("=======================================================");
    console.log("Admin Email:    superadmin123@gmail.com");
    console.log("Admin Password: Admin@12345678");
    console.log("Role:           super_admin");
    console.log("=======================================================\n");

  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

seed();
