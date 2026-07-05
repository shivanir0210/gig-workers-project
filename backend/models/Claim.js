const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true },

  // Location
  affectedCity:    { type: String },
  affectedLocation:{ type: String }, // e.g. "Flood at Home Location"
  cityType:        { type: String, enum: ['home', 'work', 'other'], default: 'work' },
  claimReason:     { type: String }, // e.g. "Flood in Work City", "AQI Alert"

  // Trigger
  triggerType:  { type: String, enum: ['rainfall', 'aqi', 'temperature', 'curfew'], required: true },
  triggerValue: { type: Number, required: true },
  threshold:    { type: Number, required: true },

  // Income loss
  expectedIncome:  { type: Number, default: 0 },
  actualIncome:    { type: Number, default: 0 },
  actualIncomeLoss:{ type: Number, default: 0 },

  payoutAmount: { type: Number, required: true },
  status:       { type: String, enum: ['pending', 'approved', 'paid', 'rejected', 'investigating'], default: 'pending' },
  fraudScore:   { type: Number, default: 0 },

  validationDetails: {
    gpsVerified:      { type: Boolean, default: false },
    activityVerified: { type: Boolean, default: false },
    ipMatches:        { type: Boolean, default: false },
    platformPaused:   { type: Boolean, default: false },
    duplicateCheck:   { type: Boolean, default: true },
    anomalyScore:     { type: Number, default: 0 },
    riskZoneId:       { type: mongoose.Schema.Types.ObjectId },
    dualCityVerified: { type: Boolean, default: false },
    homeCityData:     { city: String, rainfall: Number, aqi: Number, temperature: Number },
    workCityData:     { city: String, rainfall: Number, aqi: Number, temperature: Number }
  },

  razorpayPaymentId: { type: String },
  triggeredAt: { type: Date, default: Date.now },
  paidAt:      { type: Date }
});

module.exports = mongoose.model('Claim', claimSchema);
