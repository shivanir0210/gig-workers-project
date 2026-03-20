const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Policy = require('../models/Policy');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

const isMock = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'your_razorpay_key_id';

// Create Razorpay order for premium payment
router.post('/create-order', auth, async (req, res) => {
  try {
    const { planType } = req.body;
    const user = await User.findById(req.user.id);

    const PLANS = { basic: 1, standard: 1.5, premium: 2 };
    const multiplier = PLANS[planType] || 1.5;
    const amount = Math.round(user.weeklyPremium * multiplier);

    if (amount <= 0) {
      return res.json({
        orderId: `order_free_${Date.now()}`,
        amount: 0,
        currency: 'INR',
        paymentId: 'free',
        isFree: true
      });
    }

    let orderId;
    let fallbackToMock = isMock;
    if (!fallbackToMock) {
      try {
        console.log(`[Payment] Creating Razorpay order for Rs ${amount}`);
        const order = await razorpay.orders.create({
          amount: amount * 100, // paise
          currency: 'INR',
          receipt: `rcpt_${Date.now()}`,
          notes: { userId: user._id.toString(), planType }
        });
        orderId = order.id;
      } catch (rzpErr) {
        console.warn('Razorpay order creation failed (likely invalid keys). Falling back to mock.');
        fallbackToMock = true;
      }
    }

    if (fallbackToMock) {
      orderId = `order_mock_${Date.now()}`;
    }

    const payment = new Payment({
      userId: user._id,
      amount,
      type: 'premium',
      status: 'created',
      razorpayOrderId: orderId,
      description: `Weekly premium - ${planType} plan`
    });
    await payment.save();

    res.json({
      orderId,
      amount,
      currency: 'INR',
      paymentId: payment._id,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      isMock: fallbackToMock
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify payment and activate policy
router.post('/verify', auth, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentId, planType, isMock } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment record not found' });

    // Signature verification (skip for mock)
    if (!isMock) {
      const body = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
      if (expectedSig !== razorpaySignature) {
        payment.status = 'failed';
        await payment.save();
        return res.status(400).json({ error: 'Payment verification failed' });
      }
    }

    payment.status = 'success';
    payment.razorpayPaymentId = razorpayPaymentId || `pay_mock_${Date.now()}`;
    payment.razorpaySignature = razorpaySignature || 'mock_sig';
    payment.paidAt = new Date();
    await payment.save();

    // Activate policy
    const user = await User.findById(req.user.id);
    const PLANS = {
      basic: { name: 'Basic Shield', multiplier: 1, coverageMultiplier: 0.5, coverageTypes: ['rainfall', 'aqi'] },
      standard: { name: 'Standard Guard', multiplier: 1.5, coverageMultiplier: 0.75, coverageTypes: ['rainfall', 'aqi', 'temperature'] },
      premium: { name: 'Premium Protect', multiplier: 2, coverageMultiplier: 1, coverageTypes: ['rainfall', 'aqi', 'temperature', 'curfew'] }
    };
    const plan = PLANS[planType] || PLANS.standard;

    const existing = await Policy.findOne({ userId: user._id, status: 'active' });
    if (!existing) {
      const policy = new Policy({
        userId: user._id,
        planName: plan.name,
        weeklyPremium: Math.round(user.weeklyPremium * plan.multiplier),
        coverageAmount: Math.round(user.weeklyIncome * plan.coverageMultiplier),
        coverageType: plan.coverageTypes,
        thresholds: { rainfall: 50, aqi: 200, temperature: 42 },
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      await policy.save();
      payment.policyId = policy._id;
      await payment.save();
      return res.json({ success: true, policy, payment });
    }

    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .populate('policyId', 'planName')
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: payment stats
router.get('/stats', auth, async (req, res) => {
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
    res.json({
      totalPremiumsPaid: totalPremiums[0]?.total || 0,
      successCount,
      failedCount,
      successRate: successCount + failedCount > 0
        ? Math.round((successCount / (successCount + failedCount)) * 100)
        : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
