const mongoose = require('mongoose');

const riskZoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  center: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  radius: { type: Number, required: true }, // in meters
  riskLevel: { type: String, enum: ['none', 'low', 'medium', 'high', 'extreme'], default: 'none' },
  weather: {
    rainfall: { type: Number, default: 0 },
    temperature: { type: Number, default: 30 }
  },
  aqi: { type: Number, default: 50 },
  alerts: [{ type: String }],
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RiskZone', riskZoneSchema);
