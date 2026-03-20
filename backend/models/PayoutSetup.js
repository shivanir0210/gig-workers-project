const mongoose = require('mongoose');

const payoutSetupSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true },
  upiId: { type: String, required: true },
  paymentMode: { type: String, required: true, enum: ['UPI', 'CARD', 'WALLET'] },
  status: { type: String, default: 'PENDING' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PayoutSetup', payoutSetupSchema);
