const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const app = require("../src/app");
const http = require("http");
const { pool } = require("../src/config/database");

async function runE2ETests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log("==================================================");
  console.log("🧪 STARTING COMPREHENSIVE SELLER PANEL E2E TESTS");
  console.log(`🌐 Server running at: ${baseUrl}`);
  console.log("==================================================");

  let createdSellerId = null;
  let testProductId = null;
  let testReviewId = null;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Seller Registration (Must be role: seller & status: pending)
    // -----------------------------------------------------------------
    console.log("\n--- TEST 1: Seller Registration ---");
    const uniqueEmail = `seller_reg_${Date.now()}@locallink.com`;
    const uniquePhone = `99${Date.now().toString().slice(-8)}`;

    const regRes = await fetch(`${baseUrl}/api/seller/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Subrata Ghosh",
        shopName: "Ghosh Sweets & Dairy",
        email: uniqueEmail,
        phone: uniquePhone,
        password: "securePassword123",
        confirmPassword: "securePassword123",
        businessCategory: "Dairy & Bakery",
        city: "Kolkata",
        shopAddress: "45 Rabindra Sarani, Central Market",
        termsAccepted: true
      })
    });

    const regData = await regRes.json();
    if (!regData.success || regData.data?.status !== "pending") {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }
    createdSellerId = regData.data.userId;
    console.log(`✅ Registration successful! Created Seller #${createdSellerId} with status: ${regData.data.status}`);

    // -----------------------------------------------------------------
    // TEST 2: Pending Account cannot login before admin verification
    // -----------------------------------------------------------------
    console.log("\n--- TEST 2: Pending Account Login Restriction ---");
    const pendingLoginRes = await fetch(`${baseUrl}/api/seller/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginIdentifier: uniqueEmail,
        password: "securePassword123"
      })
    });
    const pendingLoginData = await pendingLoginRes.json();
    if (pendingLoginRes.status !== 403 || !pendingLoginData.message.includes("pending")) {
      throw new Error(`Expected 403 pending notice, got: ${JSON.stringify(pendingLoginData)}`);
    }
    console.log("✅ Verified: Pending seller accounts are blocked from accessing until approved.");

    // Admin approves seller in DB
    await pool.query("UPDATE users SET status = 'active' WHERE user_id = ?", [createdSellerId]);
    console.log(`ℹ️ Admin approved seller #${createdSellerId} (status set to active).`);

    // -----------------------------------------------------------------
    // TEST 3: Active Seller Login & JWT issuance
    // -----------------------------------------------------------------
    console.log("\n--- TEST 3: Seller Login & Token Generation ---");
    const loginRes = await fetch(`${baseUrl}/api/seller/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginIdentifier: uniquePhone, // test phone login support
        password: "securePassword123"
      })
    });
    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.data?.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    const sellerToken = loginData.data.token;
    console.log(`✅ Logged in via phone number! Token received for ${loginData.data.shop.shopName}`);

    const sellerHeaders = {
      Authorization: `Bearer ${sellerToken}`,
      "Content-Type": "application/json"
    };

    // -----------------------------------------------------------------
    // TEST 4: Unauthorized Access Protection
    // -----------------------------------------------------------------
    console.log("\n--- TEST 4: Authorization Guards & Expired/Missing Token ---");
    const noTokenRes = await fetch(`${baseUrl}/api/seller/dashboard`);
    if (noTokenRes.status !== 401) {
      throw new Error(`Expected 401 for request without token, got: ${noTokenRes.status}`);
    }
    console.log("✅ Verified: Unauthenticated requests are rejected with 401.");

    // -----------------------------------------------------------------
    // TEST 5: Create Product & Atomic Inventory Sync
    // -----------------------------------------------------------------
    console.log("\n--- TEST 5: Create Product & Atomic Inventory Sync ---");
    const prodRes = await fetch(`${baseUrl}/api/seller/products`, {
      method: "POST",
      headers: sellerHeaders,
      body: JSON.stringify({
        name: "Traditional Nolen Gur Sandesh Box (10pcs)",
        sku: `SND-GUR-${Date.now().toString().slice(-4)}`,
        price: 250,
        discountPrice: 220,
        stockQuantity: 40,
        lowStockThreshold: 10,
        brand: "Ghosh Artisanal Dairy",
        status: "active",
        description: "Fresh winter date palm jaggery sandesh made daily."
      })
    });
    const prodData = await prodRes.json();
    if (!prodData.success || !prodData.data?.id) {
      throw new Error(`Product creation failed: ${JSON.stringify(prodData)}`);
    }
    testProductId = prodData.data.id;
    console.log(`✅ Product created: #${testProductId} (${prodData.data.name}) with stock: ${prodData.data.stockQuantity}`);

    // Verify inventory table automatically has row
    const [invRows] = await pool.query("SELECT * FROM inventory WHERE product_id = ?", [testProductId]);
    if (!invRows || invRows.stock_quantity !== 40) {
      throw new Error(`Inventory table not synced: ${JSON.stringify(invRows)}`);
    }
    console.log(`✅ Verified: Inventory row created atomically with stock_quantity = ${invRows.stock_quantity}`);

    // -----------------------------------------------------------------
    // TEST 6: Atomic Stock Adjustment & Overselling Prevention
    // -----------------------------------------------------------------
    console.log("\n--- TEST 6: Inventory Adjustment & Safety Checks ---");
    const adjustRes = await fetch(`${baseUrl}/api/seller/inventory/adjust`, {
      method: "POST",
      headers: sellerHeaders,
      body: JSON.stringify({
        productId: testProductId,
        quantityChange: 15,
        reason: "restock",
        note: "Morning fresh batch received from kitchen"
      })
    });
    const adjustData = await adjustRes.json();
    if (!adjustData.success || adjustData.data.newStock !== 55) {
      throw new Error(`Stock adjustment failed: ${JSON.stringify(adjustData)}`);
    }
    console.log(`✅ Restocked +15 units! New stock: ${adjustData.data.newStock}`);

    // Test negative stock rejection
    const invalidAdjust = await fetch(`${baseUrl}/api/seller/inventory/adjust`, {
      method: "POST",
      headers: sellerHeaders,
      body: JSON.stringify({
        productId: testProductId,
        quantityChange: -100,
        reason: "correction"
      })
    });
    if (invalidAdjust.status !== 400) {
      throw new Error("Expected 400 error for negative stock");
    }
    console.log("✅ Verified: Overselling / negative stock is strictly prevented.");

    // -----------------------------------------------------------------
    // TEST 7: Cross-Seller Data Isolation (Multi-tenant Security)
    // -----------------------------------------------------------------
    console.log("\n--- TEST 7: Seller Ownership & IDOR Protection ---");
    // Seller 3 tries to edit Seller createdSellerId's product
    const otherSellerLogin = await fetch(`${baseUrl}/api/seller/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginIdentifier: "testseller@locallink.com",
        password: "seller123"
      })
    });
    const otherSellerData = await otherSellerLogin.json();
    const otherSellerHeaders = {
      Authorization: `Bearer ${otherSellerData.data.token}`,
      "Content-Type": "application/json"
    };

    const idorRes = await fetch(`${baseUrl}/api/seller/products/${testProductId}`, {
      method: "PUT",
      headers: otherSellerHeaders,
      body: JSON.stringify({ name: "Hacked Product Name" })
    });
    if (idorRes.status !== 404) {
      throw new Error(`Expected 404 unauthorized product edit, got ${idorRes.status}`);
    }
    console.log("✅ Verified: Seller cannot access, edit, or tamper with another seller's products.");

    // -----------------------------------------------------------------
    // TEST 8: Reviews & Seller Reply Workflow
    // -----------------------------------------------------------------
    console.log("\n--- TEST 8: Customer Review Feedback & Seller Reply ---");
    // Create test customer review in DB for testProductId
    const revInsert = await pool.query(
      `INSERT INTO reviews (product_id, customer_id, rating, title, review_text, review_status)
       VALUES (?, 2, 5, "Melt in mouth delicious!", "Authentic date palm jaggery flavor. Fast delivery.", "approved")`,
      [testProductId]
    );
    testReviewId = Number(revInsert.insertId);

    const replyRes = await fetch(`${baseUrl}/api/seller/reviews/${testReviewId}/reply`, {
      method: "POST",
      headers: sellerHeaders,
      body: JSON.stringify({
        replyText: "Thank you for supporting our traditional Bengali sweet workshop!"
      })
    });
    const replyData = await replyRes.json();
    if (!replyData.success) {
      throw new Error(`Reply failed: ${JSON.stringify(replyData)}`);
    }
    console.log(`✅ Review #${testReviewId} replied to successfully: "${replyData.data.sellerReply}"`);

    // -----------------------------------------------------------------
    // TEST 9: Store Settings, Vacation Mode & Payout Configuration
    // -----------------------------------------------------------------
    console.log("\n--- TEST 9: Store Profile, Vacation Mode & Banking ---");
    const settingsRes = await fetch(`${baseUrl}/api/seller/profile`, {
      method: "PUT",
      headers: sellerHeaders,
      body: JSON.stringify({
        shopName: "Ghosh Sweets & Dairy Heritage",
        isVacationMode: true,
        vacationMessage: "Closed for Bhai Dooj festival, reopening tomorrow at 7 AM",
        upiId: "ghoshsweets@icici",
        bankName: "HDFC Bank",
        accountHolderName: "Subrata Ghosh",
        accountNumber: "50100492819201",
        ifscCode: "HDFC0001234"
      })
    });
    const settingsData = await settingsRes.json();
    if (!settingsData.success) {
      throw new Error(`Settings update failed: ${JSON.stringify(settingsData)}`);
    }

    const checkProfileRes = await fetch(`${baseUrl}/api/seller/profile`, { headers: sellerHeaders });
    const checkProfile = await checkProfileRes.json();
    if (
      !checkProfile.data.shop.isVacationMode ||
      checkProfile.data.payoutDetails.upiId !== "ghoshsweets@icici"
    ) {
      throw new Error(`Profile fields mismatch: ${JSON.stringify(checkProfile)}`);
    }
    console.log("✅ Store settings, vacation mode, and payout details updated and verified!");

    // -----------------------------------------------------------------
    // TEST 10: Support Ticket Lifecycle
    // -----------------------------------------------------------------
    console.log("\n--- TEST 10: Support Ticket Submission & Reply ---");
    const ticketRes = await fetch(`${baseUrl}/api/seller/support`, {
      method: "POST",
      headers: sellerHeaders,
      body: JSON.stringify({
        subject: "Rider pickup area inquiry",
        category: "orders",
        priority: "medium",
        initialMessage: "Can the delivery rider call 5 minutes before arriving at Stall 45?"
      })
    });
    const ticketData = await ticketRes.json();
    if (!ticketData.success || !ticketData.data.ticketId) {
      throw new Error(`Ticket creation failed: ${JSON.stringify(ticketData)}`);
    }
    console.log(`✅ Support ticket #${ticketData.data.ticketNumber} opened successfully!`);

    // -----------------------------------------------------------------
    // TEST 11: Cleanup Test Data Safely
    // -----------------------------------------------------------------
    console.log("\n--- TEST 11: Cleanup Test Entities ---");
    await pool.query("DELETE FROM reviews WHERE review_id = ?", [testReviewId]);
    await pool.query("DELETE FROM products WHERE product_id = ?", [testProductId]);
    await pool.query("DELETE FROM users WHERE user_id = ?", [createdSellerId]);
    console.log("✅ Temporary test entities cleaned up safely.");

    console.log("\n==================================================");
    console.log("🎉 ALL 11 END-TO-END VERIFICATION TESTS PASSED!");
    console.log("==================================================");
  } catch (err) {
    console.error("❌ E2E Test Failure:", err);
    process.exitCode = 1;
  } finally {
    server.close();
    await pool.end();
    process.exit(process.exitCode || 0);
  }
}

runE2ETests();
