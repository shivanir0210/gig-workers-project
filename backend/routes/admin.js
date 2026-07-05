const express        = require('express');
const User           = require('../models/User');
const Policy         = require('../models/Policy');
const Claim          = require('../models/Claim');
const Payment        = require('../models/Payment');
const RiskData       = require('../models/RiskData');
const InsurancePool  = require('../models/InsurancePool');
const { authenticateAdmin } = require('../middleware/auth');
const router         = express.Router();

router.use(authenticateAdmin);

// ── Overview ──────────────────────────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const [totalUsers, activeUsers, pendingVerification, activePolicies,
           totalClaims, paidClaims, pendingClaims, rejectedClaims,
           premiumAgg, payoutAgg, fraudBlocked, fraudSuspicious] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', isActive: true }),
      User.countDocuments({ role: 'user', verificationStatus: 'pending' }),
      Policy.countDocuments({ status: 'active' }),
      Claim.countDocuments(),
      Claim.countDocuments({ status: 'paid' }),
      Claim.countDocuments({ status: 'pending' }),
      Claim.countDocuments({ status: 'rejected' }),
      Payment.aggregate([{ $match: { status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Claim.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$payoutAmount' } } }]),
      User.countDocuments({ fraudStatus: 'blocked' }),
      User.countDocuments({ fraudStatus: { $in: ['suspicious', 'review'] } })
    ]);
    const totalPremiumCollection = premiumAgg[0]?.total || 0;
    const totalPayouts           = payoutAgg[0]?.total  || 0;
    res.json({
      totalUsers, activeUsers, pendingVerification, activePolicies,
      totalClaims, paidClaims, pendingClaims, rejectedClaims,
      totalPremiumCollection, totalPayouts,
      availablePool: totalPremiumCollection - totalPayouts,
      fraudBlocked, fraudSuspicious
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Worker Verification ───────────────────────────────────────────────────────
router.get('/pending-workers', async (req, res) => {
  try {
    const workers = await User.find({ role: 'user', verificationStatus: 'pending' })
      .select('-password -gpsHistory').sort({ createdAt: -1 });
    res.json(workers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/verify-worker/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { verificationStatus: status, verificationDate: new Date() },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Fraud Center ──────────────────────────────────────────────────────────────
router.get('/fraud-users', async (req, res) => {
  try {
    const users = await User.find({ fraudStatus: { $in: ['review', 'suspicious', 'blocked'] } })
      .select('-password -gpsHistory').sort({ fraudScore: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/fraud-claims', async (req, res) => {
  try {
    const claims = await Claim.find({ fraudScore: { $gt: 30 } })
      .populate('userId', 'name email platform fraudStatus')
      .sort({ fraudScore: -1 }).limit(50);
    res.json(claims);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/update-fraud/:userId', async (req, res) => {
  try {
    const { fraudStatus, fraudReason } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { fraudStatus, fraudReason, isActive: fraudStatus !== 'blocked' },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/fraud-analysis', async (req, res) => {
  try {
    const allUsers = await User.find({ role: 'user' }).select('-password -gpsHistory');
    const flagged = [];
    for (const u of allUsers) {
      const reasons = []; let score = 0;
      const dup = (field, pts, label) => {
        const matches = allUsers.filter(x => x[field] && x[field] === u[field] && x._id.toString() !== u._id.toString());
        if (matches.length) { reasons.push(`${label} with ${matches.map(p=>p.name).join(', ')}`); score += pts; }
      };
      dup('phone', 30, 'Duplicate Phone'); dup('email', 30, 'Duplicate Email');
      dup('workerId', 40, 'Duplicate Worker ID'); dup('aadhaarNumber', 50, 'Duplicate Aadhaar');
      if (u.ipAddress) {
        const dupIp = allUsers.filter(x => x.ipAddress === u.ipAddress && x._id.toString() !== u._id.toString());
        if (dupIp.length > 1) { reasons.push(`Multiple accounts on same IP`); score += 20; }
      }
      if (reasons.length || u.fraudStatus !== 'safe') {
        const finalScore  = Math.min(100, (u.fraudScore || 0) + score);
        const finalStatus = u.fraudStatus !== 'safe' ? u.fraudStatus : (finalScore >= 60 ? 'suspicious' : 'review');
        if (u.fraudScore !== finalScore || u.fraudStatus !== finalStatus) {
          await User.findByIdAndUpdate(u._id, { fraudScore: finalScore, fraudStatus: finalStatus, fraudReason: reasons.join('; ') });
        }
        flagged.push({ _id: u._id, name: u.name, email: u.email, phone: u.phone, platform: u.platform,
          workerId: u.workerId, fraudScore: finalScore, fraudStatus: finalStatus,
          fraudReason: reasons.join('; ') || u.fraudReason || 'Flagged for review', isActive: u.isActive });
      }
    }
    res.json(flagged.sort((a,b) => b.fraudScore - a.fraudScore));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Claims Management ─────────────────────────────────────────────────────────
router.get('/all-claims', async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate('userId', 'name email platform verificationStatus fraudStatus')
      .populate('policyId', 'planName').sort({ triggeredAt: -1 });
    res.json(claims);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/claim-action/:claimId', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'investigating'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });
    const claim = await Claim.findByIdAndUpdate(req.params.claimId, { status }, { new: true });
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (status === 'approved') {
      await InsurancePool.findOneAndUpdate({},
        { $inc: { totalClaimsPaid: claim.payoutAmount, availablePool: -claim.payoutAmount } },
        { upsert: true });
    }
    res.json(claim);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Insurance Pool ────────────────────────────────────────────────────────────
router.get('/pool', async (req, res) => {
  try {
    const [premiumAgg, claimsAgg] = await Promise.all([
      Payment.aggregate([{ $match: { status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Claim.aggregate([{ $match: { status: { $in: ['paid', 'approved'] } } }, { $group: { _id: null, total: { $sum: '$payoutAmount' } } }])
    ]);
    const totalPremiumCollected = premiumAgg[0]?.total || 0;
    const totalClaimsPaid       = claimsAgg[0]?.total  || 0;
    res.json({ totalPremiumCollected, totalClaimsPaid, availablePool: totalPremiumCollected - totalClaimsPaid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Users list ────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const page  = parseInt(req.query.page  || 1);
    const limit = parseInt(req.query.limit || 20);
    const users = await User.find({ role: 'user' }).select('-password -gpsHistory')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    const total = await User.countDocuments({ role: 'user' });
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/claim-analytics', async (req, res) => {
  try {
    const [byTrigger, byStatus, byCityType] = await Promise.all([
      Claim.aggregate([{ $group: { _id: '$triggerType', count: { $sum: 1 }, totalPayout: { $sum: '$payoutAmount' } } }]),
      Claim.aggregate([{ $group: { _id: '$status',      count: { $sum: 1 } } }]),
      Claim.aggregate([{ $group: { _id: '$cityType',    count: { $sum: 1 }, totalPayout: { $sum: '$payoutAmount' } } }])
    ]);
    res.json({ byTrigger, byStatus, byCityType });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/platform-analytics', async (req, res) => {
  try {
    const data = await User.aggregate([
      { $match: { role: 'user' } },
      { $group: { _id: '$platform', count: { $sum: 1 }, avgIncome: { $avg: '$weeklyIncome' }, avgRiskScore: { $avg: '$riskScore' } } }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/high-risk-cities', async (req, res) => {
  try {
    const data = await RiskData.aggregate([
      { $sort: { recordedAt: -1 } },
      { $group: { _id: '$city', disruptionLevel: { $first: '$disruptionLevel' }, aqi: { $first: '$aqi' }, rainfall: { $first: '$weather.rainfall' } } },
      { $match: { disruptionLevel: { $in: ['high', 'extreme'] } } }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/risk-analytics', async (req, res) => {
  try {
    const data = await RiskData.aggregate([
      { $sort: { recordedAt: -1 } },
      { $group: { _id: '$city', latestRisk: { $first: '$disruptionLevel' }, avgAqi: { $avg: '$aqi' }, avgRainfall: { $avg: '$weather.rainfall' }, avgTemp: { $avg: '$weather.temperature' }, records: { $sum: 1 } } }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
