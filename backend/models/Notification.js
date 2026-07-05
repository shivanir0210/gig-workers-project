const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  city: { type: String, required: true },
  alertType: { type: String, required: true }, // e.g. "Heavy Rain Alert", "Flood Alert", "AQI Alert", "Heatwave Alert", "Cyclone Alert"
  severity: { type: String, enum: ['low', 'medium', 'high', 'extreme'], default: 'medium' },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
