const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  type: { type: String, enum: ['premium', 'renewal'], default: 'premium' },
  status: { type: String, enum: ['created', 'success', 'failed', 'refunded'], default: 'created' },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySignature: { type: String },
  method: { type: String }, // upi, card, wallet
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date }
});

module.exports = mongoose.model('Payment', paymentSchema);
