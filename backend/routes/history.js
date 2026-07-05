const express       = require('express');
const ClaimHistory  = require('../models/ClaimHistory');
const PremiumHistory = require('../models/PremiumHistory');
const auth          = require('../middleware/auth');
const router        = express.Router();

// PHASE 4 – Claim History
router.get('/claim-history', auth, async (req, res) => {
  try {
    const history = await ClaimHistory.find({ userId: req.user.id }).sort({ claimDate: -1 });
    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/claim-history/:id', auth, async (req, res) => {
  try {
    const entry = await ClaimHistory.findOne({ _id: req.params.id, userId: req.user.id });
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/claim-history', auth, async (req, res) => {
  try {
    const { claimReason, affectedCity, cityType, payoutAmount, status, weatherData, triggerType, triggerValue, riskScore } = req.body;
    const entry = await ClaimHistory.create({
      userId: req.user.id, claimReason, affectedCity, cityType: cityType || 'work',
      payoutAmount, status: status || 'pending', weatherData, triggerType, triggerValue, riskScore
    });
    res.status(201).json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PHASE 5 – Premium History
router.get('/premium-history', auth, async (req, res) => {
  try {
    const history = await PremiumHistory.find({ userId: req.user.id }).sort({ generatedDate: -1 });
    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/premium-history', auth, async (req, res) => {
  try {
    const { premiumAmount, planName, riskScore, weeklyIncome, homeCity, workCity, averageDailyIncome, averageOrdersPerDay, onlineHoursPerDay } = req.body;
    const entry = await PremiumHistory.create({
      userId: req.user.id, premiumAmount, planName, riskScore, weeklyIncome,
      homeCity, workCity, averageDailyIncome, averageOrdersPerDay, onlineHoursPerDay
    });
    res.status(201).json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
