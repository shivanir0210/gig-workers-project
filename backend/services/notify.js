const Notification = require('../models/Notification');

/**
 * createNotification({ userId, title, message, type, priority, city, alertType, dedupeHours })
 * dedupeHours: skip if same userId+alertType+city exists within N hours (optional)
 */
async function createNotification({ userId, title, message, type = 'weather', priority = 'medium', city = '', alertType = '', dedupeHours = 0 }) {
  try {
    if (dedupeHours > 0 && alertType) {
      const since = new Date(Date.now() - dedupeHours * 60 * 60 * 1000);
      const exists = await Notification.findOne({ userId, alertType, city, createdAt: { $gte: since } });
      if (exists) return null;
    }
    return await Notification.create({ userId, title, message, type, priority, alertType: alertType || type, city, severity: priority, timestamp: new Date(), createdAt: new Date() });
  } catch (err) {
    console.error('createNotification error:', err.message);
    return null;
  }
}

// ── Typed helpers ─────────────────────────────────────────────────────────────

const notify = {
  // Weather
  heavyRain: (userId, city, rainfall) => createNotification({
    userId, city, type: 'weather', priority: 'high', alertType: 'Heavy Rain Alert',
    title: '🌧️ Heavy Rain Alert',
    message: `Heavy rainfall of ${rainfall}mm detected in ${city}. Income disruption is expected. Stay safe.`,
    dedupeHours: 6
  }),
  flood: (userId, city, rainfall) => createNotification({
    userId, city, type: 'weather', priority: 'critical', alertType: 'Flood Alert',
    title: '🌊 Flood Alert',
    message: `Flood conditions detected in ${city} (${rainfall}mm rainfall). Delivery operations severely affected. Insurance coverage may apply.`,
    dedupeHours: 6
  }),
  heatwave: (userId, city, temp) => createNotification({
    userId, city, type: 'weather', priority: 'critical', alertType: 'Heatwave Alert',
    title: '🔥 Heatwave Alert',
    message: `Extreme heat of ${temp}°C detected in ${city}. Risk of heat exhaustion for outdoor workers.`,
    dedupeHours: 6
  }),
  cyclone: (userId, city, windSpeed) => createNotification({
    userId, city, type: 'weather', priority: 'critical', alertType: 'Cyclone Alert',
    title: '🌀 Cyclone Alert',
    message: `Cyclone warning in ${city} — wind speeds of ${windSpeed} km/h detected. Avoid outdoor work.`,
    dedupeHours: 6
  }),

  // AQI
  aqi: (userId, city, aqiValue) => {
    const priority = aqiValue > 300 ? 'critical' : aqiValue > 200 ? 'high' : 'medium';
    const label    = aqiValue > 300 ? 'Severe Air Pollution' : aqiValue > 200 ? 'Very Poor Air Quality' : 'Poor Air Quality';
    const advice   = aqiValue > 300 ? 'Please avoid outdoor work immediately.' : aqiValue > 200 ? 'Outdoor work is not recommended.' : 'Sensitive workers should take precautions.';
    return createNotification({
      userId, city, type: 'aqi', priority, alertType: 'AQI Alert',
      title: `🌫️ AQI Alert — ${label}`,
      message: `AQI reached ${aqiValue} in ${city}. ${advice}`,
      dedupeHours: 6
    });
  },

  // Dual-city claim eligibility
  dualCityEligible: (userId, homeCity, workCity, triggerType, homeVal, workVal) => createNotification({
    userId, city: `${homeCity} & ${workCity}`, type: 'claim', priority: 'critical', alertType: 'dual_city_eligible',
    title: '⭐ Claim Eligible — Both Cities Affected',
    message: `Heavy ${triggerType} detected in both your Home City (${homeCity}: ${homeVal}) and Work City (${workCity}: ${workVal}). You are eligible to submit a parametric insurance claim now.`,
    dedupeHours: 6
  }),

  // Claims
  claimSubmitted: (userId, triggerType, amount) => createNotification({
    userId, type: 'claim', priority: 'medium', alertType: 'claim_submitted',
    title: '📋 Claim Submitted',
    message: `Your ${triggerType} disruption claim for ₹${amount} has been submitted and is under review.`
  }),
  claimApproved: (userId, amount) => createNotification({
    userId, type: 'claim', priority: 'high', alertType: 'claim_approved',
    title: '✅ Claim Approved',
    message: `Your claim has been approved. Payout of ₹${amount} will be processed shortly.`
  }),
  claimRejected: (userId, reason) => createNotification({
    userId, type: 'claim', priority: 'high', alertType: 'claim_rejected',
    title: '❌ Claim Rejected',
    message: `Your claim has been rejected. ${reason || 'Please contact support for more details.'}`
  }),

  // Payments
  paymentSuccess: (userId, amount, planName) => createNotification({
    userId, type: 'payment', priority: 'medium', alertType: 'payment_success',
    title: '💳 Premium Payment Successful',
    message: `Your premium payment of ₹${amount} for ${planName || 'your plan'} was completed successfully.`
  }),
  paymentFailed: (userId, amount) => createNotification({
    userId, type: 'payment', priority: 'high', alertType: 'payment_failed',
    title: '⚠️ Payment Failed',
    message: `Your premium payment of ₹${amount} could not be completed. Please retry.`
  }),

  // Payouts
  payoutInitiated: (userId, amount) => createNotification({
    userId, type: 'payout', priority: 'high', alertType: 'payout_initiated',
    title: '💸 Payout Initiated',
    message: `A payout of ₹${amount} has been initiated to your registered payment method.`
  }),
  payoutCredited: (userId, amount, method) => createNotification({
    userId, type: 'payout', priority: 'high', alertType: 'payout_credited',
    title: '🟢 Payout Credited Successfully',
    message: `₹${amount} has been credited to your ${method?.toUpperCase() || 'account'} successfully.`
  }),

  // Policy
  policyActivated: (userId, planName, coverageAmount) => createNotification({
    userId, type: 'policy', priority: 'medium', alertType: 'policy_activated',
    title: '📄 Policy Activated',
    message: `Your ${planName} insurance policy is now active with ₹${coverageAmount} coverage. You are protected against weather disruptions.`
  }),
  policyExpiringSoon: (userId, planName, daysLeft) => createNotification({
    userId, type: 'policy', priority: 'high', alertType: 'policy_expiring',
    title: '⏳ Policy Expiring Soon',
    message: `Your ${planName} policy expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Renew now to stay protected.`,
    dedupeHours: 24
  }),
  policyExpired: (userId, planName) => createNotification({
    userId, type: 'policy', priority: 'critical', alertType: 'policy_expired',
    title: '🔴 Policy Expired',
    message: `Your ${planName} policy has expired. Purchase a new plan to restore income protection.`
  }),

  // Admin
  documentsVerified: (userId) => createNotification({
    userId, type: 'admin', priority: 'high', alertType: 'docs_verified',
    title: '✅ Documents Verified',
    message: 'Your identity documents have been verified by our admin team. You can now purchase insurance policies.'
  }),
  documentsRejected: (userId, reason) => createNotification({
    userId, type: 'admin', priority: 'critical', alertType: 'docs_rejected',
    title: '❌ Verification Failed',
    message: `Your documents could not be verified. ${reason || 'Please re-upload valid documents.'}`
  }),

  // Security
  newLogin: (userId) => createNotification({
    userId, type: 'security', priority: 'medium', alertType: 'new_login',
    title: '🔐 New Login Detected',
    message: 'A new login to your GigShield account was detected. If this was not you, please contact support immediately.'
  }),
};

module.exports = notify;
