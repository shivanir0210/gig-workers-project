const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  claimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['pending', 'processing', 'success', 'failed'], default: 'pending' },
  method: { type: String, enum: ['upi', 'bank'], default: 'upi' },
  upiId: { type: String },
  bankAccount: { accountNumber: String, ifsc: String, name: String },
  razorpayPayoutId: { type: String },
  failureReason: { type: String },
  gpsVerified: { type: Boolean, default: false },
  locationMatchScore: { type: Number, default: 0 }, // 0-100
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

module.exports = mongoose.model('Payout', payoutSchema);
