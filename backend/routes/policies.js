const express = require('express');
const Policy = require('../models/Policy');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

const PLANS = {
  basic: { name: 'Basic Shield', multiplier: 1, coverageMultiplier: 0.5, coverageTypes: ['rainfall', 'aqi'] },
  standard: { name: 'Standard Guard', multiplier: 1.5, coverageMultiplier: 0.75, coverageTypes: ['rainfall', 'aqi', 'temperature'] },
  premium: { name: 'Premium Protect', multiplier: 2, coverageMultiplier: 1, coverageTypes: ['rainfall', 'aqi', 'temperature', 'curfew'] }
};

// Policy creation is handled via /api/payments/verify after successful payment
// This endpoint kept for admin/internal use only
router.post('/create', auth, async (req, res) => {
  try {
    const { planType = 'standard', customThresholds } = req.body;
    const user = await User.findById(req.user.id);
    const plan = PLANS[planType] || PLANS.standard;
    const existing = await Policy.findOne({ userId: user._id, status: 'active' });
    if (existing) return res.status(400).json({ error: 'Active policy already exists' });
    const policy = new Policy({
      userId: user._id,
      planName: plan.name,
      weeklyPremium: Math.round(user.weeklyPremium * plan.multiplier),
      coverageAmount: Math.round(user.weeklyIncome * plan.coverageMultiplier),
      coverageType: plan.coverageTypes,
      thresholds: customThresholds || { rainfall: 50, aqi: 200, temperature: 42 },
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await policy.save();
    res.status(201).json(policy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my', auth, async (req, res) => {
  try {
    const policies = await Policy.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(policies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/plans', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const plans = Object.entries(PLANS).map(([key, plan]) => ({
      key,
      name: plan.name,
      weeklyPremium: Math.round(user.weeklyPremium * plan.multiplier),
      coverageAmount: Math.round(user.weeklyIncome * plan.coverageMultiplier),
      coverageTypes: plan.coverageTypes
    }));
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const policy = await Policy.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { status: 'cancelled' },
      { new: true }
    );
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json(policy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
