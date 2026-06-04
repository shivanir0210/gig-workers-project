const express  = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const axios     = require('axios');
const User           = require('../models/User');
const PremiumHistory = require('../models/PremiumHistory');
const auth      = require('../middleware/auth');
const router    = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────
async function calcPremiumAndRisk(city, weeklyIncome, platform) {
  try {
    const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/predict-risk`, { city, weeklyIncome, platform });
    return { riskLevel: mlRes.data.riskLevel, weeklyPremium: mlRes.data.weeklyPremium, riskScore: Math.round(mlRes.data.cityRiskScore * 100) };
  } catch {
    const riskLevel    = weeklyIncome > 5000 ? 'high' : weeklyIncome > 3000 ? 'medium' : 'low';
    const weeklyPremium = weeklyIncome * (riskLevel === 'high' ? 0.03 : riskLevel === 'medium' ? 0.02 : 0.015);
    const riskScore    = riskLevel === 'high' ? 75 : riskLevel === 'medium' ? 55 : 35;
    return { riskLevel, weeklyPremium: Math.round(weeklyPremium), riskScore };
  }
}

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, platform, customPlatform, workerId,
            aadhaarNumber, idProofUrl, profileScreenshotUrl, location,
            weeklyIncome, homeCity, workCity, customHomeCity, customWorkCity,
            averageDailyIncome, averageOrdersPerDay, onlineHoursPerDay } = req.body;

    if (await User.findOne({ email }))    return res.status(400).json({ error: 'Email already registered' });
    if (await User.findOne({ phone }))    return res.status(400).json({ error: 'Phone already registered' });
    if (await User.findOne({ workerId })) return res.status(400).json({ error: 'Worker ID already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const actualHomeCity = homeCity === 'Other' ? customHomeCity : homeCity;
    const actualWorkCity = workCity === 'Other' ? customWorkCity : workCity;
    const { riskLevel, weeklyPremium, riskScore } = await calcPremiumAndRisk(location.city, weeklyIncome, platform);

    const user = new User({
      name, email, password: hashed, phone,
      platform, customPlatform, workerId,
      aadhaarNumber, idProofUrl, profileScreenshotUrl,
      location,
      homeCity: actualHomeCity || location.city,
      workCity: actualWorkCity || location.city,
      customHomeCity, customWorkCity,
      weeklyIncome,
      averageDailyIncome:  averageDailyIncome  || Math.round(weeklyIncome / 6),
      averageOrdersPerDay: averageOrdersPerDay || 0,
      onlineHoursPerDay:   onlineHoursPerDay   || 0,
      riskLevel, weeklyPremium, riskScore
    });
    await user.save();

    // PHASE 5: record first premium history entry
    const ph = await PremiumHistory.create({
      userId: user._id, premiumAmount: weeklyPremium, riskScore, riskLevel,
      weeklyIncome, homeCity: user.homeCity, workCity: user.workCity,
      averageDailyIncome: user.averageDailyIncome,
      averageOrdersPerDay: user.averageOrdersPerDay,
      onlineHoursPerDay: user.onlineHoursPerDay
    });
    await User.findByIdAndUpdate(user._id, { $push: { premiumHistory: ph._id } });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { ...user.toObject(), password: undefined } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.password;

    // Recalculate premium if income-related fields changed
    if (updates.weeklyIncome || updates.homeCity || updates.workCity) {
      const current = await User.findById(req.user.id);
      const city        = updates.location?.city || current.location.city;
      const income      = updates.weeklyIncome   || current.weeklyIncome;
      const platform    = updates.platform       || current.platform;
      const { riskLevel, weeklyPremium, riskScore } = await calcPremiumAndRisk(city, income, platform);
      updates.riskLevel     = riskLevel;
      updates.weeklyPremium = weeklyPremium;
      updates.riskScore     = riskScore;
      if (updates.averageDailyIncome === undefined)
        updates.averageDailyIncome = Math.round(income / 6);

      // PHASE 5: save new premium history record
      const ph = await PremiumHistory.create({
        userId: req.user.id, premiumAmount: weeklyPremium, riskScore, riskLevel,
        weeklyIncome: income, homeCity: updates.homeCity || current.homeCity,
        workCity: updates.workCity || current.workCity,
        averageDailyIncome:  updates.averageDailyIncome,
        averageOrdersPerDay: updates.averageOrdersPerDay || current.averageOrdersPerDay,
        onlineHoursPerDay:   updates.onlineHoursPerDay   || current.onlineHoursPerDay
      });
      await User.findByIdAndUpdate(req.user.id, { $push: { premiumHistory: ph._id } });
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/all', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GPS update ─────────────────────────────────────────────────────────────────
router.post('/update-gps', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const user = await User.findById(req.user.id);
    if (user.currentGps?.lat) {
      const R = 6371, prevLat = user.currentGps.lat, prevLng = user.currentGps.lng;
      const dLat = (lat - prevLat) * Math.PI / 180, dLng = (lng - prevLng) * Math.PI / 180;
      const a    = Math.sin(dLat/2)**2 + Math.cos(prevLat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLng/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      if (dist > 500) {
        await User.findByIdAndUpdate(req.user.id, { $inc: { trustScore: -5 } });
        return res.status(400).json({ error: 'Suspicious GPS jump', distanceKm: dist });
      }
    }
    await User.findByIdAndUpdate(req.user.id, {
      ipAddress: req.ip,
      currentGps: { lat, lng, updatedAt: new Date() },
      $push: { gpsHistory: { $each: [{ lat, lng, recordedAt: new Date() }], $slice: -20 } }
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/simulate-order', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, {
      currentOrder: { status: status || 'active', updatedAt: new Date() }
    }, { new: true }).select('-password');
    res.json({ success: true, currentOrder: user.currentOrder });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/payment-details', auth, async (req, res) => {
  try {
    const { upiId, bankAccount } = req.body;
    const update = {};
    if (upiId)       update.upiId       = upiId;
    if (bankAccount) update.bankAccount = bankAccount;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
