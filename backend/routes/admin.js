const express        = require('express');
const User           = require('../models/User');
const Policy         = require('../models/Policy');
const Claim          = require('../models/Claim');
const Payment        = require('../models/Payment');
const RiskData       = require('../models/RiskData');
const InsurancePool  = require('../models/InsurancePool');
const Notification   = require('../models/Notification');
const Alert          = require('../models/Alert');
const PremiumHistory = require('../models/PremiumHistory');
const ClaimHistory   = require('../models/ClaimHistory');
const VerificationLog = require('../models/VerificationLog');
const { authenticateAdmin } = require('../middleware/auth');
const notify = require('../services/notify');
const { checkCityDisruption } = require('../services/weatherService');
const router         = express.Router();

router.use(authenticateAdmin);

// ── Overview ──────────────────────────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const [totalUsers, activeUsers, pendingVerification, autoVerifiedWorkers,
           pendingManualReview, rejectedVerification, activePolicies,
           totalClaims, paidClaims, pendingClaims, rejectedClaims,
           premiumAgg, payoutAgg, fraudBlocked, fraudSuspicious, avgOcrConfidenceAgg] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', isActive: true }),
      User.countDocuments({ role: 'user', verificationStatus: { $in: ['pending', 'pending_manual_review', 'auto_verified'] } }),
      User.countDocuments({ role: 'user', verificationStatus: 'auto_verified' }),
      User.countDocuments({ role: 'user', verificationStatus: 'pending_manual_review' }),
      User.countDocuments({ role: 'user', verificationStatus: 'rejected' }),
      Policy.countDocuments({ status: 'active' }),
      Claim.countDocuments(),
      Claim.countDocuments({ status: 'paid' }),
      Claim.countDocuments({ status: 'pending' }),
      Claim.countDocuments({ status: 'rejected' }),
      Payment.aggregate([{ $match: { status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Claim.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$payoutAmount' } } }]),
      User.countDocuments({ fraudStatus: 'blocked' }),
      User.countDocuments({ fraudStatus: { $in: ['suspicious', 'review'] } }),
      User.aggregate([{ $match: { role: 'user', ocrConfidence: { $exists: true } } }, { $group: { _id: null, avgConfidence: { $avg: '$ocrConfidence' } } }])
    ]);
    const totalPremiumCollection = premiumAgg[0]?.total || 0;
    const totalPayouts           = payoutAgg[0]?.total  || 0;
    const avgOcrConfidence       = avgOcrConfidenceAgg[0]?.avgConfidence || 0;
    res.json({
      totalUsers, activeUsers, pendingVerification, autoVerifiedWorkers, pendingManualReview, rejectedVerification, activePolicies,
      totalClaims, paidClaims, pendingClaims, rejectedClaims,
      totalPremiumCollection, totalPayouts,
      availablePool: totalPremiumCollection - totalPayouts,
      fraudBlocked, fraudSuspicious,
      avgOcrConfidence: Math.round(avgOcrConfidence)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Worker Verification ───────────────────────────────────────────────────────
router.get('/pending-workers', async (req, res) => {
  try {
    const workers = await User.find({ role: 'user', verificationStatus: { $in: ['pending', 'pending_manual_review', 'auto_verified'] } })
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
      {
        verificationStatus: status,
        verificationMessage: status === 'approved' ? 'Verification approved by admin.' : 'Verification rejected by admin.',
        verifiedBy: req.user.id,
        verifiedAt: new Date(),
        verificationDate: new Date()
      },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (status === 'approved') notify.documentsVerified(user._id).catch(() => {});
    else notify.documentsRejected(user._id, 'Documents did not meet verification requirements.').catch(() => {});
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/verification-logs', async (req, res) => {
  try {
    const logs = await VerificationLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(logs);
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
    if (status === 'approved') notify.claimApproved(claim.userId, claim.payoutAmount).catch(() => {});
    if (status === 'rejected') notify.claimRejected(claim.userId, '').catch(() => {});
    if (status === 'approved') {
      await InsurancePool.findOneAndUpdate({},
        { $inc: { totalClaimsPaid: claim.payoutAmount, availablePool: -claim.payoutAmount } },
        { upsert: true });
    }
    res.json(claim);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/claims/:id/history', async (req, res) => {
  try {
    const history = await ClaimHistory.find({ claimId: req.params.id }).sort({ claimDate: -1 });
    res.json(history);
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

// ── Workers / Users CRUD ─────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const page     = parseInt(req.query.page  || 1);
    const limit    = parseInt(req.query.limit || 0);
    const search   = (req.query.search || '').trim();
    const city     = (req.query.city   || '').trim();
    const platform = (req.query.platform || '').trim();

    const query = { $and: [ { $or: [{ role: 'user' }, { role: { $exists: false } }] } ] };
    if (search) {
      query.$and.push({ $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { workerId: { $regex: search, $options: 'i' } }
      ] });
    }
    if (city) {
      query.$and.push({ $or: [
        { homeCity: { $regex: city, $options: 'i' } },
        { workCity: { $regex: city, $options: 'i' } },
        { 'location.city': { $regex: city, $options: 'i' } }
      ] });
    }
    if (platform) query.platform = platform;

    console.log('[ADMIN USERS] query:', JSON.stringify(query));
    const usersQuery = User.find(query).select('-password -gpsHistory').sort({ createdAt: -1 });
    if (limit > 0) usersQuery.skip((page - 1) * limit).limit(limit);
    const users = await usersQuery;

    const total = await User.countDocuments(query);
    console.log('[ADMIN USERS] fetched workers:', users.length, 'total:', total);
    res.json({ users, total, page, pages: limit > 0 ? Math.ceil(total / limit) : 1 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -gpsHistory');
    if (!user) return res.status(404).json({ error: 'Not found' });
    const [policies, claims, payments] = await Promise.all([
      Policy.find({ userId: user._id }).sort({ createdAt: -1 }),
      Claim.find({ userId: user._id }).sort({ triggeredAt: -1 }).limit(10),
      Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10)
    ]);
    res.json({ user, policies, claims, payments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id', async (req, res) => {
  try {
    const allowed = ['name','phone','platform','homeCity','workCity','weeklyIncome','isActive','verificationStatus','trustScore','fraudStatus'];
    const update  = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password -gpsHistory');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users/:id/premium-history', async (req, res) => {
  try {
    const history = await PremiumHistory.find({ userId: req.params.id }).sort({ generatedDate: -1 });
    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/suspend', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/users/:id/activate', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Policy Management ────────────────────────────────────────────────────────
router.get('/policies', async (req, res) => {
  try {
    const search = req.query.search || '';
    const status = req.query.status || '';
    const query  = {};
    if (status) query.status = status;
    const policies = await Policy.find(query)
      .populate('userId', 'name email phone platform homeCity workCity')
      .sort({ createdAt: -1 }).limit(100);
    const filtered = search
      ? policies.filter(p => p.userId?.name?.toLowerCase().includes(search.toLowerCase()) || p.userId?.email?.toLowerCase().includes(search.toLowerCase()))
      : policies;
    res.json(filtered);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/policies/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active','expired','cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const policy = await Policy.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(policy);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Payments History ──────────────────────────────────────────────────────────
router.get('/payments', async (req, res) => {
  try {
    const page  = parseInt(req.query.page  || 1);
    const limit = parseInt(req.query.limit || 50);
    const payments = await Payment.find()
      .populate('userId', 'name email platform')
      .populate('policyId', 'planName')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    const total = await Payment.countDocuments();
    const agg   = await Payment.aggregate([{ $match: { status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({ payments, total, pages: Math.ceil(total / limit), totalCollected: agg[0]?.total || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Weather & AQI Monitoring ──────────────────────────────────────────────────
const CITIES = ['Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata'];

router.get('/weather', async (req, res) => {
  try {
    const results = await Promise.all(CITIES.map(async city => {
      try {
        const data = await checkCityDisruption(city);
        return { city, ...data.weather, aqi: data.aqi, disruptionLevel: data.disruptionLevel };
      } catch { return { city, temperature: 0, rainfall: 0, humidity: 0, windSpeed: 0, aqi: 0, disruptionLevel: 'none' }; }
    }));
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Notifications Management ──────────────────────────────────────────────────
router.get('/notifications', async (req, res) => {
  try {
    const page  = parseInt(req.query.page  || 1);
    const limit = parseInt(req.query.limit || 50);
    const notifs = await Notification.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    const total = await Notification.countDocuments();
    res.json({ notifications: notifs, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/notifications/send', async (req, res) => {
  try {
    const { userId, title, message, type = 'admin', priority = 'medium' } = req.body;
    if (!userId || !title || !message) return res.status(400).json({ error: 'userId, title, message required' });
    const notif = await Notification.create({ userId, title, message, type, priority });
    res.json(notif);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/notifications/broadcast', async (req, res) => {
  try {
    const { title, message, type = 'admin', priority = 'medium' } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'title and message required' });
    const users = await User.find({ role: 'user', isActive: true }).select('_id');
    const docs  = users.map(u => ({ userId: u._id, title, message, type, priority }));
    await Notification.insertMany(docs);
    res.json({ sent: docs.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/notifications/:id', async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Reports ───────────────────────────────────────────────────────────────────
router.get('/reports/workers', async (req, res) => {
  try {
    const workers = await User.find({ role: 'user' }).select('-password -gpsHistory').lean();
    if (req.query.format === 'csv') {
      const header = 'Name,Email,Phone,Platform,HomeCity,WorkCity,WeeklyIncome,VerificationStatus,FraudStatus,TrustScore,JoinedAt';
      const rows   = workers.map(w => `"${w.name}","${w.email}","${w.phone}","${w.platform}","${w.homeCity||''}","${w.workCity||''}",${w.weeklyIncome},"${w.verificationStatus}","${w.fraudStatus}",${w.trustScore},"${new Date(w.createdAt).toLocaleDateString()}"`).join('\n');
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition','attachment; filename=workers.csv');
      return res.send(header + '\n' + rows);
    }
    res.json(workers);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/claims', async (req, res) => {
  try {
    const claims = await Claim.find().populate('userId','name email platform').lean();
    if (req.query.format === 'csv') {
      const header = 'WorkerName,Email,TriggerType,AffectedCity,PayoutAmount,Status,FraudScore,TriggeredAt';
      const rows   = claims.map(c => `"${c.userId?.name||''}","${c.userId?.email||''}","${c.triggerType}","${c.affectedCity}",${c.payoutAmount},"${c.status}",${c.fraudScore||0},"${new Date(c.triggeredAt).toLocaleDateString()}"`).join('\n');
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition','attachment; filename=claims.csv');
      return res.send(header + '\n' + rows);
    }
    res.json(claims);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/payments', async (req, res) => {
  try {
    const payments = await Payment.find().populate('userId','name email').lean();
    if (req.query.format === 'csv') {
      const header = 'WorkerName,Email,Amount,Status,RazorpayOrderId,RazorpayPaymentId,CreatedAt';
      const rows   = payments.map(p => `"${p.userId?.name||''}","${p.userId?.email||''}",${p.amount},"${p.status}","${p.razorpayOrderId||''}","${p.razorpayPaymentId||''}","${new Date(p.createdAt).toLocaleDateString()}"`).join('\n');
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition','attachment; filename=payments.csv');
      return res.send(header + '\n' + rows);
    }
    res.json(payments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/weather', async (req, res) => {
  try {
    const data = await RiskData.find().sort({ recordedAt: -1 }).limit(500).lean();
    if (req.query.format === 'csv') {
      const header = 'City,Rainfall,Temperature,AQI,DisruptionLevel,RecordedAt';
      const rows   = data.map(d => `"${d.city}",${d.weather?.rainfall||0},${d.weather?.temperature||0},${d.aqi||0},"${d.disruptionLevel}","${new Date(d.recordedAt).toLocaleDateString()}"`).join('\n');
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition','attachment; filename=weather.csv');
      return res.send(header + '\n' + rows);
    }
    res.json(data);
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
