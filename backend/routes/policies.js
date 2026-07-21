const express = require('express');
const Policy = require('../models/Policy');
const User = require('../models/User');
const auth = require('../middleware/auth');
const policyController = require('../controllers/policyController');
const { calculateUserPremium } = require('../services/premiumService');
const router = express.Router();

const PLANS = {
  basic: { name: 'Basic Shield', multiplier: 1, coverageMultiplier: 0.5, coverageTypes: ['rainfall', 'aqi'] },
  standard: { name: 'Standard Guard', multiplier: 1.5, coverageMultiplier: 0.75, coverageTypes: ['rainfall', 'aqi', 'temperature'] },
  premium: { name: 'Premium Protect', multiplier: 2, coverageMultiplier: 1, coverageTypes: ['rainfall', 'aqi', 'temperature', 'curfew'] }
};

// ── Main Policies APIs ────────────────────────────────────────────────────────
console.log('[Policies Route Handlers Check]:', {
  getCategorizedPolicies: typeof policyController.getCategorizedPolicies,
  getPolicyStatus: typeof policyController.getPolicyStatus,
  activatePolicy: typeof policyController.activatePolicy,
  renewPolicy: typeof policyController.renewPolicy,
  payPremium: typeof policyController.payPremium
});

router.get('/', auth, policyController.getCategorizedPolicies);
router.get('/status', auth, policyController.getPolicyStatus);
router.get('/notifications', auth, policyController.getPolicyNotifications);
router.get('/dashboard', auth, policyController.getPolicyDashboard);
router.get('/calculate-premium', auth, policyController.calculatePremium);
router.post('/calculate-premium', auth, policyController.calculatePremium);
router.post('/activate', auth, policyController.activatePolicy);
router.post('/renew', auth, policyController.renewPolicy);
router.post('/pay-premium', auth, policyController.payPremium);

// ── Dynamic Plans ─────────────────────────────────────────────────────────────
router.get('/plans', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [basicCalc, standardCalc, premiumCalc] = await Promise.all([
      calculateUserPremium(user, null, null, 'Basic'),
      calculateUserPremium(user, null, null, 'Standard'),
      calculateUserPremium(user, null, null, 'Premium')
    ]);

    const plans = [
      {
        key: 'basic',
        name: 'Basic Shield',
        weeklyPremium: basicCalc.premiumAmount,
        premiumAmount: basicCalc.premiumAmount,
        coverageAmount: basicCalc.coverageAmount,
        coverageTypes: PLANS.basic.coverageTypes,
        calculation: basicCalc.calculation
      },
      {
        key: 'standard',
        name: 'Standard Guard',
        weeklyPremium: standardCalc.premiumAmount,
        premiumAmount: standardCalc.premiumAmount,
        coverageAmount: standardCalc.coverageAmount,
        coverageTypes: PLANS.standard.coverageTypes,
        calculation: standardCalc.calculation
      },
      {
        key: 'premium',
        name: 'Premium Protect',
        weeklyPremium: premiumCalc.premiumAmount,
        premiumAmount: premiumCalc.premiumAmount,
        coverageAmount: premiumCalc.coverageAmount,
        coverageTypes: PLANS.premium.coverageTypes,
        calculation: premiumCalc.calculation
      }
    ];

    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User Policies Listing ─────────────────────────────────────────────────────
router.get('/my', auth, async (req, res) => {
  try {
    const policies = await Policy.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(policies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Single Policy Detail & PDF Downloads ──────────────────────────────────────
router.get('/:id', auth, policyController.getPolicyDetails);
router.post('/:id/pay', auth, policyController.payPolicyPremium);
router.post('/:id/cancel', auth, policyController.cancelPolicy);
router.post('/:id/renew', auth, policyController.renewPolicy);
router.get('/:id/history', auth, policyController.getPolicyDetails);
router.get('/:id/download', auth, policyController.downloadPolicyPDF);

// ── Legacy Routes ─────────────────────────────────────────────────────────────
router.post('/create', auth, async (req, res) => {
  try {
    const { planType = 'standard', customThresholds } = req.body;
    const user = await User.findById(req.user.id);
    if (user.verificationStatus !== 'approved')
      return res.status(403).json({ error: 'Account not verified. Await admin approval.' });
    if (user.fraudStatus === 'blocked')
      return res.status(403).json({ error: 'Account blocked due to fraud.' });
    
    const dynamicCalc = await calculateUserPremium(user, null, null, planType);
    const existing = await Policy.findOne({ userId: user._id, policyStatus: 'ACTIVE' });
    if (existing) return res.status(400).json({ error: 'Active policy already exists' });

    const startDate = new Date();
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const policy = new Policy({
      userId: user._id,
      planName: dynamicCalc.planName,
      premiumAmount: dynamicCalc.premiumAmount,
      weeklyPremium: dynamicCalc.premiumAmount,
      coverageAmount: dynamicCalc.coverageAmount,
      riskLevel: dynamicCalc.riskLevel,
      calculation: dynamicCalc.calculation,
      coverageType: ['rainfall', 'aqi', 'temperature'],
      coveredRisks: ['Rainfall', 'AQI', 'Temperature', 'Curfew', 'Flood', 'Cyclone'],
      thresholds: customThresholds || { rainfall: 50, aqi: 200, temperature: 42 },
      policyStatus: 'ACTIVE',
      status: 'ACTIVE',
      policyStartDate: startDate,
      startDate,
      policyEndDate: endDate,
      endDate,
      expiryDate: endDate,
      nextDueDate: endDate
    });
    await policy.save();
    res.status(201).json(policy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const policy = await Policy.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { policyStatus: 'CANCELLED', status: 'CANCELLED', cancelledDate: new Date() },
      { new: true }
    );
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json(policy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
