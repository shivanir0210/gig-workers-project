const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:    { type: String, required: true },
  message:  { type: String, required: true },
  type:     { type: String, enum: ['weather', 'aqi', 'claim', 'policy', 'payment', 'payout', 'admin', 'security'], default: 'weather' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  isRead:   { type: Boolean, default: false },
  // legacy fields kept for backward compat
  alertType:{ type: String },
  severity: { type: String },
  city:     { type: String },
  timestamp:{ type: Date, default: Date.now },
  createdAt:{ type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
