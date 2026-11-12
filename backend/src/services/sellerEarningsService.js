const { pool } = require("../config/database");

// Get seller earnings overview
async function getSellerEarningsOverview(sellerId) {
  let connection;

  try {
    connection = await pool.getConnection();

    // Fetch profile
    const profileRows = await connection.query(
      `SELECT commission_rate, upi_id, bank_name, account_holder_name, account_number, ifsc_code
       FROM seller_profiles
       WHERE seller_id = ?
       LIMIT 1`,
      [Number(sellerId)]
    );

    const profile = profileRows[0] || {};
    const commissionRate = Number(profile.commission_rate || 5.0);

    // Paid sales
    const salesRows = await connection.query(
      `SELECT
         COALESCE(SUM(oi.final_price), 0) AS grossPaidSales,
         COUNT(DISTINCT oi.order_id) AS totalPaidOrders,
         COALESCE(SUM(oi.quantity), 0) AS totalItemsSold
       FROM order_items oi
       INNER JOIN orders o ON oi.order_id = o.order_id
       WHERE oi.seller_id = ?
         AND o.payment_status = 'paid'
         AND o.order_status NOT IN ('cancelled', 'refunded')`,
      [Number(sellerId)]
    );

    const grossSales = Number(salesRows[0]?.grossPaidSales || 0);
    const marketplaceFee = Number((grossSales * (commissionRate / 100)).toFixed(2));
    const netEarnings = Number((grossSales - marketplaceFee).toFixed(2));

    // Pending payment sales
    const pendingRows = await connection.query(
      `SELECT COALESCE(SUM(oi.final_price), 0) AS pendingSales
       FROM order_items oi
       INNER JOIN orders o ON oi.order_id = o.order_id
       WHERE oi.seller_id = ?
         AND o.payment_status = 'pending'
         AND o.order_status NOT IN ('cancelled', 'refunded')`,
      [Number(sellerId)]
    );

    const pendingSales = Number(pendingRows[0]?.pendingSales || 0);

    // Payout stats
    const payoutRows = await connection.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) AS completedPayouts,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pendingPayouts,
         COALESCE(SUM(CASE WHEN status = 'processing' THEN amount ELSE 0 END), 0) AS processingPayouts
       FROM seller_payouts
       WHERE seller_id = ?`,
      [Number(sellerId)]
    );

    const completedPayouts = Number(payoutRows[0]?.completedPayouts || 0);
    const pendingPayouts = Number(payoutRows[0]?.pendingPayouts || 0);
    const processingPayouts = Number(payoutRows[0]?.processingPayouts || 0);

    const availableBalance = Number(
      Math.max(0, netEarnings - completedPayouts - pendingPayouts - processingPayouts).toFixed(2)
    );

    // Recent payout records
    const payouts = await connection.query(
      `SELECT
         payout_id,
         amount,
         payout_method,
         payout_details,
         status,
         transaction_reference,
         admin_notes,
         requested_at,
         processed_at
       FROM seller_payouts
       WHERE seller_id = ?
       ORDER BY requested_at DESC
       LIMIT 20`,
      [Number(sellerId)]
    );

    // Recent transactions / sales records
    const transactions = await connection.query(
      `SELECT
         oi.order_item_id,
         o.order_id,
         o.order_number,
         oi.product_name,
         oi.quantity,
         oi.final_price,
         ROUND(oi.final_price * (? / 100), 2) AS commission_deducted,
         ROUND(oi.final_price - (oi.final_price * (? / 100)), 2) AS seller_net,
         o.payment_status,
         o.created_at
       FROM order_items oi
       INNER JOIN orders o ON oi.order_id = o.order_id
       WHERE oi.seller_id = ?
       ORDER BY o.created_at DESC
       LIMIT 20`,
      [commissionRate, commissionRate, Number(sellerId)]
    );

    return {
      financials: {
        grossSales,
        commissionRate,
        marketplaceFee,
        netEarnings,
        pendingSales,
        completedPayouts,
        pendingPayouts,
        processingPayouts,
        availableBalance
      },
      paymentSettings: {
        upiId: profile.upi_id,
        bankName: profile.bank_name,
        accountHolderName: profile.account_holder_name,
        accountNumber: profile.account_number ? `****${profile.account_number.slice(-4)}` : null,
        ifscCode: profile.ifsc_code,
        isConfigured: Boolean(profile.upi_id || profile.account_number)
      },
      payouts: payouts.map((p) => ({
        payoutId: Number(p.payout_id),
        amount: Number(p.amount),
        payoutMethod: p.payout_method,
        payoutDetails: p.payout_details,
        status: p.status,
        transactionReference: p.transaction_reference,
        adminNotes: p.admin_notes,
        requestedAt: p.requested_at,
        processedAt: p.processed_at
      })),
      transactions: transactions.map((t) => ({
        orderItemId: Number(t.order_item_id),
        orderId: Number(t.order_id),
        orderNumber: t.order_number,
        productName: t.product_name,
        quantity: Number(t.quantity),
        finalPrice: Number(t.final_price),
        commissionDeducted: Number(t.commission_deducted),
        sellerNet: Number(t.seller_net),
        paymentStatus: t.payment_status,
        createdAt: t.created_at
      }))
    };
  } finally {
    if (connection) connection.release();
  }
}

// Request payout
async function requestSellerPayout(sellerId, { amount, payoutMethod = "upi", payoutDetails = "" }) {
  let connection;

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount < 100) {
    const error = new Error("Minimum payout request amount is ₹100");
    error.statusCode = 400;
    throw error;
  }

  try {
    connection = await pool.getConnection();

    // Check available balance
    const overview = await getSellerEarningsOverview(sellerId);
    if (numAmount > overview.financials.availableBalance) {
      const error = new Error(
        `Requested amount (₹${numAmount}) exceeds available balance (₹${overview.financials.availableBalance})`
      );
      error.statusCode = 400;
      throw error;
    }

    // Default payout details from profile if not provided
    let details = payoutDetails;
    if (!details) {
      if (payoutMethod === "upi") {
        details = overview.paymentSettings.upiId || `UPI-${sellerId}@locallink`;
      } else {
        details = `${overview.paymentSettings.bankName || "Bank"} - ${overview.paymentSettings.accountNumber || "A/C"}`;
      }
    }

    await connection.query(
      `INSERT INTO seller_payouts (
         seller_id, amount, payout_method, payout_details, status
       ) VALUES (?, ?, ?, ?, 'pending')`,
      [Number(sellerId), numAmount, payoutMethod, details]
    );

    // Add in-app notification
    await connection.query(
      `INSERT INTO seller_notifications (seller_id, title, message, type)
       VALUES (?, ?, ?, 'payout')`,
      [
        Number(sellerId),
        "Payout Request Submitted",
        `Your payout request for ₹${numAmount} via ${payoutMethod.toUpperCase()} has been submitted. It will be verified and disbursed shortly.`
      ]
    );

    return {
      message: "Payout request submitted successfully and is pending admin verification.",
      amount: numAmount,
      payoutMethod,
      payoutDetails: details
    };
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  getSellerEarningsOverview,
  requestSellerPayout
};
