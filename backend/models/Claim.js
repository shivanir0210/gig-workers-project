const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true },
  triggerType: { type: String, enum: ['rainfall', 'aqi', 'temperature', 'curfew'], required: true },
  triggerValue: { type: Number, required: true },
  threshold: { type: Number, required: true },
  payoutAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'paid', 'rejected'], default: 'pending' },
  fraudScore: { type: Number, default: 0 },
  validationDetails: {
    gpsVerified: { type: Boolean, default: false },
    activityVerified: { type: Boolean, default: false },
    ipMatches: { type: Boolean, default: false },
    platformPaused: { type: Boolean, default: false },
    duplicateCheck: { type: Boolean, default: true },
    anomalyScore: { type: Number, default: 0 }
  },
  razorpayPaymentId: { type: String },
  triggeredAt: { type: Date, default: Date.now },
  paidAt: { type: Date }
});

module.exports = mongoose.model('Claim', claimSchema);
