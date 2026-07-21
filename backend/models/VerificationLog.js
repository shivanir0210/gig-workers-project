const mongoose = require('mongoose');

const verificationLogSchema = new mongoose.Schema({
  userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  enteredAadhaar:    { type: String },
  ocrAadhaar:        { type: String },
  ocrConfidence:     { type: Number, min: 0, max: 100 },
  verificationStatus:{ type: String, enum: ['pending','pending_manual_review','auto_verified','approved','rejected','failed'], required: true },
  verificationMessage:{ type: String },
  action:            { type: String, enum: ['auto-check','admin-approve','admin-reject','admin-review'], required: true },
  actionBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actionAt:          { type: Date, default: Date.now },
  rawText:           { type: String }
}, { timestamps: true });

module.exports = mongoose.model('VerificationLog', verificationLogSchema);
