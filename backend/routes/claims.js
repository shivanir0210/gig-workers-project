const express  = require('express');
const mongoose = require('mongoose');
const Claim    = require('../models/Claim');
const Payout   = require('../models/Payout');
const Policy   = require('../models/Policy');
const User     = require('../models/User');
const auth     = require('../middleware/auth');
const { checkDualCityEligibility } = require('../services/weatherService');
const router   = express.Router();

// ── Submit claim ──────────────────────────────────────────────────────────────
router.post('/submit', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Gate 1: verification
    if (user.verificationStatus !== 'approved')
      return res.status(403).json({ error: 'Account not verified. Await admin approval.' });

    // Gate 2: fraud block
    if (user.fraudStatus === 'blocked')
      return res.status(403).json({ error: 'Account blocked due to fraud.' });

    // Gate 3: active policy
    const policy = await Policy.findOne({ userId: user._id, status: 'active' });
    if (!policy) return res.status(400).json({ error: 'No active policy. Purchase a plan first.' });

    // Gate 4: policy not expired
    if (policy.endDate && new Date() > policy.endDate)
      return res.status(400).json({ error: 'Policy expired. Please renew.' });

    // Gate 5: claim abuse — max 3 claims/week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekClaims = await Claim.countDocuments({ userId: user._id, triggeredAt: { $gte: oneWeekAgo } });
    if (weekClaims >= 3) {
      await User.findByIdAndUpdate(user._id, {
        $inc: { fraudScore: 20 },
        fraudStatus: 'suspicious',
        fraudReason: 'More than 3 claims in one week'
      });
      return res.status(429).json({ error: 'Claim limit reached (3 per week).' });
    }

    // Gate 6: dual-city eligibility — BOTH home and work city must be affected
    const eligibility = await checkDualCityEligibility(user);
    if (!eligibility.eligible) {
      return res.status(400).json({
        error: `Not eligible: ${eligibility.reason}`,
        eligibility
      });
    }

    const { triggerType, triggerValue, threshold, affectedCity, cityType,
            expectedIncome, actualIncome } = req.body;

    // Income loss calculation
    const incomeLoss = Math.max(0, (expectedIncome || user.averageDailyIncome) - (actualIncome || 0));
    const payoutAmount = Math.min(incomeLoss || Math.round(user.averageDailyIncome * 0.8), policy.coverageAmount);

    // Claim reason label
    const claimReason = buildClaimReason(triggerType, cityType);

    // Fraud score for this claim
    let claimFraudScore = 0;
    if (weekClaims >= 2) claimFraudScore += 25;
    if (!user.currentGps?.lat) claimFraudScore += 10;

    const claim = await Claim.create({
      userId: user._id,
      policyId: policy._id,
      affectedCity: affectedCity || (cityType === 'home' ? user.homeCity : user.workCity) || user.location.city,
      affectedLocation: claimReason,
      cityType: cityType || 'work',
      claimReason,
      triggerType, triggerValue, threshold,
      expectedIncome: expectedIncome || user.averageDailyIncome,
      actualIncome:   actualIncome   || 0,
      actualIncomeLoss: incomeLoss,
      payoutAmount,
      fraudScore: claimFraudScore,
      validationDetails: {
        gpsVerified: !!user.currentGps?.lat,
        dualCityVerified: true,
        homeCityData: { city: eligibility.homeCity, rainfall: eligibility.homeData.weather.rainfall, aqi: eligibility.homeData.aqi, temperature: eligibility.homeData.weather.temperature },
        workCityData: { city: eligibility.workCity, rainfall: eligibility.workData.weather.rainfall, aqi: eligibility.workData.aqi, temperature: eligibility.workData.weather.temperature }
      }
    });

    // Raise user fraud score if pattern detected
    if (weekClaims >= 2) {
      const newFraud = (user.fraudScore || 0) + 10;
      await User.findByIdAndUpdate(user._id, {
        fraudScore: newFraud,
        fraudStatus: newFraud >= 60 ? 'suspicious' : newFraud >= 80 ? 'blocked' : user.fraudStatus
      });
    }

    res.status(201).json(claim);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function buildClaimReason(triggerType, cityType) {
  if (triggerType === 'rainfall')    return cityType === 'home' ? 'Flood at Home Location' : 'Flood at Work Location';
  if (triggerType === 'aqi')         return 'AQI Alert';
  if (triggerType === 'temperature') return 'Extreme Temperature';
  if (triggerType === 'curfew')      return 'Curfew / Disruption';
  return 'Weather Disruption';
}

// ── My claims ─────────────────────────────────────────────────────────────────
router.get('/my', auth, async (req, res) => {
  try {
    const claims = await Claim.find({ userId: req.user.id })
      .populate('policyId', 'planName coverageAmount')
      .sort({ triggeredAt: -1 });
    res.json(claims);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/all', auth, async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate('userId', 'name email platform location verificationStatus')
      .populate('policyId', 'planName')
      .sort({ triggeredAt: -1 });
    res.json(claims);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Process payout ────────────────────────────────────────────────────────────
router.post('/process-payout/:claimId', auth, async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.claimId);
    if (!claim || claim.status !== 'approved')
      return res.status(400).json({ error: 'Claim not eligible for payout' });

    const user = await User.findById(req.user.id);
    if (user.verificationStatus !== 'approved') {
      return res.status(403).json({ error: 'Account not verified. Await admin approval.' });
    }

    const existing = await Payout.findOne({ claimId: claim._id, status: { $in: ['success', 'processing'] } });
    if (existing) return res.status(400).json({ error: 'Payout already processed' });

    if (!verifyGps(user)) {
      claim.status = 'rejected';
      claim.validationDetails.gpsVerified = false;
      await claim.save();
      await User.findByIdAndUpdate(user._id, { $inc: { trustScore: -5 } });
      return res.status(400).json({ error: 'GPS location mismatch. Payout rejected.' });
    }

    const method = user.upiId ? 'upi' : 'bank';
    const mockPayoutId = `pout_mock_${Date.now()}`;

    await Payout.create({
      userId: user._id, claimId: claim._id, amount: claim.payoutAmount,
      status: 'success', method, upiId: user.upiId, bankAccount: user.bankAccount,
      razorpayPayoutId: mockPayoutId, gpsVerified: true, locationMatchScore: 90, processedAt: new Date()
    });

    claim.status = 'paid';
    claim.razorpayPaymentId = mockPayoutId;
    claim.paidAt = new Date();
    claim.validationDetails.gpsVerified = true;
    await claim.save();

    await User.findByIdAndUpdate(user._id, { $inc: { trustScore: 2 } });
    res.json({ success: true, payoutId: mockPayoutId, amount: claim.payoutAmount, method });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function verifyGps(user) {
  if (!user.currentGps?.lat) return true;
  if (user.gpsHistory?.length > 1) {
    const recent = user.gpsHistory.slice(-2);
    const dist = haversineKm(recent[0].lat, recent[0].lng, recent[1].lat, recent[1].lng);
    if (dist > 500) return false;
  }
  return true;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user.id);
    const [total, paid, pending, payoutAgg] = await Promise.all([
      Claim.countDocuments({ userId: req.user.id }),
      Claim.countDocuments({ userId: req.user.id, status: 'paid' }),
      Claim.countDocuments({ userId: req.user.id, status: 'pending' }),
      Payout.aggregate([{ $match: { userId: uid, status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    ]);
    res.json({ total, paid, pending, totalPayout: payoutAgg[0]?.total || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/payouts', auth, async (req, res) => {
  try {
    const payouts = await Payout.find({ userId: req.user.id })
      .populate('claimId', 'triggerType triggerValue triggeredAt')
      .sort({ createdAt: -1 });
    res.json(payouts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
