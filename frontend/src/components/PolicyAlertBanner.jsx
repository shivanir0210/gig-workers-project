import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Calendar, XCircle, CloudRain, ArrowRight, ShieldCheck } from 'lucide-react';

export default function PolicyAlertBanner({
  alerts = {},
  policyStatus = 'INACTIVE',
  onPayPremium,
  onRenewPolicy,
  onActivatePolicy
}) {
  const navigate = useNavigate();

  const {
    activatePolicyAlert,
    premiumDueReminder,
    policyExpiredAlert,
    activePolicyWeatherAlert
  } = alerts;

  if (!activatePolicyAlert && !premiumDueReminder && !policyExpiredAlert && !activePolicyWeatherAlert) {
    return null;
  }

  return (
    <div className="space-y-3 my-4">
      {/* 2. Activate Policy Alert */}
      {activatePolicyAlert && (
        <div
          className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%)',
            borderColor: '#F97316',
            boxShadow: '0 4px 20px rgba(249, 115, 22, 0.2)'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(249, 115, 22, 0.25)', color: '#F97316' }}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <h4 className="font-bold text-base text-orange-400 flex items-center gap-2">
                ⚠️ Weather Alert
              </h4>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 leading-relaxed">
                Heavy rainfall or severe weather is expected in your work area. You currently do not have an active GigShield policy. Activate your policy now to become eligible for claims during covered weather disruptions.
              </p>
            </div>
          </div>
          <button
            onClick={() => onActivatePolicy ? onActivatePolicy() : navigate('/policies')}
            className="px-4 py-2.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 flex-shrink-0 transition-transform active:scale-95 shadow-md"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
          >
            Activate Policy <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* 3. Monthly Premium Due Reminder */}
      {premiumDueReminder && (
        <div
          className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 179, 8, 0.15) 100%)',
            borderColor: '#F59E0B',
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.2)'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(245, 158, 11, 0.25)', color: '#F59E0B' }}>
              <Calendar size={22} />
            </div>
            <div>
              <h4 className="font-bold text-base text-amber-400 flex items-center gap-2">
                📅 Premium Due Reminder
              </h4>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 leading-relaxed">
                Your GigShield premium payment is due soon. Pay before the due date to continue uninterrupted insurance coverage.
              </p>
            </div>
          </div>
          <button
            onClick={() => onPayPremium ? onPayPremium() : navigate('/policies')}
            className="px-4 py-2.5 rounded-lg text-xs font-bold text-black flex items-center justify-center gap-1.5 flex-shrink-0 transition-transform active:scale-95 shadow-md"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
          >
            Pay Premium <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* 4. Policy Expired Alert */}
      {policyExpiredAlert && (
        <div
          className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(185, 28, 28, 0.18) 100%)',
            borderColor: '#EF4444',
            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#EF4444' }}>
              <XCircle size={22} />
            </div>
            <div>
              <h4 className="font-bold text-base text-red-400 flex items-center gap-2">
                ❌ Policy Expired
              </h4>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 leading-relaxed">
                Your insurance policy has expired. Claims cannot be submitted until you renew your policy.
              </p>
            </div>
          </div>
          <button
            onClick={() => onRenewPolicy ? onRenewPolicy() : navigate('/policies')}
            className="px-4 py-2.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 flex-shrink-0 transition-transform active:scale-95 shadow-md"
            style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
          >
            Renew Policy <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* 5. Active Policy Weather Alert */}
      {activePolicyWeatherAlert && (
        <div
          className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)',
            borderColor: '#3B82F6',
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.2)'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(59, 130, 246, 0.25)', color: '#60A5FA' }}>
              <CloudRain size={22} />
            </div>
            <div>
              <h4 className="font-bold text-base text-blue-400 flex items-center gap-2">
                🌧 Weather Risk Alert
              </h4>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 leading-relaxed">
                Heavy rainfall has been detected in your work location. Your GigShield policy is active. If your income is affected, you may be eligible to submit a claim according to your policy terms.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/claims')}
            className="px-4 py-2.5 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1.5 flex-shrink-0 transition-transform active:scale-95 shadow-md"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}
          >
            View Coverage <ShieldCheck size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
