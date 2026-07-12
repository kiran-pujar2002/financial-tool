const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { query, getClient } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, HttpError } = require('../middleware/errorHandler');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const router = express.Router();

const PRICE_PER_REPORT = parseInt(process.env.PRICE_PER_REPORT || '4241500', 10); // paise
const PRICE_ENTERPRISE = parseInt(process.env.PRICE_ENTERPRISE_YEARLY || '80000000', 10); // paise

// ---------------------------------------------------------------
// POST /api/payments/order — create a Razorpay Order for the standard
// Orders API + Checkout.js flow. The frontend takes the returned orderId
// and opens the Razorpay Checkout modal directly — no redirect, no
// hosted payment page, no webhook needed for the payment to complete.
//
// body: { type: 'per_report', reportId } | { type: 'enterprise_subscription' }
// ---------------------------------------------------------------
router.post('/order', authenticate, asyncHandler(async (req, res) => {
  const { type, reportId } = req.body;

  if (!['per_report', 'enterprise_subscription'].includes(type)) {
    throw new HttpError(400, 'Invalid payment type');
  }

  let report = null;
  if (type === 'per_report') {
    if (!reportId) throw new HttpError(400, 'reportId is required for per-report payment');
    const result = await query('SELECT * FROM reports WHERE id = $1 AND user_id = $2', [reportId, req.user.id]);
    if (result.rows.length === 0) throw new HttpError(404, 'Report not found');
    report = result.rows[0];
    if (report.payment_status === 'paid') throw new HttpError(400, 'Report is already paid for');
  }

  const userResult = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = userResult.rows[0];

  const isSubscription = type === 'enterprise_subscription';
  const amount = isSubscription ? PRICE_ENTERPRISE : PRICE_PER_REPORT; // paise

  // Razorpay requires a receipt id under 40 chars — report id + timestamp is unique enough.
  const receipt = `${type}_${(reportId || user.id).slice(0, 8)}_${Date.now()}`.slice(0, 40);

  const order = await razorpay.orders.create({
    amount,
    currency: 'INR',
    receipt,
    notes: {
      userId: user.id,
      reportId: report ? report.id : '',
      type,
    },
  });

  await query(
    `INSERT INTO payments (user_id, report_id, razorpay_order_id, amount, currency, type, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'created')`,
    [user.id, report ? report.id : null, order.id, amount / 100, 'inr', type]
  );

  res.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    name: 'Ledger',
    description: isSubscription
      ? 'Enterprise Plan — Unlimited QOE Reports (Annual)'
      : `QOE Report — ${report.business_name}`,
    prefill: {
      name: user.full_name,
      email: user.email,
    },
  });
}));

// ---------------------------------------------------------------
// POST /api/payments/verify — called by the frontend's Checkout.js
// `handler` callback once the customer completes payment in the modal.
// Verifies the signature server-side, then atomically marks the payment
// succeeded and applies the side effect (report paid / enterprise plan).
//
// body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// ---------------------------------------------------------------
router.post('/verify', authenticate, asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new HttpError(400, 'Missing payment verification fields');
  }

  // Signature is HMAC_SHA256(order_id + "|" + payment_id, key_secret) per
  // Razorpay's documented verification scheme for Orders + Checkout.js.
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isValid =
    expectedSignature.length === razorpay_signature.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature));

  if (!isValid) {
    throw new HttpError(400, 'Payment signature verification failed');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Row-level lock + status guard: this UPDATE only succeeds once, the
    // first time a given order transitions from 'created' to 'succeeded'.
    // A second call (double-click, retry, replay) affects zero rows here,
    // so the side effect below never runs twice for the same payment.
    const updateResult = await client.query(
      `UPDATE payments SET status = 'succeeded', razorpay_payment_id = $1, razorpay_signature = $2
       WHERE razorpay_order_id = $3 AND user_id = $4 AND status = 'created'
       RETURNING *`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id, req.user.id]
    );

    if (updateResult.rows.length === 0) {
      // Either it doesn't belong to this user, doesn't exist, or was
      // already processed — check which, to give an accurate response.
      const existing = await client.query(
        `SELECT * FROM payments WHERE razorpay_order_id = $1 AND user_id = $2`,
        [razorpay_order_id, req.user.id]
      );
      await client.query('COMMIT');

      if (existing.rows.length === 0) throw new HttpError(404, 'Order not found');
      if (existing.rows[0].status === 'succeeded') {
        return res.json({ success: true, alreadyProcessed: true });
      }
      throw new HttpError(400, `Unexpected payment status: ${existing.rows[0].status}`);
    }

    const payment = updateResult.rows[0];

    if (payment.type === 'per_report' && payment.report_id) {
      await client.query("UPDATE reports SET payment_status = 'paid' WHERE id = $1", [payment.report_id]);
    } else if (payment.type === 'enterprise_subscription') {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      await client.query('UPDATE users SET plan = $1, plan_expires_at = $2 WHERE id = $3', [
        'enterprise', expiresAt, payment.user_id,
      ]);
    }

    await client.query('COMMIT');
    res.json({ success: true, alreadyProcessed: false });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

module.exports = router;