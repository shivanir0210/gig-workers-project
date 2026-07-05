const express        = require('express');
const Payment        = require('../models/Payment');
const Claim          = require('../models/Claim');
const PremiumHistory = require('../models/PremiumHistory');
const RiskData       = require('../models/RiskData');
const User           = require('../models/User');
const auth           = require('../middleware/auth');
const router         = express.Router();

// PHASE 7 – Premium trend (last 8 weeks per user)
router.get('/premium-trend', auth, async (req, res) => {
  try {
    const data = await PremiumHistory.find({ userId: req.user.id })
      .sort({ generatedDate: -1 }).limit(8).select('premiumAmount riskScore generatedDate planName');
    res.json(data.reverse());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PHASE 7 – Claim trend (last 8 weeks per user)
router.get('/claim-trend', auth, async (req, res) => {
  try {
    const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
    const data = await Claim.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId(req.user.id), triggeredAt: { $gte: eightWeeksAgo } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$triggeredAt' } },
          count: { $sum: 1 },
          totalPayout: { $sum: '$payoutAmount' }
      }},
      { $sort: { _id: 1 } }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PHASE 7 – Risk trend for user's city
router.get('/risk-trend', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('location workCity homeCity');
    const cities = [...new Set([user.location?.city, user.workCity, user.homeCity].filter(Boolean))];
    const data = await RiskData.find({ city: { $in: cities } })
      .sort({ recordedAt: -1 }).limit(30)
      .select('city disruptionLevel aqi weather.rainfall weather.temperature recordedAt');
    res.json(data.reverse());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PHASE 7 – Income loss trend (estimated from claim payouts)
router.get('/income-loss-trend', auth, async (req, res) => {
  try {
    const data = await Claim.find({ userId: req.user.id, status: { $in: ['paid', 'approved'] } })
      .sort({ triggeredAt: -1 }).limit(10)
      .select('payoutAmount triggerType triggeredAt affectedCity');
    res.json(data.reverse());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PHASE 8 – Export ML training data as JSON (CSV on request)
router.get('/ml-export', auth, async (req, res) => {
  try {
    const format = req.query.format || 'json'; // 'json' or 'csv'
    const claims = await Claim.find({ status: { $in: ['paid', 'approved', 'rejected'] } })
      .populate('userId', 'homeCity workCity weeklyIncome averageDailyIncome averageOrdersPerDay onlineHoursPerDay riskScore platform')
      .populate('policyId', 'weeklyPremium')
      .lean();

    const rows = claims.map(c => ({
      homeCity:            c.userId?.homeCity            || '',
      workCity:            c.userId?.workCity            || c.affectedCity || '',
      platform:            c.userId?.platform            || '',
      weeklyIncome:        c.userId?.weeklyIncome        || 0,
      averageDailyIncome:  c.userId?.averageDailyIncome  || 0,
      averageOrdersPerDay: c.userId?.averageOrdersPerDay || 0,
      onlineHoursPerDay:   c.userId?.onlineHoursPerDay   || 0,
      triggerType:         c.triggerType,
      triggerValue:        c.triggerValue,
      threshold:           c.threshold,
      claimAmount:         c.payoutAmount,
      claimStatus:         c.status,
      riskScore:           c.userId?.riskScore || 50,
      affectedCity:        c.affectedCity || '',
      cityType:            c.cityType || 'work',
      fraudScore:          c.fraudScore,
      gpsVerified:         c.validationDetails?.gpsVerified  ? 1 : 0,
      activityVerified:    c.validationDetails?.activityVerified ? 1 : 0,
      rainfall:            c.triggerType === 'rainfall' ? c.triggerValue : 0,
      aqi:                 c.triggerType === 'aqi' ? c.triggerValue : 0,
      temperature:         c.triggerType === 'temperature' ? c.triggerValue : 0,
      premiumAmount:       c.policyId?.weeklyPremium || 0,
      timestamp:           c.triggeredAt
    }));

    if (format === 'csv') {
      const header = Object.keys(rows[0] || {}).join(',');
      const csvRows = rows.map(r => Object.values(r).join(','));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=gigshield_training_data.csv');
      return res.send([header, ...csvRows].join('\n'));
    }

    res.json({ count: rows.length, data: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin-stats', auth, async (req, res) => {
  try {
    // 1. Premium Analytics (Group by day, week, month, year)
    const premiumDaily = await Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
          total: { $sum: '$amount' }
      }},
      { $sort: { _id: -1 } },
      { $limit: 7 }
    ]);

    const premiumWeekly = await Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: {
          _id: { $week: '$paymentDate' },
          total: { $sum: '$amount' }
      }},
      { $sort: { _id: -1 } },
      { $limit: 8 }
    ]);

    const premiumMonthly = await Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paymentDate' } },
          total: { $sum: '$amount' }
      }},
      { $sort: { _id: -1 } },
      { $limit: 6 }
    ]);

    const premiumYearly = await Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: {
          _id: { $dateToString: { format: '%Y', date: '$paymentDate' } },
          total: { $sum: '$amount' }
      }},
      { $sort: { _id: -1 } }
    ]);

    // 2. Claims Analytics
    const claims = await Claim.aggregate([
      { $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalPayout: { $sum: '$payoutAmount' }
      }}
    ]);

    // 3. Fraud Analytics
    const fraud = await User.aggregate([
      { $group: {
          _id: '$fraudStatus',
          count: { $sum: 1 },
          avgScore: { $avg: '$fraudScore' }
      }}
    ]);

    // 4. Risk Analytics
    const highRiskCities = await RiskData.aggregate([
      { $sort: { recordedAt: -1 } },
      { $group: {
          _id: '$city',
          latestDisruption: { $first: '$disruptionLevel' },
          latestAqi: { $first: '$aqi' },
          latestRainfall: { $first: '$weather.rainfall' }
      }},
      { $match: { latestDisruption: { $in: ['high', 'extreme'] } } }
    ]);

    const floodZones = await RiskData.aggregate([
      { $sort: { recordedAt: -1 } },
      { $group: {
          _id: '$city',
          latestRainfall: { $first: '$weather.rainfall' }
      }},
      { $match: { latestRainfall: { $gt: 50 } } }
    ]);

    const aqiHotspots = await RiskData.aggregate([
      { $sort: { recordedAt: -1 } },
      { $group: {
          _id: '$city',
          latestAqi: { $first: '$aqi' }
      }},
      { $match: { latestAqi: { $gt: 200 } } }
    ]);

    res.json({
      premium: {
        daily: premiumDaily.reverse(),
        weekly: premiumWeekly.reverse(),
        monthly: premiumMonthly.reverse(),
        yearly: premiumYearly.reverse()
      },
      claims,
      fraud,
      risk: {
        highRiskCities,
        floodZones,
        aqiHotspots
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
