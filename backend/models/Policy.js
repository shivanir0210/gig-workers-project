const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planName: { type: String, required: true },
  weeklyPremium: { type: Number, required: true },
  coverageAmount: { type: Number, required: true },
  coverageType: [{ type: String }], // ['rain', 'aqi', 'curfew', 'extreme_weather']
  thresholds: {
    rainfall: { type: Number, default: 50 },   // mm
    aqi: { type: Number, default: 200 },
    temperature: { type: Number, default: 42 } // celsius
  },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  autoRenew: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Policy', policySchema);
