import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Calendar, DollarSign, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function InsuranceStatusWidget({
  statusData = {},
  onPayPremium,
  onRenewPolicy
}) {
  const {
    policyStatus = 'INACTIVE',
    planName = 'No Plan',
    premiumAmount = 0,
    paymentFrequency = 'Weekly',
    nextDueDate,
    daysRemaining = 0,
    coverageStatus = 'Unprotected'
  } = statusData;

  const isDueSoon = statusData.alerts?.premiumDueReminder;

  // Color mappings according to spec:
  // Green -> Active Policy
  // Yellow -> Payment Due
  // Orange -> Weather Alert
  // Red -> Policy Expired
  let statusBadgeStyle = {
    bg: 'rgba(107, 114, 128, 0.15)',
    color: '#9CA3AF',
    border: 'rgba(107, 114, 128, 0.3)',
    label: 'INACTIVE'
  };

  if (policyStatus === 'ACTIVE') {
    if (isDueSoon) {
      statusBadgeStyle = {
        bg: 'rgba(245, 158, 11, 0.15)',
        color: '#F59E0B',
        border: 'rgba(245, 158, 11, 0.3)',
        label: 'PAYMENT DUE'
      };
    } else {
      statusBadgeStyle = {
        bg: 'rgba(34, 197, 94, 0.15)',
        color: '#22C55E',
        border: 'rgba(34, 197, 94, 0.3)',
        label: 'ACTIVE'
      };
    }
  } else if (policyStatus === 'EXPIRED') {
    statusBadgeStyle = {
      bg: 'rgba(239, 68, 68, 0.15)',
      color: '#EF4444',
      border: 'rgba(239, 68, 68, 0.3)',
      label: 'EXPIRED'
    };
  }

  const formattedDueDate = nextDueDate
    ? new Date(nextDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'N/A';

  const freqLabel = paymentFrequency === 'Monthly' ? 'month' : 'week';

  return (
    <div
      className="card p-4 sm:p-5 flex flex-col justify-between transition-all duration-300 hover:border-blue-500/40 shadow-xl"
      style={{
        background: 'linear-gradient(145deg, #0D1526 0%, #111827 100%)',
        border: `1px solid ${statusBadgeStyle.border}`
      }}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: statusBadgeStyle.bg }}>
            {policyStatus === 'ACTIVE' ? (
              <ShieldCheck size={18} style={{ color: statusBadgeStyle.color }} />
            ) : (
              <ShieldAlert size={18} style={{ color: statusBadgeStyle.color }} />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Insurance Status</h3>
            <p className="text-[11px] text-gray-400">GigShield Protection Overview</p>
          </div>
        </div>

        <span
          className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider animate-pulse flex items-center gap-1"
          style={{
            background: statusBadgeStyle.bg,
            color: statusBadgeStyle.color,
            border: `1px solid ${statusBadgeStyle.border}`
          }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: statusBadgeStyle.color }}></span>
          {statusBadgeStyle.label}
        </span>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
        {/* Plan Name */}
        <div className="p-2 rounded-lg bg-gray-900/60 border border-gray-800/80">
          <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-0.5">Plan Name</span>
          <span className="text-xs font-bold text-white truncate block">{planName}</span>
        </div>

        {/* Premium Amount */}
        <div className="p-2 rounded-lg bg-gray-900/60 border border-gray-800/80">
          <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-0.5">Premium Amount</span>
          <span className="text-xs font-bold text-white">
            ₹{premiumAmount}<span className="text-[10px] font-normal text-gray-400">/{freqLabel}</span>
          </span>
        </div>

        {/* Coverage Amount */}
        <div className="p-2 rounded-lg bg-gray-900/60 border border-gray-800/80">
          <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-0.5">Coverage Amount</span>
          <span className="text-xs font-bold text-green-400">₹{(statusData.coverageAmount || 0).toLocaleString('en-IN')}</span>
        </div>

        {/* Weekly Income */}
        <div className="p-2 rounded-lg bg-gray-900/60 border border-gray-800/80">
          <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-0.5">Weekly Income</span>
          <span className="text-xs font-bold text-gray-200">₹{(statusData.weeklyIncome || statusData.calculation?.weeklyIncome || 0).toLocaleString('en-IN')}</span>
        </div>

        {/* Weather Risk */}
        <div className="p-2 rounded-lg bg-gray-900/60 border border-gray-800/80">
          <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-0.5">Weather Risk</span>
          <span className={`text-xs font-bold ${statusData.weatherRisk === 'High' ? 'text-red-400' : statusData.weatherRisk === 'Medium' ? 'text-amber-400' : 'text-green-400'}`}>
            {statusData.weatherRisk || statusData.riskLevel || 'Low'}
          </span>
        </div>

        {/* Next Due Date */}
        <div className="p-2 rounded-lg bg-gray-900/60 border border-gray-800/80">
          <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-0.5 flex items-center gap-1">
            <Calendar size={10} /> Next Due
          </span>
          <span className={`text-xs font-bold ${isDueSoon ? 'text-amber-400' : 'text-gray-300'}`}>
            {formattedDueDate}
          </span>
        </div>
      </div>

      {/* Recommendation Breakdown: Why this premium was recommended */}
      {(statusData.recommendationReason || statusData.calculation?.recommendationReason) && (
        <div className="p-2.5 rounded-lg mb-3 bg-blue-950/20 border border-blue-500/20 text-xs text-gray-300 space-y-1">
          <span className="font-semibold text-blue-400 flex items-center gap-1 text-[11px]">
            💡 Why this premium was recommended:
          </span>
          <p className="text-[11px] leading-tight text-gray-300">
            {statusData.recommendationReason || statusData.calculation?.recommendationReason}
          </p>
          {statusData.calculation && (
            <div className="flex items-center gap-3 pt-1 text-[10px] text-gray-400 flex-wrap">
              <span>Base: <strong className="text-white">₹{statusData.calculation.basePremium}</strong></span>
              <span>Risk Adj: <strong className="text-amber-400">+₹{statusData.calculation.riskAdjustment}</strong></span>
              <span>City: <strong className="text-gray-300">{statusData.calculation.workCity || 'Local'}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 border-t border-gray-800 flex items-center gap-2">
        {policyStatus === 'ACTIVE' && isDueSoon && (
          <button
            onClick={onPayPremium}
            className="w-full py-2 px-3 rounded-lg text-xs font-bold text-black flex items-center justify-center gap-1.5 transition-transform active:scale-95"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
          >
            Pay Premium ₹{premiumAmount}
          </button>
        )}

        {policyStatus === 'EXPIRED' && (
          <button
            onClick={onRenewPolicy}
            className="w-full py-2 px-3 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-transform active:scale-95"
            style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
          >
            Renew Policy
          </button>
        )}

        {policyStatus === 'INACTIVE' && (
          <Link
            to="/policies"
            className="w-full py-2 px-3 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-transform active:scale-95"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}
          >
            Activate Policy
          </Link>
        )}

        {policyStatus === 'ACTIVE' && !isDueSoon && (
          <div className="w-full py-2 px-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium flex items-center justify-center gap-1.5">
            <CheckCircle size={14} /> Full Protection Active
          </div>
        )}
      </div>
    </div>
  );
}
