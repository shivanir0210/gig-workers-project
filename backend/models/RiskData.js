const mongoose = require('mongoose');

const riskDataSchema = new mongoose.Schema({
  city: { type: String, required: true },
  lat: { type: Number },
  lng: { type: Number },
  weather: {
    rainfall: { type: Number, default: 0 },
    temperature: { type: Number },
    humidity: { type: Number },
    windSpeed: { type: Number },
    description: { type: String }
  },
  aqi: { type: Number, default: 0 },
  aqiCategory: { type: String },
  disruptionLevel: { type: String, enum: ['none', 'low', 'medium', 'high', 'extreme'], default: 'none' },
  alerts: [{ type: String }],
  recordedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RiskData', riskDataSchema);
