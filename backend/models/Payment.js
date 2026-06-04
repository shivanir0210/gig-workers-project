const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy' },

  // Premium amount
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  type: { type: String, enum: ['premium', 'renewal'], default: 'premium' },

  // Transaction status fields (required for production flow)
  paymentStatus: { type: String, enum: ['created', 'success', 'failed', 'refunded'], default: 'created' },
  paymentDate: { type: Date },

  // Razorpay ids/signature (required)
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  paymentSignature: { type: String },

  // Backward compatibility with existing code/UI
  status: { type: String, enum: ['created', 'success', 'failed', 'refunded'], default: 'created' },
  razorpaySignature: { type: String },

  method: { type: String }, // upi, card, wallet
  description: { type: String },
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date }
});

module.exports = mongoose.model('Payment', paymentSchema);
