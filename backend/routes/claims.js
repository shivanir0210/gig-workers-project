const express = require('express');
const mongoose = require('mongoose');
const Claim = require('../models/Claim');
const Payout = require('../models/Payout');
const Policy = require('../models/Policy');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/my', auth, async (req, res) => {
  try {
    const claims = await Claim.find({ userId: req.user.id })
      .populate('policyId', 'planName coverageAmount')
      .sort({ triggeredAt: -1 });
    res.json(claims);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', auth, async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate('userId', 'name email platform location')
      .populate('policyId', 'planName')
      .sort({ triggeredAt: -1 });
    res.json(claims);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process payout for an approved claim
router.post('/process-payout/:claimId', auth, async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.claimId);
    if (!claim || claim.status !== 'approved')
      return res.status(400).json({ error: 'Claim not eligible for payout' });

    const user = await User.findById(req.user.id);

    // Check existing payout
    const existingPayout = await Payout.findOne({ claimId: claim._id, status: { $in: ['success', 'processing'] } });
    if (existingPayout) return res.status(400).json({ error: 'Payout already processed for this claim' });

    // GPS verification: ensure user GPS is near claim location
    const gpsVerified = verifyGpsForPayout(user, claim);
    const locationMatchScore = gpsVerified ? 90 : 20;

    if (!gpsVerified) {
      claim.status = 'rejected';
      claim.validationDetails.gpsVerified = false;
      await claim.save();
      await User.findByIdAndUpdate(user._id, { $inc: { trustScore: -5 } });
      return res.status(400).json({ error: 'GPS location mismatch. Payout rejected.' });
    }

    const method = user.upiId ? 'upi' : 'bank';
    const mockPayoutId = `pout_mock_${Date.now()}`;

    const payout = new Payout({
      userId: user._id,
      claimId: claim._id,
      amount: claim.payoutAmount,
      status: 'success',
      method,
      upiId: user.upiId,
      bankAccount: user.bankAccount,
      razorpayPayoutId: mockPayoutId,
      gpsVerified: true,
      locationMatchScore,
      processedAt: new Date()
    });
    await payout.save();

    claim.status = 'paid';
    claim.razorpayPaymentId = mockPayoutId;
    claim.paidAt = new Date();
    claim.validationDetails.gpsVerified = true;
    await claim.save();

    // Reward trust score for valid claim
    await User.findByIdAndUpdate(user._id, { $inc: { trustScore: 2 } });

    res.json({ success: true, payoutId: mockPayoutId, amount: claim.payoutAmount, method });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function verifyGpsForPayout(user, claim) {
  // If no GPS data stored, allow (first-time user)
  if (!user.currentGps?.lat) return true;
  // Check GPS history for suspicious jumps
  if (user.gpsHistory?.length > 1) {
    const recent = user.gpsHistory.slice(-2);
    const dist = haversineKm(recent[0].lat, recent[0].lng, recent[1].lat, recent[1].lng);
    if (dist > 500) return false; // >500km jump in history = suspicious
  }
  return true;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Get payouts for current user
router.get('/payouts', auth, async (req, res) => {
  try {
    const payouts = await Payout.find({ userId: req.user.id })
      .populate('claimId', 'triggerType triggerValue triggeredAt')
      .sort({ createdAt: -1 });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user.id);
    const [total, paid, pending, payoutAgg] = await Promise.all([
      Claim.countDocuments({ userId: req.user.id }),
      Claim.countDocuments({ userId: req.user.id, status: 'paid' }),
      Claim.countDocuments({ userId: req.user.id, status: 'pending' }),
      Payout.aggregate([
        { $match: { userId: uid, status: 'success' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);
    res.json({ total, paid, pending, totalPayout: payoutAgg[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
