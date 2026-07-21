const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  phone:    { type: String, required: true, unique: true },

  // Platform
  platform:       { type: String, enum: ['Swiggy', 'Zomato', 'Zepto', 'Blinkit', 'Dunzo', 'Other'], required: true },
  customPlatform: { type: String },
  workerId: { type: String, unique: true, sparse: true },

  // Verification
  aadhaarNumber:       { type: String, unique: true, sparse: true },
  enteredAadhaar:      { type: String, sparse: true },
  ocrAadhaar:          { type: String, sparse: true },
  ocrConfidence:       { type: Number, min: 0, max: 100 },
  idProofUrl:          { type: String },
  profileScreenshotUrl:{ type: String },
  workerIdCardUrl:     { type: String },
  aadhaarCardUrl:      { type: String },
  platformScreenshotUrl:{ type: String },
  verificationStatus:  { type: String, enum: ['pending','pending_manual_review','auto_verified','approved','rejected','failed'], default: 'pending' },
  verificationMessage: { type: String },
  verifiedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt:          { type: Date },
  verificationDate:    { type: Date },

  // Role
  role: { type: String, enum: ['user', 'admin'], default: 'user' },

  // Location
  location:      { city: { type: String, required: true }, lat: { type: Number, required: true }, lng: { type: Number, required: true } },
  homeCity:      { type: String, default: '' },
  workCity:      { type: String, default: '' },
  customHomeCity:{ type: String },
  customWorkCity:{ type: String },

  // Income / activity
  weeklyIncome:        { type: Number, required: true },
  averageDailyIncome:  { type: Number, default: 0 },
  averageOrdersPerDay: { type: Number, default: 0 },
  onlineHoursPerDay:   { type: Number, default: 0 },

  // Risk & premium
  riskScore:     { type: Number, default: 50 },
  riskLevel:     { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  weeklyPremium: { type: Number, default: 0 },

  // Fraud detection
  fraudScore:  { type: Number, default: 0 },
  fraudStatus: { type: String, enum: ['safe', 'review', 'suspicious', 'blocked'], default: 'safe' },
  fraudReason: { type: String },

  // History refs
  premiumHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PremiumHistory' }],
  claimHistory:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClaimHistory' }],

  // GPS
  currentGps: { lat: Number, lng: Number, updatedAt: Date },
  gpsHistory: [{ lat: Number, lng: Number, recordedAt: { type: Date, default: Date.now } }],

  // Anti-fraud
  ipAddress:  { type: String },
  trustScore: { type: Number, default: 100 },

  currentOrder: { status: { type: String, enum: ['active', 'none', 'cancelled'], default: 'none' }, updatedAt: Date },

  // Payment details
  upiId:       { type: String },
  bankAccount: { accountNumber: String, ifsc: String, name: String },

  pushSubscription: { type: mongoose.Schema.Types.Mixed },

  isActive:  { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
