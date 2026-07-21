const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Policy = require('../models/Policy');
const User = require('../models/User');
const InsurancePool = require('../models/InsurancePool');
const auth = require('../middleware/auth');
const notify = require('../services/notify');
const { calculateUserPremium } = require('../services/premiumService');
const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

function assertRazorpayConfigured() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  console.log('[Razorpay Config Check] Key ID present:', !!keyId, '| Key Secret present:', !!keySecret);

  if (!keyId || !keySecret) {
    const e = new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing from environment variables');
    e.code = 'RAZORPAY_NOT_CONFIGURED';
    throw e;
  }
}

// ── Create Order Controller ───────────────────────────────────────────────────
const createOrder = async (req, res) => {
  try {
    console.log('[Razorpay Create Order] User:', req.user?.id, '| Body:', req.body);
    assertRazorpayConfigured();

    const { planType = 'Premium' } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.verificationStatus !== 'approved') {
      return res.status(403).json({ success: false, message: 'Account not verified. Await admin approval.' });
    }

    const dynamicCalc = await calculateUserPremium(user, null, null, planType);
    const amount = Math.max(49, dynamicCalc.premiumAmount);

    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: { userId: user._id.toString(), planType }
    });

    console.log('[Razorpay Create Order] Created order ID:', order.id, '| Amount (INR):', amount);

    const payment = new Payment({
      userId: user._id,
      amount,
      type: 'premium',
      paymentStatus: 'created',
      status: 'created',
      razorpayOrderId: order.id,
      description: `Premium payment for ${planType} plan`
    });
    await payment.save();

    return res.json({
      success: true,
      orderId: order.id,
      amount,
      currency: 'INR',
      paymentId: payment._id,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('[Razorpay Create Order Error] Stack trace:\n', err.stack || err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to create payment order' });
  }
};

// ── Verify Payment Controller ────────────────────────────────────────────────
const verifyPayment = async (req, res) => {
  try {
    console.log('====================================================');
    console.log('[Razorpay Verify] Step 1: Authentication user ID:', req.user?.id);
    console.log('[Razorpay Verify] Step 2: Incoming request body:', req.body);

    assertRazorpayConfigured();

    // Support both snake_case and camelCase parameters
    const razorpayOrderId = req.body.razorpay_order_id || req.body.razorpayOrderId;
    const razorpayPaymentId = req.body.razorpay_payment_id || req.body.razorpayPaymentId;
    const razorpaySignature = req.body.razorpay_signature || req.body.razorpaySignature;
    const dbPaymentId = req.body.paymentId || req.body._id;
    const planType = req.body.planType || 'Premium';

    console.log('[Razorpay Verify] Step 3: Extracted params ->', {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature: razorpaySignature ? `${razorpaySignature.substring(0, 10)}...` : null,
      dbPaymentId,
      planType
    });

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      console.warn('[Razorpay Verify] Missing required payment parameters');
      return res.status(400).json({
        success: false,
        message: 'Missing required payment details (razorpay_order_id, razorpay_payment_id, or razorpay_signature)'
      });
    }

    // Razorpay HMAC SHA256 Signature Verification
    const bodyStr = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(bodyStr)
      .digest('hex');

    console.log('[Razorpay Verify] Step 4: Signature check ->');
    console.log('  Generated Signature :', generatedSignature);
    console.log('  Received Signature  :', razorpaySignature);

    if (generatedSignature !== razorpaySignature) {
      console.error('[Razorpay Verify] Signature mismatch!');
      if (dbPaymentId) {
        await Payment.findByIdAndUpdate(dbPaymentId, { paymentStatus: 'failed', status: 'failed' }).catch(() => {});
      }
      return res.status(400).json({
        success: false,
        message: 'Signature verification failed. Invalid secret key or payload tampered.'
      });
    }

    console.log('[Razorpay Verify] Signature matched successfully!');

    // Fetch user and payment record
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Authenticated user not found in database' });
    }

    let payment = null;
    if (dbPaymentId) {
      payment = await Payment.findById(dbPaymentId);
    }
    if (!payment && razorpayOrderId) {
      payment = await Payment.findOne({ razorpayOrderId });
    }

    if (!payment) {
      console.log('[Razorpay Verify] Creating new Payment document...');
      payment = new Payment({
        userId: user._id,
        amount: req.body.amount || 149,
        type: 'premium',
        razorpayOrderId,
        description: `Premium payment for ${planType} plan`
      });
    }

    // Mark payment as success
    payment.paymentStatus = 'success';
    payment.status = 'success';
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.paymentSignature = razorpaySignature;
    payment.paymentDate = new Date();
    payment.paidAt = new Date();
    await payment.save();

    console.log('[Razorpay Verify] Step 5: Saved Payment ID:', payment._id);

    // Update Insurance Pool
    await InsurancePool.findOneAndUpdate(
      {},
      { $inc: { totalPremiumCollected: payment.amount, availablePool: payment.amount }, updatedAt: new Date() },
      { upsert: true }
    );

    // Policy Activation / Update (Query policy FIRST before computing dates)
    let policy = await Policy.findOne({ userId: user._id, policyStatus: 'ACTIVE' }).sort({ createdAt: -1 });

    const dynamicCalc = await calculateUserPremium(user, null, null, planType);
    const durationDays = planType?.toLowerCase().includes('monthly') ? 30 : 30; // Monthly 30 days for parametric plans
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    if (!policy) {
      const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
      policy = new Policy({
        userId: user._id,
        planName: dynamicCalc.planName || 'Premium Protect',
        premiumAmount: payment.amount || dynamicCalc.premiumAmount,
        weeklyPremium: payment.amount || dynamicCalc.premiumAmount,
        coverageAmount: dynamicCalc.coverageAmount || 25000,
        paymentFrequency: 'Monthly',
        riskLevel: dynamicCalc.riskLevel || 'Medium',
        calculation: dynamicCalc.calculation,
        coverageType: ['rainfall', 'aqi', 'temperature', 'curfew'],
        thresholds: { rainfall: 50, aqi: 200, temperature: 42 },
        policyStatus: 'ACTIVE',
        status: 'ACTIVE',
        policyStartDate: startDate,
        startDate,
        policyEndDate: endDate,
        endDate,
        expiryDate: endDate,
        nextDueDate: endDate,
        paidInstallments: 1,
        lastPaymentDate: startDate,
        autoRenew: true,
        paymentHistory: [{
          invoiceNo,
          paymentDate: startDate,
          amount: payment.amount || dynamicCalc.premiumAmount,
          method: 'Razorpay',
          status: 'Paid',
          receiptUrl: `/api/policies/download`
        }]
      });
    } else {
      policy.policyStatus = 'ACTIVE';
      policy.status = 'ACTIVE';
      policy.nextDueDate = endDate;
      policy.policyEndDate = endDate;
      policy.endDate = endDate;
      policy.expiryDate = endDate;
      policy.premiumAmount = payment.amount || policy.premiumAmount;
      policy.weeklyPremium = payment.amount || policy.weeklyPremium;
      policy.calculation = dynamicCalc.calculation;
      policy.lastPaymentDate = startDate;
      policy.paidInstallments = (policy.paidInstallments || 1) + 1;
      policy.paymentHistory.push({
        invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
        paymentDate: startDate,
        amount: payment.amount || policy.premiumAmount,
        method: 'Razorpay',
        status: 'Paid',
        receiptUrl: `/api/policies/${policy._id}/download`
      });
    }

    await policy.save();

    payment.policyId = policy._id;
    await payment.save();

    console.log('[Razorpay Verify] Step 6: Policy saved & linked -> Policy ID:', policy._id);

    // Notifications
    notify.policyActivated(user._id, policy.planName, policy.coverageAmount).catch(() => {});
    notify.paymentSuccess(user._id, payment.amount, policy.planName).catch(() => {});

    console.log('====================================================');

    return res.json({
      success: true,
      message: 'Payment verified and policy activated successfully',
      policy,
      payment
    });
  } catch (err) {
    console.error('====================================================');
    console.error('[Razorpay Verify Error] Stack trace:\n', err.stack || err);
    console.error('====================================================');

    return res.status(500).json({
      success: false,
      message: err.message || 'Payment verification failed',
      error: err.message
    });
  }
};

// ── Payment History Controller ───────────────────────────────────────────────
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .populate('policyId', 'planName')
      .sort({ createdAt: -1 });
    return res.json(payments);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Payment Stats Controller ──────────────────────────────────────────────────
const getPaymentStats = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const uid = new mongoose.Types.ObjectId(req.user.id);
    const [totalPremiums, successCount, failedCount] = await Promise.all([
      Payment.aggregate([
        { $match: { userId: uid, status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.countDocuments({ userId: uid, status: 'success' }),
      Payment.countDocuments({ userId: uid, status: 'failed' })
    ]);
    return res.json({
      totalPremiumsPaid: totalPremiums[0]?.total || 0,
      successCount,
      failedCount,
      successRate: successCount + failedCount > 0
        ? Math.round((successCount / (successCount + failedCount)) * 100)
        : 0
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── Routes Registration ───────────────────────────────────────────────────────
router.post('/create-order', auth, createOrder);
router.post('/verify', auth, verifyPayment);
router.get('/history', auth, getPaymentHistory);
router.get('/stats', auth, getPaymentStats);

module.exports = router;
module.exports.verifyPayment = verifyPayment;
module.exports.createOrder = createOrder;
