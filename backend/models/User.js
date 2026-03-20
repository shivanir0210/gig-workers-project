const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, required: true },
  platform: { type: String, enum: ['Zepto', 'Swiggy', 'Zomato', 'Other'], required: true },
  location: {
    city: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  // GPS tracking & Anti-fraud
  ipAddress: { type: String },
  currentOrder: {
    status: { type: String, enum: ['active', 'none', 'cancelled'], default: 'none' },
    updatedAt: { type: Date }
  },
  currentGps: {
    lat: { type: Number },
    lng: { type: Number },
    updatedAt: { type: Date }
  },
  gpsHistory: [{
    lat: { type: Number },
    lng: { type: Number },
    recordedAt: { type: Date, default: Date.now }
  }],
  // Payment details
  upiId: { type: String },
  bankAccount: {
    accountNumber: { type: String },
    ifsc: { type: String },
    name: { type: String }
  },
  weeklyIncome: { type: Number, required: true },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  weeklyPremium: { type: Number, default: 0 },
  trustScore: { type: Number, default: 100 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
