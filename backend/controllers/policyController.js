const Policy = require('../models/Policy');
const User = require('../models/User');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const InsurancePool = require('../models/InsurancePool');
const RiskData = require('../models/RiskData');
const notify = require('../services/notify');
const { calculateUserPremium } = require('../services/premiumService');

const PLANS = {
  basic: { name: 'Basic Shield', multiplier: 1, coverageMultiplier: 0.5, coverageTypes: ['rainfall', 'aqi'] },
  standard: { name: 'Standard Guard', multiplier: 1.5, coverageMultiplier: 0.75, coverageTypes: ['rainfall', 'aqi', 'temperature'] },
  premium: { name: 'Premium Protect', multiplier: 2, coverageMultiplier: 1, coverageTypes: ['rainfall', 'aqi', 'temperature', 'curfew'] }
};

// ── GET /api/policies (Categorized Policies & Summary Metrics) ────────────────
exports.getCategorizedPolicies = async (req, res) => {
  try {
    const userIdStr = req.user.id;
    console.log('====================================================');
    console.log('[GET /api/policies] 1. Logged-in User ID:', userIdStr);

    const user = await User.findById(userIdStr);
    if (!user) {
      console.error('[GET /api/policies] User not found for ID:', userIdStr);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[GET /api/policies] 2. MongoDB Query -> Policy.find({ userId:', user._id, '})');
    let policies = await Policy.find({ userId: user._id }).sort({ createdAt: -1 });

    console.log('[GET /api/policies] 3. Number of policies returned from MongoDB:', policies.length);

    // Sync status for each policy
    const now = new Date();
    for (let p of policies) {
      let isChanged = false;
      const start = p.policyStartDate || p.startDate;
      const end = p.policyEndDate || p.endDate || p.expiryDate;
      const currentStatus = (p.policyStatus || p.status || '').toUpperCase();

      if (currentStatus !== 'CANCELLED') {
        if (start && now < new Date(start) && currentStatus !== 'UPCOMING') {
          p.policyStatus = 'UPCOMING';
          p.status = 'UPCOMING';
          isChanged = true;
        } else if (end && now > new Date(end) && currentStatus !== 'EXPIRED') {
          p.policyStatus = 'EXPIRED';
          p.status = 'EXPIRED';
          isChanged = true;
        } else if (start && end && now >= new Date(start) && now <= new Date(end) && currentStatus !== 'ACTIVE') {
          p.policyStatus = 'ACTIVE';
          p.status = 'ACTIVE';
          isChanged = true;
        }
      }
      if (isChanged) await p.save();
    }

    // Refresh after updates
    policies = await Policy.find({ userId: user._id }).sort({ createdAt: -1 });

    const active = policies.filter(p => (p.policyStatus || p.status || '').toUpperCase() === 'ACTIVE');
    const upcoming = policies.filter(p => (p.policyStatus || p.status || '').toUpperCase() === 'UPCOMING');
    const expired = policies.filter(p => (p.policyStatus || p.status || '').toUpperCase() === 'EXPIRED');
    const cancelled = policies.filter(p => (p.policyStatus || p.status || '').toUpperCase() === 'CANCELLED');

    console.log('[GET /api/policies] 4. Categorized counts -> Active:', active.length, '| Upcoming:', upcoming.length, '| Expired:', expired.length, '| Cancelled:', cancelled.length);
    console.log('====================================================');

    const totalCoverage = [...active, ...upcoming].reduce((sum, p) => sum + (p.coverageAmount || p.coverage || 0), 0);
    const pendingPremiums = active.filter(p => {
      if (!p.nextDueDate) return false;
      return (new Date(p.nextDueDate) - now) / (1000 * 60 * 60 * 24) <= 3;
    }).length;

    const claimsCount = await Claim.countDocuments({ userId: user._id });

    const summary = {
      activeCount: active.length,
      upcomingCount: upcoming.length,
      expiredCount: expired.length,
      cancelledCount: cancelled.length,
      totalCoverage,
      pendingPremiums,
      totalClaims: claimsCount
    };

    res.json({
      summary,
      categorized: {
        active,
        upcoming,
        expired,
        cancelled
      },
      policies
    });
  } catch (err) {
    console.error('[GET /api/policies Error]:', err);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/policies/:id (Single Detailed Policy) ───────────────────────────
exports.getPolicyDetails = async (req, res) => {
  try {
    const policy = await Policy.findOne({ _id: req.params.id, userId: req.user.id });
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const claims = await Claim.find({ userId: req.user.id }).sort({ createdAt: -1 });

    const claimsSummary = {
      total: claims.length,
      approved: claims.filter(c => c.status === 'approved' || c.claimStatus === 'APPROVED').length,
      rejected: claims.filter(c => c.status === 'rejected' || c.claimStatus === 'REJECTED').length,
      pending: claims.filter(c => c.status === 'pending' || c.claimStatus === 'PENDING').length,
      totalClaimAmount: claims.reduce((sum, c) => sum + (c.payoutAmount || c.lossAmount || 0), 0)
    };

    res.json({
      policy,
      claims,
      claimsSummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/policies/:id/pay (Pay Premium for specific policy) ──────────────
exports.payPolicyPremium = async (req, res) => {
  try {
    const { paymentMethod = 'UPI' } = req.body;
    const policyId = req.params.id;
    let policy;

    if (policyId) {
      policy = await Policy.findOne({ _id: policyId, userId: req.user.id });
    } else {
      policy = await Policy.findOne({ userId: req.user.id, policyStatus: 'ACTIVE' }).sort({ createdAt: -1 });
    }

    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const now = new Date();
    const nextDue = policy.nextDueDate ? new Date(policy.nextDueDate) : null;

    // BUSINESS RULE: Disable/Reject payment if today is before nextDueDate
    if (nextDue && now < nextDue) {
      const formattedDue = nextDue.toLocaleDateString('en-GB');
      return res.status(400).json({
        error: `Premium already paid. Next premium is due on ${formattedDue}.`
      });
    }

    const amount = policy.premiumAmount || policy.weeklyPremium || 149;
    const durationDays = policy.paymentFrequency === 'Monthly' ? 30 : 7;
    const baseDate = (policy.nextDueDate && new Date(policy.nextDueDate) > new Date()) ? new Date(policy.nextDueDate) : new Date();
    const newDueDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    policy.paidInstallments = (policy.paidInstallments || 0) + 1;
    policy.pendingInstallments = Math.max(0, (policy.totalInstallments || 52) - policy.paidInstallments);
    policy.lastPaymentDate = new Date();
    policy.nextDueDate = newDueDate;
    policy.policyEndDate = newDueDate;
    policy.endDate = newDueDate;
    policy.expiryDate = newDueDate;
    policy.policyStatus = 'ACTIVE';
    policy.status = 'ACTIVE';

    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
    policy.paymentHistory.push({
      invoiceNo,
      paymentDate: new Date(),
      amount,
      method: paymentMethod,
      status: 'Paid',
      receiptUrl: `/api/policies/${policy._id}/download`
    });

    await policy.save();

    const payment = new Payment({
      userId: req.user.id,
      policyId: policy._id,
      amount,
      type: 'premium',
      paymentStatus: 'success',
      status: 'success',
      description: `Premium payment for policy ${policy.policyNumber} (${policy.planName})`,
      paymentDate: new Date(),
      paidAt: new Date()
    });
    await payment.save();

    await InsurancePool.findOneAndUpdate(
      {},
      { $inc: { totalPremiumCollected: amount, availablePool: amount }, updatedAt: new Date() },
      { upsert: true }
    );

    await notify.paymentSuccess(req.user.id, amount, policy.planName);

    res.json({
      success: true,
      message: `Premium payment of ₹${amount} successful! Next due: ${newDueDate.toLocaleDateString('en-GB')}`,
      policy,
      payment
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.payPremium = exports.payPolicyPremium;

// ── POST /api/policies/:id/cancel (Cancel Policy) ────────────────────────────
exports.cancelPolicy = async (req, res) => {
  try {
    const { reason = 'User requested cancellation' } = req.body;
    const policy = await Policy.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        policyStatus: 'CANCELLED',
        status: 'CANCELLED',
        cancelledDate: new Date(),
        cancelledReason: reason
      },
      { new: true }
    );

    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    res.json({
      success: true,
      message: 'Policy cancelled successfully',
      policy
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/policies/:id/renew (Renew Expired Policy) ──────────────────────
exports.renewPolicy = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const policy = await Policy.findOne({ _id: req.params.id, userId: req.user.id });

    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const dynamicCalc = await calculateUserPremium(user, null, null, policy.planName || 'Premium');
    const durationDays = policy.paymentFrequency === 'Monthly' ? 30 : 7;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    policy.policyStatus = 'ACTIVE';
    policy.status = 'ACTIVE';
    policy.premiumAmount = dynamicCalc.premiumAmount;
    policy.weeklyPremium = dynamicCalc.premiumAmount;
    policy.coverageAmount = dynamicCalc.coverageAmount;
    policy.riskLevel = dynamicCalc.riskLevel;
    policy.calculation = dynamicCalc.calculation;
    policy.policyStartDate = startDate;
    policy.startDate = startDate;
    policy.policyEndDate = endDate;
    policy.endDate = endDate;
    policy.expiryDate = endDate;
    policy.nextDueDate = endDate;
    policy.paidInstallments = (policy.paidInstallments || 0) + 1;
    policy.pendingInstallments = Math.max(0, (policy.totalInstallments || 52) - policy.paidInstallments);
    policy.lastPaymentDate = new Date();

    policy.paymentHistory.push({
      invoiceNo: `INV-REN-${Date.now().toString().slice(-6)}`,
      paymentDate: new Date(),
      amount: dynamicCalc.premiumAmount,
      method: 'UPI',
      status: 'Paid',
      receiptUrl: `/api/policies/${policy._id}/download`
    });

    await policy.save();

    res.json({
      success: true,
      message: 'Policy renewed successfully!',
      policy
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/policies/:id/download (Generate Printable Official PDF Document) ─
exports.downloadPolicyPDF = async (req, res) => {
  try {
    const policy = await Policy.findOne({ _id: req.params.id, userId: req.user.id }).populate('userId', 'name email phone workCity platform');
    if (!policy) return res.status(404).send('Policy not found');

    const user = policy.userId || {};
    const startDateStr = new Date(policy.policyStartDate || policy.startDate).toLocaleDateString('en-GB');
    const endDateStr = new Date(policy.policyEndDate || policy.endDate || policy.expiryDate).toLocaleDateString('en-GB');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>GigShield Policy Certificate - ${policy.policyNumber}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111827; background: #FFF; margin: 0; padding: 40px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3B82F6; padding-bottom: 20px; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: bold; color: #1E3A8A; }
    .subtitle { font-size: 14px; color: #6B7280; }
    .badge { background: #E0E7FF; color: #1D4ED8; font-weight: bold; padding: 4px 12px; border-radius: 9999px; font-size: 12px; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .box { background: #F9FAFB; padding: 15px; border-radius: 8px; border: 1px solid #E5E7EB; }
    .box-title { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #6B7280; margin-bottom: 5px; }
    .box-value { font-size: 16px; font-weight: bold; color: #111827; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #E5E7EB; font-size: 13px; }
    th { background: #F3F4F6; font-size: 11px; text-transform: uppercase; color: #4B5563; }
    .footer { margin-top: 40px; border-top: 1px solid #E5E7EB; pt-20px; display: flex; justify-content: space-between; align-items: center; }
    .qr { font-family: monospace; font-size: 10px; background: #F3F4F6; padding: 8px; border: 1px border-style: dashed; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">🛡️ GigShield Insurance</div>
      <div class="subtitle">AI-Powered Parametric Income Protection Policy</div>
    </div>
    <div>
      <span class="badge">${policy.policyStatus || policy.status}</span>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="box-title">Policy Number</div>
      <div class="box-value">${policy.policyNumber}</div>
    </div>
    <div class="box">
      <div class="box-title">Policy Holder</div>
      <div class="box-value">${user.name || 'Gig Worker'}</div>
    </div>
    <div class="box">
      <div class="box-title">Plan Name</div>
      <div class="box-value">${policy.planName}</div>
    </div>
    <div class="box">
      <div class="box-title">Coverage Amount</div>
      <div class="box-value">₹${(policy.coverageAmount || policy.coverage || 0).toLocaleString('en-IN')}</div>
    </div>
    <div class="box">
      <div class="box-title">Premium Amount</div>
      <div class="box-value">₹${policy.premiumAmount || policy.weeklyPremium} / ${policy.paymentFrequency}</div>
    </div>
    <div class="box">
      <div class="box-title">Policy Period</div>
      <div class="box-value">${startDateStr} to ${endDateStr}</div>
    </div>
  </div>

  <div class="box" style="margin-bottom: 20px;">
    <div class="box-title">Covered Parametric Disruption Risks</div>
    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 5px;">
      ${(policy.coveredRisks || ['Rainfall', 'AQI', 'Temperature', 'Curfew', 'Flood', 'Cyclone']).map(r => `<span style="background:#DBEAFE; color:#1E40AF; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">✓ ${r}</span>`).join(' ')}
    </div>
  </div>

  <div class="box-title">Payment Receipts Summary</div>
  <table>
    <thead>
      <tr>
        <th>Invoice No</th>
        <th>Date</th>
        <th>Amount</th>
        <th>Payment Method</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${(policy.paymentHistory || []).map(p => `
        <tr>
          <td>${p.invoiceNo || 'INV-001'}</td>
          <td>${new Date(p.paymentDate).toLocaleDateString('en-GB')}</td>
          <td>₹${p.amount}</td>
          <td>${p.method}</td>
          <td style="color:#059669; font-weight:bold;">${p.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>
      <p style="font-size: 11px; color: #6B7280; margin: 0;">Authorized Parametric Insurance Issuer: GigShield Technologies Pvt Ltd</p>
      <p style="font-size: 11px; color: #6B7280; margin: 4px 0 0 0;">Digital Signature Hash: sha256-${policy._id.toString().substring(0, 16)}</p>
    </div>
    <div class="qr">
      [QR VERIFIED]<br/>
      ${policy.policyNumber}
    </div>
  </div>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="Policy_${policy.policyNumber}.html"`);
    res.send(htmlContent);
  } catch (err) {
    res.status(500).send('Error generating policy document: ' + err.message);
  }
};

// ── GET /policy/calculate-premium ─────────────────────────────────────────────
exports.calculatePremium = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { weatherRisk, predictedLoss, planType = 'Premium' } = req.query;
    const dynamicCalc = await calculateUserPremium(user, weatherRisk, predictedLoss, planType);

    res.json(dynamicCalc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /policy/status ────────────────────────────────────────────────────────
exports.getPolicyStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let policy = await Policy.findOne({ userId: user._id }).sort({ createdAt: -1 });

    const now = new Date();
    let status = 'INACTIVE';
    let daysRemaining = 0;

    if (policy) {
      const endDate = policy.policyEndDate || policy.endDate;
      const dueDate = policy.nextDueDate || endDate;

      if (endDate && now > endDate) {
        if (policy.policyStatus !== 'EXPIRED') {
          policy.policyStatus = 'EXPIRED';
          policy.status = 'EXPIRED';
          await policy.save();
        }
        status = 'EXPIRED';
      } else if (policy.policyStatus === 'ACTIVE' || policy.status === 'ACTIVE') {
        status = 'ACTIVE';
        if (dueDate) {
          daysRemaining = Math.max(0, Math.ceil((new Date(dueDate) - now) / (1000 * 60 * 60 * 24)));
        }
      } else if (policy.policyStatus === 'EXPIRED' || policy.status === 'EXPIRED') {
        status = 'EXPIRED';
      }
    }

    const workCity = user.workCity || user.location?.city || 'Mumbai';
    const risk = await RiskData.findOne({ city: new RegExp(`^${workCity}$`, 'i') }).sort({ recordedAt: -1 });
    const isBadWeather = risk ? (risk.rainfall > 35 || risk.disruptionLevel === 'high' || risk.disruptionLevel === 'extreme' || risk.aqi > 250) : false;
    const isHighRisk = risk ? (risk.disruptionLevel === 'high' || risk.disruptionLevel === 'extreme' || risk.rainfall > 50) : false;

    const dueDate = policy ? (policy.nextDueDate || policy.policyEndDate || policy.endDate) : null;
    const isDueSoon = status === 'ACTIVE' && dueDate && ((new Date(dueDate) - now) / (1000 * 60 * 60 * 24) <= 3);

    const alerts = {
      activatePolicyAlert: status !== 'ACTIVE' && isBadWeather,
      premiumDueReminder: isDueSoon,
      policyExpiredAlert: status === 'EXPIRED',
      activePolicyWeatherAlert: status === 'ACTIVE' && isHighRisk
    };

    const dynamicQuote = await calculateUserPremium(user, null, null, 'Premium');

    res.json({
      policyStatus: status,
      planName: policy ? policy.planName : dynamicQuote.planName,
      premiumAmount: policy ? (policy.premiumAmount || policy.weeklyPremium) : dynamicQuote.premiumAmount,
      paymentFrequency: policy ? (policy.paymentFrequency || 'Weekly') : 'Weekly',
      nextDueDate: dueDate,
      daysRemaining,
      coverageStatus: status === 'ACTIVE' ? 'Protected' : 'Unprotected',
      coverageAmount: policy ? policy.coverageAmount : dynamicQuote.coverageAmount,
      autoRenew: policy ? policy.autoRenew : true,
      riskLevel: policy ? (policy.riskLevel || dynamicQuote.riskLevel) : dynamicQuote.riskLevel,
      weeklyIncome: user.weeklyIncome,
      weatherRisk: policy?.calculation?.weatherRisk || dynamicQuote.calculation.weatherRisk,
      calculation: policy?.calculation || dynamicQuote.calculation,
      recommendationReason: policy?.calculation?.recommendationReason || dynamicQuote.calculation.recommendationReason,
      policy,
      alerts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /policy/notifications ──────────────────────────────────────────────────
exports.getPolicyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user.id,
      type: { $in: ['weather', 'policy', 'payment', 'claim', 'payout', 'aqi'] }
    }).sort({ createdAt: -1 }).limit(100);

    const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });

    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /policy/activate ─────────────────────────────────────────────────────
exports.activatePolicy = async (req, res) => {
  try {
    const { planType = 'standard', paymentFrequency = 'Weekly' } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.verificationStatus !== 'approved') {
      return res.status(403).json({ error: 'Account not verified. Await admin approval.' });
    }
    if (user.fraudStatus === 'blocked') {
      return res.status(403).json({ error: 'Account blocked due to fraud.' });
    }

    const dynamicCalc = await calculateUserPremium(user, null, null, planType);
    const durationDays = paymentFrequency === 'Monthly' ? 30 : 7;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const finalPremiumAmount = paymentFrequency === 'Monthly'
      ? dynamicCalc.premiumAmount
      : Math.round(dynamicCalc.premiumAmount / 4);

    await Policy.updateMany({ userId: user._id, policyStatus: 'ACTIVE' }, { policyStatus: 'INACTIVE', status: 'INACTIVE' });

    const policy = new Policy({
      userId: user._id,
      planName: dynamicCalc.planName,
      premiumAmount: finalPremiumAmount,
      weeklyPremium: finalPremiumAmount,
      coverageAmount: dynamicCalc.coverageAmount,
      paymentFrequency,
      riskLevel: dynamicCalc.riskLevel,
      calculation: dynamicCalc.calculation,
      coverageType: ['rainfall', 'aqi', 'temperature', 'curfew'],
      coveredRisks: ['Rainfall', 'AQI', 'Temperature', 'Curfew', 'Flood', 'Cyclone'],
      thresholds: { rainfall: 50, aqi: 200, temperature: 42 },
      policyStatus: 'ACTIVE',
      status: 'ACTIVE',
      policyStartDate: startDate,
      startDate,
      policyEndDate: endDate,
      endDate,
      expiryDate: endDate,
      nextDueDate: endDate,
      autoRenew: true
    });

    await policy.save();

    await notify.policyActivated(user._id, dynamicCalc.planName, policy.coverageAmount);

    res.status(201).json({
      success: true,
      message: 'Policy activated successfully with dynamic premium calculation',
      policy,
      calculation: dynamicCalc.calculation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /policy/dashboard ─────────────────────────────────────────────────────
exports.getPolicyDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let policy = await Policy.findOne({ userId: user._id }).sort({ createdAt: -1 });

    const now = new Date();
    let status = 'INACTIVE';
    let daysRemaining = 0;

    if (policy) {
      const endDate = policy.policyEndDate || policy.endDate;
      const dueDate = policy.nextDueDate || endDate;

      if (endDate && now > endDate) {
        status = 'EXPIRED';
      } else if (policy.policyStatus === 'ACTIVE' || policy.status === 'ACTIVE') {
        status = 'ACTIVE';
        if (dueDate) {
          daysRemaining = Math.max(0, Math.ceil((new Date(dueDate) - now) / (1000 * 60 * 60 * 24)));
        }
      } else {
        status = 'INACTIVE';
      }
    }

    const workCity = user.workCity || user.location?.city || 'Mumbai';
    const risk = await RiskData.findOne({ city: new RegExp(`^${workCity}$`, 'i') }).sort({ recordedAt: -1 });
    const isBadWeather = risk ? (risk.rainfall > 35 || risk.disruptionLevel === 'high' || risk.disruptionLevel === 'extreme' || risk.aqi > 250) : false;
    const isHighRisk = risk ? (risk.disruptionLevel === 'high' || risk.disruptionLevel === 'extreme' || risk.rainfall > 50) : false;

    const dueDate = policy ? (policy.nextDueDate || policy.policyEndDate || policy.endDate) : null;
    const isDueSoon = status === 'ACTIVE' && dueDate && ((new Date(dueDate) - now) / (1000 * 60 * 60 * 24) <= 3);

    const alerts = {
      activatePolicyAlert: status !== 'ACTIVE' && isBadWeather,
      premiumDueReminder: isDueSoon,
      policyExpiredAlert: status === 'EXPIRED',
      activePolicyWeatherAlert: status === 'ACTIVE' && isHighRisk
    };

    const recentNotifications = await Notification.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    const dynamicQuote = await calculateUserPremium(user, null, null, 'Premium');

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        platform: user.platform,
        workCity,
        weeklyIncome: user.weeklyIncome,
        verificationStatus: user.verificationStatus
      },
      widget: {
        policyStatus: status,
        planName: policy ? policy.planName : dynamicQuote.planName,
        premiumAmount: policy ? (policy.premiumAmount || policy.weeklyPremium) : dynamicQuote.premiumAmount,
        paymentFrequency: policy ? (policy.paymentFrequency || 'Weekly') : 'Weekly',
        nextDueDate: dueDate,
        daysRemaining,
        coverageStatus: status === 'ACTIVE' ? 'Protected' : 'Unprotected',
        coverageAmount: policy ? policy.coverageAmount : dynamicQuote.coverageAmount,
        weeklyIncome: user.weeklyIncome,
        weatherRisk: policy?.calculation?.weatherRisk || dynamicQuote.calculation.weatherRisk,
        recommendationReason: policy?.calculation?.recommendationReason || dynamicQuote.calculation.recommendationReason,
        calculation: policy?.calculation || dynamicQuote.calculation
      },
      policy,
      alerts,
      recentNotifications,
      weatherRisk: risk || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
