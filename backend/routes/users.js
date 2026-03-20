const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Policy = require('../models/Policy');
const auth = require('../middleware/auth');
const axios = require('axios');
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, platform, location, weeklyIncome } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);

    let riskLevel = 'medium', weeklyPremium = 0;
    try {
      const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/predict-risk`, {
        city: location.city, weeklyIncome, platform
      });
      riskLevel = mlRes.data.riskLevel;
      weeklyPremium = mlRes.data.weeklyPremium;
    } catch {
      const incomeRisk = weeklyIncome > 5000 ? 'high' : weeklyIncome > 3000 ? 'medium' : 'low';
      riskLevel = incomeRisk;
      weeklyPremium = weeklyIncome * (riskLevel === 'high' ? 0.03 : riskLevel === 'medium' ? 0.02 : 0.015);
    }

    const user = new User({ name, email, password: hashed, phone, platform, location, weeklyIncome, riskLevel, weeklyPremium });
    await user.save();

    res.status(201).json({ message: 'User registered successfully', user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { ...user.toObject(), password: undefined } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password;
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user GPS location
router.post('/update-gps', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

    const user = await User.findById(req.user.id);

    // Detect suspicious jump from last known GPS
    if (user.currentGps?.lat) {
      const { verifyUserLocationForCity } = require('../services/weatherService');
      const prevLat = user.currentGps.lat;
      const prevLng = user.currentGps.lng;
      const R = 6371;
      const dLat = (lat - prevLat) * Math.PI / 180;
      const dLng = (lng - prevLng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(prevLat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLng/2)**2;
      const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      if (distKm > 500) {
        await User.findByIdAndUpdate(req.user.id, { $inc: { trustScore: -5 } });
        return res.status(400).json({ error: 'Suspicious GPS jump detected', distanceKm: distKm });
      }
    }

    await User.findByIdAndUpdate(req.user.id, {
      ipAddress: req.ip,
      currentGps: { lat, lng, updatedAt: new Date() },
      $push: { gpsHistory: { $each: [{ lat, lng, recordedAt: new Date() }], $slice: -20 } }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate active order from frontend
router.post('/simulate-order', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, {
      currentOrder: { status: status || 'active', updatedAt: new Date() }
    }, { new: true }).select('-password');
    res.json({ success: true, currentOrder: user.currentOrder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update payment details (UPI / bank)
router.put('/payment-details', auth, async (req, res) => {
  try {
    const { upiId, bankAccount } = req.body;
    const update = {};
    if (upiId) update.upiId = upiId;
    if (bankAccount) update.bankAccount = bankAccount;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
