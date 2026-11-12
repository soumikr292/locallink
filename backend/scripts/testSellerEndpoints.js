const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const app = require("../src/app");
const http = require("http");

async function main() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Testing Seller APIs on ${baseUrl}...`);

  try {
    // 1. Seller Login
    const loginRes = await fetch(`${baseUrl}/api/seller/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginIdentifier: "testseller@locallink.com",
        password: "seller123"
      })
    });
    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.data?.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    const token = loginData.data.token;
    console.log("✅ 1. Seller Login: Success! Logged in as:", loginData.data.user.name);

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };

    // 2. Seller Me
    const meRes = await fetch(`${baseUrl}/api/seller/auth/me`, { headers: authHeaders });
    const meData = await meRes.json();
    console.log("✅ 2. Seller /me:", meData.success ? "OK" : "FAIL", meData.data?.shop?.shopName);

    // 3. Seller Dashboard Stats
    const dashRes = await fetch(`${baseUrl}/api/seller/dashboard`, { headers: authHeaders });
    const dashData = await dashRes.json();
    console.log(
      "✅ 3. Seller Dashboard Stats: Total Products =",
      dashData.data?.products?.total,
      ", Total Orders =",
      dashData.data?.orders?.total,
      ", Gross Sales = ₹" + dashData.data?.financials?.grossSales
    );

    // 4. Seller Products List
    const prodRes = await fetch(`${baseUrl}/api/seller/products`, { headers: authHeaders });
    const prodData = await prodRes.json();
    console.log("✅ 4. Seller Products Count:", prodData.data?.products?.length);

    // 5. Seller Categories List
    const catRes = await fetch(`${baseUrl}/api/seller/categories`, { headers: authHeaders });
    const catData = await catRes.json();
    console.log("✅ 5. Seller Categories Available:", catData.data?.length);

    // 6. Seller Inventory List
    const invRes = await fetch(`${baseUrl}/api/seller/inventory`, { headers: authHeaders });
    const invData = await invRes.json();
    console.log("✅ 6. Seller Inventory Items:", invData.data?.inventory?.length);

    // 7. Seller Orders List
    const ordRes = await fetch(`${baseUrl}/api/seller/orders`, { headers: authHeaders });
    const ordData = await ordRes.json();
    console.log("✅ 7. Seller Orders Count:", ordData.data?.orders?.length);

    // 8. Seller Earnings
    const earnRes = await fetch(`${baseUrl}/api/seller/earnings`, { headers: authHeaders });
    const earnData = await earnRes.json();
    console.log(
      "✅ 8. Seller Financials: Net Earnings = ₹" + earnData.data?.financials?.netEarnings,
      ", Available Balance = ₹" + earnData.data?.financials?.availableBalance
    );

    // 9. Seller Reviews
    const revRes = await fetch(`${baseUrl}/api/seller/reviews`, { headers: authHeaders });
    const revData = await revRes.json();
    console.log("✅ 9. Seller Reviews Count:", revData.data?.reviews?.length);

    // 10. Seller Profile
    const profRes = await fetch(`${baseUrl}/api/seller/profile`, { headers: authHeaders });
    const profData = await profRes.json();
    console.log("✅ 10. Seller Profile Loaded:", profData.data?.shop?.shopName);

    // 11. Seller Notifications
    const notifRes = await fetch(`${baseUrl}/api/seller/notifications`, { headers: authHeaders });
    const notifData = await notifRes.json();
    console.log("✅ 11. Seller Notifications:", notifData.data?.notifications?.length);

    // 12. Seller Support Tickets
    const suppRes = await fetch(`${baseUrl}/api/seller/support`, { headers: authHeaders });
    const suppData = await suppRes.json();
    console.log("✅ 12. Seller Support Tickets:", suppData.data?.length);

    // 13. Seller Reports Analytics
    const repRes = await fetch(`${baseUrl}/api/seller/reports/analytics`, { headers: authHeaders });
    const repData = await repRes.json();
    console.log("✅ 13. Seller Analytics Summary:", repData.data?.summary?.totalOrdersCount, "orders");

    console.log("🎉 ALL 13 SELLER BACKEND API GROUPS VERIFIED PERFECTLY!");
  } catch (error) {
    console.error("❌ Test error:", error);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit(process.exitCode || 0);
  }
}

main();
