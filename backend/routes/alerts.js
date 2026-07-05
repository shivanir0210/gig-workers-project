const express  = require('express');
const Alert    = require('../models/Alert');
const User     = require('../models/User');
const auth     = require('../middleware/auth');
const { checkCityDisruption, checkDualCityEligibility } = require('../services/weatherService');
const router   = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildAlerts(city, cityType, weather, aqi, disruptionLevel) {
  const alerts = [];
  if (weather.rainfall > 50)
    alerts.push({ alertType: 'rainfall', severity: weather.rainfall > 80 ? 'extreme' : 'high', triggerValue: weather.rainfall,
      message: `Heavy rainfall detected in ${city} (${weather.rainfall}mm). Delivery operations may be severely affected.` });
  if (aqi > 200)
    alerts.push({ alertType: 'aqi', severity: aqi > 300 ? 'extreme' : 'high', triggerValue: aqi,
      message: `Air Quality Index in ${city} is ${aqi} — above safe limits. Outdoor work risk increased.` });
  if (weather.temperature > 42)
    alerts.push({ alertType: 'temperature', severity: weather.temperature > 45 ? 'extreme' : 'high', triggerValue: weather.temperature,
      message: `Extreme heat alert in ${city} (${weather.temperature}°C). Risk of heat exhaustion for outdoor workers.` });
  if (weather.rainfall > 80)
    alerts.push({ alertType: 'flood', severity: 'extreme', triggerValue: weather.rainfall,
      message: `Flood conditions detected in your ${cityType} location (${city}). Insurance coverage may apply.` });
  return alerts.map(a => ({ ...a, city, cityType }));
}

function estimateIncomeLoss(disruptionLevel, dailyIncome) {
  const multipliers = { none: 0, low: 0.1, medium: 0.3, high: 0.6, extreme: 0.9 };
  const disruptionDays = { none: 0, low: 0.5, medium: 1.5, high: 3, extreme: 5 };
  const mult = multipliers[disruptionLevel] || 0;
  const days = disruptionDays[disruptionLevel] || 0;
  return {
    estimatedWeeklyLoss: Math.round(dailyIncome * days * mult * 7 / (days || 1) || dailyIncome * mult * days),
    disruptionDays: days,
    disruptionProbability: Math.round(mult * 100)
  };
}

// ── GET /api/alerts — fetch user's active alerts ──────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.user.id, status: 'active' })
      .sort({ timestamp: -1 }).limit(20);
    res.json(alerts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/alerts/:id/read ──────────────────────────────────────────────────
router.put('/:id/read', auth, async (req, res) => {
  try {
    await Alert.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { status: 'read' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/alerts/check — check both cities and store new alerts ───────────
router.post('/check', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const homeCity = user.homeCity === 'Other' ? user.customHomeCity : user.homeCity;
    const workCity = user.workCity === 'Other' ? user.customWorkCity : user.workCity;

    const cities = [];
    if (homeCity) cities.push({ city: homeCity, cityType: 'home' });
    if (workCity && workCity !== homeCity) cities.push({ city: workCity, cityType: 'work' });
    if (!cities.length) return res.json({ alerts: [], locationStatus: [] });

    const results = [];
    const newAlerts = [];

    for (const { city, cityType } of cities) {
      const data = await checkCityDisruption(city);
      const { weather, aqi, disruptionLevel } = data;
      const income = estimateIncomeLoss(disruptionLevel, user.averageDailyIncome || Math.round(user.weeklyIncome / 6));

      results.push({ city, cityType, weather, aqi, disruptionLevel, ...income });

      if (['high', 'extreme'].includes(disruptionLevel)) {
        const cityAlerts = buildAlerts(city, cityType, weather, aqi, disruptionLevel);
        for (const a of cityAlerts) {
          // Avoid duplicate alerts within last 6 hours
          const recent = await Alert.findOne({ userId: user._id, alertType: a.alertType, city, timestamp: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } });
          if (!recent) {
            const saved = await Alert.create({
              userId: user._id, ...a,
              rainfall: weather.rainfall, aqi, temperature: weather.temperature,
              disruptionDays: income.disruptionDays,
              estimatedIncomeLoss: income.estimatedWeeklyLoss,
              riskLevel: disruptionLevel
            });
            newAlerts.push(saved);
          }
        }
      }
    }

    res.json({ alerts: newAlerts, locationStatus: results, dualEligibility: null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/alerts/dual-check ───────────────────────────────────────────────────────────────
router.post('/dual-check', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const eligibility = await checkDualCityEligibility(user);

    // If both cities eligible, create a dual-city notification
    if (eligibility.eligible) {
      const Notification = require('../models/Notification');
      const recent = await Notification.findOne({
        userId: user._id,
        alertType: 'dual_city_eligible',
        timestamp: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }
      });
      if (!recent) {
        await Notification.create({
          userId: user._id,
          alertType: 'dual_city_eligible',
          severity: 'high',
          city: `${eligibility.homeCity} & ${eligibility.workCity}`,
          message: `Heavy ${eligibility.matchedTrigger} detected in both your home city (${eligibility.homeCity}) and current work city (${eligibility.workCity}). You are eligible to submit a parametric insurance claim.`,
          isRead: false
        });
      }
    }

    res.json(eligibility);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/alerts/location-status — live status of both cities ──────────────
router.get('/location-status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const homeCity = user.homeCity === 'Other' ? user.customHomeCity : user.homeCity;
    const workCity = user.workCity === 'Other' ? user.customWorkCity : user.workCity;

    const cities = [];
    if (homeCity) cities.push({ city: homeCity, cityType: 'home' });
    if (workCity && workCity !== homeCity) cities.push({ city: workCity, cityType: 'work' });
    if (!cities.length) return res.json([]);

    const results = await Promise.all(cities.map(async ({ city, cityType }) => {
      const data = await checkCityDisruption(city);
      const income = estimateIncomeLoss(data.disruptionLevel, user.averageDailyIncome || Math.round(user.weeklyIncome / 6));
      return { city, cityType, ...data, ...income };
    }));

    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
