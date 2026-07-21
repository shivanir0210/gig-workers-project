const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  invoiceNo: { type: String },
  paymentDate: { type: Date, default: Date.now },
  amount: { type: Number, required: true },
  method: { type: String, default: 'UPI' },
  status: { type: String, enum: ['Paid', 'Pending', 'Failed'], default: 'Paid' },
  receiptUrl: { type: String }
}, { _id: true });

const policySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  policyNumber: { type: String, unique: true },
  planName: { type: String, required: true },
  plan: { type: String },
  premiumAmount: { type: Number },
  weeklyPremium: { type: Number },
  premium: { type: Number },
  coverageAmount: { type: Number, required: true },
  coverage: { type: Number },
  paymentFrequency: { type: String, enum: ['Monthly', 'Weekly'], default: 'Weekly' },
  frequency: { type: String, default: 'Weekly' },
  coverageType: [{ type: String }],
  coveredRisks: [{ type: String }],
  thresholds: {
    rainfall: { type: Number, default: 50 },
    aqi: { type: Number, default: 200 },
    temperature: { type: Number, default: 42 }
  },
  policyStatus: { type: String, enum: ['ACTIVE', 'UPCOMING', 'EXPIRED', 'CANCELLED', 'INACTIVE'], default: 'ACTIVE' },
  status: { type: String, enum: ['ACTIVE', 'UPCOMING', 'EXPIRED', 'CANCELLED', 'INACTIVE', 'active', 'upcoming', 'expired', 'cancelled', 'inactive'], default: 'ACTIVE' },
  riskLevel: { type: String, default: 'Medium' },
  calculation: {
    weeklyIncome: Number,
    weatherRisk: String,
    basePremium: Number,
    riskAdjustment: Number,
    predictedWeeklyLoss: Number,
    workCity: String,
    platform: String,
    recommendationReason: String
  },
  policyStartDate: { type: Date, default: Date.now },
  startDate: { type: Date, default: Date.now },
  policyEndDate: { type: Date },
  endDate: { type: Date },
  expiryDate: { type: Date },
  renewalDate: { type: Date },
  nextDueDate: { type: Date },
  totalInstallments: { type: Number, default: 52 },
  paidInstallments: { type: Number, default: 1 },
  pendingInstallments: { type: Number, default: 51 },
  missedInstallments: { type: Number, default: 0 },
  lastPaymentDate: { type: Date, default: Date.now },
  paymentHistory: [paymentHistorySchema],
  claims: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Claim' }],
  claimCount: { type: Number, default: 0 },
  claimAmount: { type: Number, default: 0 },
  cancelledDate: { type: Date },
  cancelledReason: { type: String },
  downloadUrl: { type: String },
  autoRenew: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// Sync aliases and calculate installment counts before save
policySchema.pre('save', function () {
  if (!this.policyNumber) {
    const randomSeq = Math.floor(100000 + Math.random() * 900000);
    this.policyNumber = `GS-2026-${randomSeq}`;
  }

  this.plan = this.planName;
  this.premium = this.premiumAmount || this.weeklyPremium || 149;
  this.weeklyPremium = this.premium;
  this.premiumAmount = this.premium;
  this.coverage = this.coverageAmount;

  if (!this.coveredRisks || this.coveredRisks.length === 0) {
    this.coveredRisks = ['Rainfall', 'AQI', 'Temperature', 'Curfew', 'Flood', 'Cyclone'];
  }
  if (!this.coverageType || this.coverageType.length === 0) {
    this.coverageType = ['rainfall', 'aqi', 'temperature', 'curfew'];
  }

  if (this.policyStatus) {
    this.status = this.policyStatus.toUpperCase();
  } else if (this.status) {
    this.policyStatus = this.status.toUpperCase();
  }

  const now = new Date();
  if (this.policyStatus !== 'CANCELLED' && this.status !== 'CANCELLED') {
    const start = this.policyStartDate || this.startDate;
    const end = this.policyEndDate || this.endDate || this.expiryDate;

    if (start && now < new Date(start)) {
      this.policyStatus = 'UPCOMING';
      this.status = 'UPCOMING';
    } else if (end && now > new Date(end)) {
      this.policyStatus = 'EXPIRED';
      this.status = 'EXPIRED';
    } else {
      this.policyStatus = 'ACTIVE';
      this.status = 'ACTIVE';
    }
  }

  if (this.startDate && !this.policyStartDate) this.policyStartDate = this.startDate;
  if (this.policyStartDate && !this.startDate) this.startDate = this.policyStartDate;
  if (this.endDate && !this.policyEndDate) this.policyEndDate = this.endDate;
  if (this.policyEndDate && !this.endDate) this.endDate = this.policyEndDate;
  if (!this.expiryDate && (this.policyEndDate || this.endDate)) this.expiryDate = this.policyEndDate || this.endDate;

  if (!this.renewalDate && (this.policyEndDate || this.endDate || this.expiryDate)) {
    this.renewalDate = this.policyEndDate || this.endDate || this.expiryDate;
  }

  if (this.paymentFrequency === 'Monthly' || this.frequency === 'Monthly') {
    this.totalInstallments = 12;
  } else {
    this.totalInstallments = 52;
  }

  this.pendingInstallments = Math.max(0, this.totalInstallments - (this.paidInstallments || 0));

  if (!this.paymentHistory || this.paymentHistory.length === 0) {
    this.paymentHistory = [{
      invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
      paymentDate: this.policyStartDate || this.startDate || new Date(),
      amount: this.premiumAmount || 149,
      method: 'UPI',
      status: 'Paid',
      receiptUrl: `/api/policies/${this._id}/download`
    }];
  }
});

module.exports = mongoose.model('Policy', policySchema);
