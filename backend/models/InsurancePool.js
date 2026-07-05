const mongoose = require('mongoose');

const insurancePoolSchema = new mongoose.Schema({
  totalPremiumCollected: { type: Number, default: 0 },
  totalClaimsPaid:       { type: Number, default: 0 },
  availablePool:         { type: Number, default: 0 },
  updatedAt:             { type: Date, default: Date.now }
});

module.exports = mongoose.model('InsurancePool', insurancePoolSchema);
