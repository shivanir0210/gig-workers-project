const RiskData = require('../models/RiskData');

/**
 * Calculate dynamic user-specific insurance premium
 * @param {Object} user - User model object
 * @param {String} weatherRiskInput - Optional weather risk override ('High', 'Medium', 'Low')
 * @param {Number} predictedLossInput - Optional predicted weekly loss
 * @param {String} planTier - 'Basic', 'Standard', 'Premium' (default: 'Premium')
 */
async function calculateUserPremium(user, weatherRiskInput = null, predictedLossInput = null, planTier = 'Premium') {
  const weeklyIncome = Math.max(1000, Number(user.weeklyIncome) || 5000);
  const workCity = user.workCity || user.location?.city || 'Mumbai';

  // 1. Determine Weather Risk
  let weatherRisk = weatherRiskInput;
  if (!weatherRisk) {
    const latestRisk = await RiskData.findOne({ city: new RegExp(`^${workCity}$`, 'i') }).sort({ recordedAt: -1 });
    if (latestRisk) {
      if (latestRisk.disruptionLevel === 'high' || latestRisk.disruptionLevel === 'extreme' || latestRisk.rainfall > 35) {
        weatherRisk = 'High';
      } else if (latestRisk.disruptionLevel === 'medium' || latestRisk.rainfall > 15 || latestRisk.aqi > 200) {
        weatherRisk = 'Medium';
      } else {
        weatherRisk = 'Low';
      }
    } else {
      weatherRisk = 'Medium';
    }
  }

  // Normalize weatherRisk casing
  const normalizedRisk = weatherRisk.charAt(0).toUpperCase() + weatherRisk.slice(1).toLowerCase();
  const riskLevel = ['High', 'Medium', 'Low'].includes(normalizedRisk) ? normalizedRisk : 'Medium';

  // 2. Base Premium Calculation based on Weekly Income
  let basePremium = 199;
  if (weeklyIncome <= 4000) {
    basePremium = 99;
  } else if (weeklyIncome <= 8000) {
    basePremium = 199;
  } else {
    basePremium = 349;
  }

  // 3. Plan Tier Multipliers
  const tierMultipliers = {
    basic: 0.75,
    standard: 1.0,
    premium: 1.25
  };
  const tierKey = planTier.toLowerCase();
  const multiplier = tierMultipliers[tierKey] || tierMultipliers.premium;
  const adjustedBase = Math.round(basePremium * multiplier);

  // 4. Weather Risk Adjustment Calculation
  let riskPercentage = 0;
  if (riskLevel === 'High') {
    riskPercentage = 0.15; // 15% increase
  } else if (riskLevel === 'Medium') {
    riskPercentage = 0.08; // 8% increase
  } else {
    riskPercentage = 0;    // 0% increase
  }

  const riskAdjustment = Math.round(adjustedBase * riskPercentage);
  const premiumAmount = adjustedBase + riskAdjustment;

  // 5. Coverage Amount Calculation
  const coverageMultipliers = { basic: 2.0, standard: 3.0, premium: 3.5 };
  const covMult = coverageMultipliers[tierKey] || 3.5;
  const coverageAmount = Math.max(15000, Math.round(weeklyIncome * covMult));

  // 6. Explanation
  const tierName = planTier.charAt(0).toUpperCase() + planTier.slice(1);
  const recommendationReason = `${tierName} Plan: Base premium ₹${adjustedBase} (Income tier ₹${weeklyIncome.toLocaleString('en-IN')}) + ${riskPercentage * 100}% ${riskLevel} Weather Risk adjustment (₹${riskAdjustment}).`;

  return {
    planName: tierName,
    premiumAmount,
    coverageAmount,
    riskLevel,
    calculation: {
      weeklyIncome,
      weatherRisk: riskLevel,
      basePremium: adjustedBase,
      riskAdjustment,
      predictedWeeklyLoss: predictedLossInput || Math.round(weeklyIncome * 0.3),
      workCity,
      platform: user.platform || 'General',
      recommendationReason
    }
  };
}

module.exports = { calculateUserPremium };
