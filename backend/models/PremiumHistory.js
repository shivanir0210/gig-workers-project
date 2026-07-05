const mongoose = require('mongoose');

// PHASE 5 – Premium History collection
const premiumHistorySchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  premiumAmount: { type: Number, required: true },
  planName:      { type: String },
  riskScore:     { type: Number },   // snapshot at the time of premium generation
  riskLevel:     { type: String },
  generatedDate: { type: Date, default: Date.now },
  weeklyIncome:  { type: Number },
  homeCity:      { type: String },
  workCity:      { type: String },
  // ML prep snapshot
  averageDailyIncome:  { type: Number },
  averageOrdersPerDay: { type: Number },
  onlineHoursPerDay:   { type: Number }
});

module.exports = mongoose.model('PremiumHistory', premiumHistorySchema);
