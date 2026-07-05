const mongoose = require('mongoose');

// PHASE 4 – Claim History collection (separate from operational Claim)
const claimHistorySchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  claimId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Claim' },
  claimDate:    { type: Date, default: Date.now },
  claimReason:  { type: String, required: true },       // e.g. 'Heavy rainfall in work city'
  affectedCity: { type: String, required: true },
  cityType:     { type: String, enum: ['home', 'work', 'other'], default: 'work' },
  payoutAmount: { type: Number, required: true },
  status:       { type: String, enum: ['pending', 'approved', 'paid', 'rejected'], default: 'pending' },
  weatherData: {
    rainfall:    { type: Number },
    temperature: { type: Number },
    aqi:         { type: Number },
    description: { type: String }
  },
  // ML preparation fields
  triggerType: { type: String },
  triggerValue:{ type: Number },
  riskScore:   { type: Number }
});

module.exports = mongoose.model('ClaimHistory', claimHistorySchema);
