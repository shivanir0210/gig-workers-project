const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  alertType: { type: String, enum: ['rainfall', 'aqi', 'temperature', 'flood', 'cyclone'], required: true },
  city:      { type: String, required: true },
  cityType:  { type: String, enum: ['home', 'work'], required: true },
  message:   { type: String, required: true },
  severity:  { type: String, enum: ['low', 'medium', 'high', 'extreme'], default: 'medium' },
  triggerValue: { type: Number },
  status:    { type: String, enum: ['active', 'read', 'dismissed'], default: 'active' },
  // ML prep fields
  rainfall:     { type: Number },
  aqi:          { type: Number },
  temperature:  { type: Number },
  disruptionDays:{ type: Number },
  estimatedIncomeLoss: { type: Number },
  riskLevel:    { type: String },
  timestamp:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', alertSchema);
