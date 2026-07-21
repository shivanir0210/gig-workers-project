import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX, Calendar, DollarSign, Clock,
  FileText, Download, CheckCircle, AlertCircle, XCircle, RefreshCw, CreditCard,
  Layers, Activity, X, ChevronRight, Plus, Eye, Award, AlertTriangle, UserCheck
} from 'lucide-react';

const PLANS_META = {
  basic:    { label:'BASIC',    glow:'#3B82F6', desc:'Rainfall & AQI protection for gig workers' },
  standard: { label:'STANDARD', glow:'#8B5CF6', desc:'All-weather + temperature loss shield' },
  premium:  { label:'PREMIUM',  glow:'#F59E0B', desc:'Complete parametric protection + curfew cover' },
};

const RISK_BADGES = {
  Rainfall:    { bg: 'rgba(59, 130, 246, 0.15)', text: '#60A5FA', border: 'rgba(59, 130, 246, 0.3)' },
  AQI:         { bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)' },
  Temperature: { bg: 'rgba(239, 68, 68, 0.15)',  text: '#F87171', border: 'rgba(239, 68, 68, 0.3)' },
  Curfew:      { bg: 'rgba(139, 92, 246, 0.15)', text: '#C084FC', border: 'rgba(139, 92, 246, 0.3)' },
  Flood:       { bg: 'rgba(6, 182, 212, 0.15)',  text: '#22D3EE', border: 'rgba(6, 182, 212, 0.3)' },
  Cyclone:     { bg: 'rgba(236, 72, 153, 0.15)', text: '#F472B6', border: 'rgba(236, 72, 153, 0.3)' }
};

export default function Policies() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: { activeCount: 0, upcomingCount: 0, expiredCount: 0, cancelledCount: 0, totalCoverage: 0, pendingPremiums: 0, totalClaims: 0 },
    categorized: { active: [], upcoming: [], expired: [], cancelled: [] },
    policies: []
  });
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [actionLoading, setActionLoading] = useState(false);
  const [showBuyWizard, setShowBuyWizard] = useState(false);

  // Policy Details Modal State
  const [detailModalPolicy, setDetailModalPolicy] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [claimsData, setClaimsData] = useState(null);

  const fetchPoliciesData = async () => {
    try {
      console.log('[Frontend Policies] Fetching GET /api/policies...');
      const [res, plansRes] = await Promise.all([
        api.get('/policies'),
        api.get('/policies/plans').catch(() => ({ data: [] }))
      ]);

      console.log('[Frontend Policies] Response received:', res.data);

      if (res.data && res.data.categorized) {
        setData(res.data);
      } else if (Array.isArray(res.data)) {
        const policiesArr = res.data;
        const active = policiesArr.filter(p => (p.policyStatus || p.status || '').toUpperCase() === 'ACTIVE');
        const upcoming = policiesArr.filter(p => (p.policyStatus || p.status || '').toUpperCase() === 'UPCOMING');
        const expired = policiesArr.filter(p => (p.policyStatus || p.status || '').toUpperCase() === 'EXPIRED');
        const cancelled = policiesArr.filter(p => (p.policyStatus || p.status || '').toUpperCase() === 'CANCELLED');

        setData({
          summary: {
            activeCount: active.length,
            upcomingCount: upcoming.length,
            expiredCount: expired.length,
            cancelledCount: cancelled.length,
            totalCoverage: [...active, ...upcoming].reduce((sum, p) => sum + (p.coverageAmount || p.coverage || 0), 0),
            pendingPremiums: 0,
            totalClaims: 0
          },
          categorized: { active, upcoming, expired, cancelled },
          policies: policiesArr
        });
      }

      setPlans(plansRes.data || []);
    } catch (err) {
      console.error('[Frontend Policies Error]:', err);
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantActivatePolicy = async (planKey = 'premium') => {
    setActionLoading(true);
    try {
      const res = await api.post('/policy/activate', { planType: planKey, paymentFrequency: 'Weekly' });
      toast.success(res.data.message || 'Policy activated successfully!');
      fetchPoliciesData();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Activation failed');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchPoliciesData();
  }, []);

  const openDetailsModal = async (policyId) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/policies/${policyId}`);
      setDetailModalPolicy(res.data.policy);
      setClaimsData(res.data.claimsSummary);
    } catch {
      toast.error('Failed to load policy details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePayPremiumDirect = async (policyId) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/policies/${policyId}/pay`, { paymentMethod: 'UPI' });
      toast.success(res.data.message || 'Premium paid successfully!');
      fetchPoliciesData();
      if (detailModalPolicy && detailModalPolicy._id === policyId) {
        openDetailsModal(policyId);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Payment failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPolicy = async (policyId) => {
    if (!window.confirm('Are you sure you want to cancel this policy?')) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/policies/${policyId}/cancel`, { reason: 'Cancelled by customer' });
      toast.success(res.data.message || 'Policy cancelled');
      fetchPoliciesData();
      if (detailModalPolicy && detailModalPolicy._id === policyId) {
        setDetailModalPolicy(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cancellation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenewPolicy = async (policyId) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/policies/${policyId}/renew`);
      toast.success(res.data.message || 'Policy renewed successfully!');
      fetchPoliciesData();
      if (detailModalPolicy && detailModalPolicy._id === policyId) {
        openDetailsModal(policyId);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Renewal failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayAndSubscribe = async () => {
    if (!selectedPlan || !paymentMethod) return;
    setActionLoading(true);
    try {
      const orderRes = await api.post('/payments/create-order', { planType: selectedPlan.key });
      const { orderId, amount, key, paymentId } = orderRes.data;

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }

      const razor = new window.Razorpay({
        key,
        amount: amount * 100,
        currency: 'INR',
        name: 'GigShield',
        description: `Premium Payment — ${selectedPlan.name || selectedPlan.key}`,
        order_id: orderId,
        handler: async (r) => {
          try {
            const verifyRes = await api.post('/payments/verify', {
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
              paymentId,
              planType: selectedPlan.key,
              amount
            });

            toast.success(verifyRes.data.message || 'Policy activated & premium verified!');
            setSelectedPlan(null);
            setShowBuyWizard(false);
            fetchPoliciesData();
          } catch (verifyErr) {
            toast.error(verifyErr.response?.data?.message || 'Verification failed');
          }
        },
        theme: { color: '#3B82F6' }
      });

      razor.open();
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Payment failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 bg-gray-800 rounded w-1/4"></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-900 rounded-xl border border-gray-800"></div>)}
        </div>
        <div className="h-64 bg-gray-900 rounded-xl border border-gray-800"></div>
      </div>
    );
  }

  const { summary, categorized } = data;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Shield className="text-blue-500" size={24} /> Insurance Policies Portal
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Manage your parametric policies, track premium due dates, and view policy details
          </p>
        </div>
        <button
          onClick={() => setShowBuyWizard(!showBuyWizard)}
          className="btn-neon flex items-center justify-center gap-2 text-xs sm:text-sm self-start sm:self-auto py-2.5 px-4"
        >
          <Plus size={16} /> {showBuyWizard ? 'Close Plans Catalog' : 'Subscribe New Policy'}
        </button>
      </div>

      {/* Top Dashboard Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { label: 'Active Policies', value: summary.activeCount, color: '#22C55E', icon: ShieldCheck },
          { label: 'Upcoming', value: summary.upcomingCount, color: '#3B82F6', icon: Clock },
          { label: 'Expired', value: summary.expiredCount, color: '#EF4444', icon: AlertCircle },
          { label: 'Cancelled', value: summary.cancelledCount, color: '#6B7280', icon: ShieldX },
          { label: 'Total Coverage', value: `₹${summary.totalCoverage.toLocaleString('en-IN')}`, color: '#10B981', icon: DollarSign, isWide: true },
          { label: 'Pending Premiums', value: summary.pendingPremiums, color: '#F59E0B', icon: AlertTriangle },
          { label: 'Total Claims', value: summary.totalClaims, color: '#8B5CF6', icon: Activity }
        ].map((item, idx) => (
          <div
            key={idx}
            className={`card p-3 sm:p-4 border border-gray-800/80 bg-gradient-to-br from-gray-900/90 to-gray-950 flex flex-col justify-between ${item.isWide ? 'col-span-2 lg:col-span-1' : ''}`}
          >
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider">{item.label}</span>
              <item.icon size={14} style={{ color: item.color }} />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: item.color }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Subscribe / New Policy Catalog Wizard */}
      {showBuyWizard && (
        <div className="card p-5 border border-blue-500/30 bg-gradient-to-b from-blue-950/20 to-gray-950 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="text-amber-400" size={18} /> Select an Insurance Plan
              </h3>
              <p className="text-xs text-gray-400">Personalized parametric premium based on your weekly income & risk profile</p>
            </div>
            <button onClick={() => setShowBuyWizard(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const meta = PLANS_META[plan.key] || PLANS_META.basic;
              const isSelected = selectedPlan?.key === plan.key;
              return (
                <div
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan)}
                  className={`card p-4 cursor-pointer transition-all duration-200 border ${isSelected ? 'border-blue-500 bg-blue-950/30 shadow-lg shadow-blue-500/10' : 'border-gray-800 bg-gray-900/60 hover:border-gray-700'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold"
                      style={{ background: `${meta.glow}20`, color: meta.glow, border: `1px solid ${meta.glow}40` }}
                    >
                      {meta.label}
                    </span>
                    {isSelected && <CheckCircle size={16} className="text-blue-400" />}
                  </div>
                  <h4 className="font-bold text-white text-base">{plan.name}</h4>
                  <p className="text-xs text-gray-400 mt-1 mb-3">{meta.desc}</p>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-2xl font-black text-white">₹{plan.premiumAmount || plan.weeklyPremium}</span>
                    <span className="text-xs text-gray-400">/week</span>
                  </div>
                  <p className="text-xs text-green-400 font-semibold mb-3">Coverage: ₹{(plan.coverageAmount || 0).toLocaleString('en-IN')}</p>

                  {plan.calculation && (
                    <div className="p-2 rounded bg-gray-950/80 border border-gray-800 text-[11px] space-y-1 mb-3">
                      <div className="flex justify-between text-gray-400">
                        <span>Base Premium:</span>
                        <span className="text-white font-semibold">₹{plan.calculation.basePremium}</span>
                      </div>
                      <div className="flex justify-between text-gray-400">
                        <span>Weather Risk ({plan.calculation.weatherRisk}):</span>
                        <span className="text-amber-400 font-semibold">+₹{plan.calculation.riskAdjustment}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 border-t border-gray-800 pt-2 text-xs text-gray-300">
                    {(plan.coverageTypes || []).map((type) => (
                      <div key={type} className="flex items-center gap-1.5 capitalize">
                        <CheckCircle size={12} className="text-green-400" /> {type} disruption
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedPlan && (
            <div className="pt-3 border-t border-gray-800 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-medium">Payment Method:</span>
                {['UPI', 'CARD', 'WALLET'].map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${paymentMethod === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button
                onClick={handlePayAndSubscribe}
                disabled={actionLoading}
                className="btn-neon py-2 px-5 text-xs font-bold flex items-center gap-2"
              >
                {actionLoading ? 'Processing...' : `Pay ₹${selectedPlan.premiumAmount || selectedPlan.weeklyPremium} & Activate Policy`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION 1: Active Policies */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
            Active Policies ({categorized.active.length})
          </h3>
        </div>

        {categorized.active.length === 0 ? (
          <div className="card p-8 text-center border border-gray-800 bg-gray-900/30 space-y-3">
            <ShieldAlert size={36} className="mx-auto text-gray-500" />
            <div>
              <p className="text-base font-bold text-gray-200">No active insurance policy found</p>
              <p className="text-xs text-gray-400 mt-1">Subscribe to a policy or activate instant parametric protection for your account.</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button onClick={() => handleInstantActivatePolicy('premium')} disabled={actionLoading} className="btn-neon text-xs py-2 px-4">
                {actionLoading ? 'Activating...' : '⚡ Activate Instant Shield Policy'}
              </button>
              <button onClick={() => setShowBuyWizard(true)} className="btn-outline text-xs py-2 px-4">
                Explore All Plans
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorized.active.map(policy => {
              const isDue = !policy.nextDueDate || new Date() >= new Date(policy.nextDueDate);
              const formattedNextDue = policy.nextDueDate
                ? new Date(policy.nextDueDate).toLocaleDateString('en-GB')
                : '';

              return (
                <div
                  key={policy._id}
                  className="card p-5 border border-green-500/30 bg-gradient-to-br from-gray-900 to-gray-950 flex flex-col justify-between space-y-4 shadow-xl hover:border-green-500/50 transition-all"
                >
                  {/* Policy Card Header */}
                  <div className="flex items-start justify-between border-b border-gray-800 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                        Policy No: {policy.policyNumber || `GS-2026-${policy._id.substring(0, 6)}`}
                      </span>
                      <h4 className="text-base font-extrabold text-white">{policy.planName}</h4>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> ACTIVE
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2 rounded bg-gray-950/80 border border-gray-800/80">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Coverage</span>
                      <span className="font-bold text-green-400">₹{(policy.coverageAmount || policy.coverage || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="p-2 rounded bg-gray-950/80 border border-gray-800/80">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Premium</span>
                      <span className="font-bold text-white">₹{policy.premiumAmount || policy.weeklyPremium}/{policy.paymentFrequency === 'Monthly' ? 'mo' : 'wk'}</span>
                    </div>
                    <div className="p-2 rounded bg-gray-950/80 border border-gray-800/80">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Next Due</span>
                      <span className="font-bold text-amber-400">
                        {policy.nextDueDate ? new Date(policy.nextDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-gray-950/80 border border-gray-800/80">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Start Date</span>
                      <span className="font-bold text-gray-300">{new Date(policy.policyStartDate || policy.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    </div>
                    <div className="p-2 rounded bg-gray-950/80 border border-gray-800/80">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Renewal</span>
                      <span className="font-bold text-gray-300">{new Date(policy.policyEndDate || policy.endDate || policy.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                    </div>
                    <div className="p-2 rounded bg-gray-950/80 border border-gray-800/80">
                      <span className="text-[10px] text-gray-500 uppercase font-semibold block">Paid / Pending</span>
                      <span className="font-bold text-white">{policy.paidInstallments || 1} / {policy.pendingInstallments || 51}</span>
                    </div>
                  </div>

                  {/* Covered Risks Chips */}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Covered Risks:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(policy.coveredRisks || ['Rainfall', 'AQI', 'Temperature', 'Curfew', 'Flood', 'Cyclone']).slice(0, 5).map(risk => {
                        const badge = RISK_BADGES[risk] || { bg: 'rgba(59,130,246,0.15)', text: '#60A5FA', border: 'rgba(59,130,246,0.3)' };
                        return (
                          <span key={risk} className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
                            ✓ {risk}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Banner when premium is already paid */}
                  {!isDue && (
                    <div className="p-2 rounded-lg bg-blue-950/40 border border-blue-500/20 text-center">
                      <p className="text-xs font-semibold text-blue-300">
                        Premium already paid. Next premium is due on {formattedNextDue}.
                      </p>
                    </div>
                  )}

                  {/* Card Action Buttons */}
                  <div className="pt-2 border-t border-gray-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => openDetailsModal(policy._id)}
                      className="py-2 px-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Eye size={12} /> View Details
                    </button>

                    <button
                      onClick={() => isDue && handlePayPremiumDirect(policy._id)}
                      disabled={!isDue || actionLoading}
                      title={!isDue ? `Premium already paid. Next premium is due on ${formattedNextDue}.` : 'Pay Premium'}
                      className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                        isDue
                          ? 'bg-amber-500 hover:bg-amber-600 text-black'
                          : 'bg-gray-800/80 text-gray-500 border border-gray-800 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <DollarSign size={12} /> Pay Premium
                    </button>
                  <a
                    href={`/api/policies/${policy._id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Download size={12} /> Download
                  </a>
                  <button
                    onClick={() => handleCancelPolicy(policy._id)}
                    disabled={actionLoading}
                    className="py-2 px-2 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-400 text-xs font-bold flex items-center justify-center gap-1 border border-red-800/40"
                  >
                    <XCircle size={12} /> Cancel
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* SECTION 2: Upcoming Policies */}
      {categorized.upcoming.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="text-blue-400" size={18} /> Upcoming Policies ({categorized.upcoming.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorized.upcoming.map(policy => (
              <div key={policy._id} className="card p-4 border border-blue-500/30 bg-gray-900/60 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white">{policy.planName}</h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    UPCOMING
                  </span>
                </div>
                <div className="text-xs text-gray-300 space-y-1">
                  <p>Policy No: <strong className="text-white">{policy.policyNumber}</strong></p>
                  <p>Starts On: <strong className="text-blue-400">{new Date(policy.policyStartDate || policy.startDate).toLocaleDateString('en-GB')}</strong></p>
                  <p>Coverage: <strong className="text-green-400">₹{(policy.coverageAmount || 0).toLocaleString('en-IN')}</strong></p>
                </div>
                <button
                  onClick={() => openDetailsModal(policy._id)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg"
                >
                  Activate on Start Date
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: Expired Policies */}
      {categorized.expired.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <AlertCircle className="text-red-400" size={18} /> Expired Policies ({categorized.expired.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorized.expired.map(policy => (
              <div key={policy._id} className="card p-4 border border-red-500/30 bg-gray-900/60 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 block">{policy.policyNumber}</span>
                    <h4 className="font-bold text-white">{policy.planName}</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/30">
                    EXPIRED
                  </span>
                </div>
                <div className="text-xs text-gray-300 space-y-1">
                  <p>Expired On: <strong className="text-red-400">{new Date(policy.policyEndDate || policy.endDate || policy.expiryDate).toLocaleDateString('en-GB')}</strong></p>
                  <p>Coverage: <strong className="text-gray-400">₹{(policy.coverageAmount || 0).toLocaleString('en-IN')}</strong></p>
                </div>
                <button
                  onClick={() => handleRenewPolicy(policy._id)}
                  disabled={actionLoading}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1"
                >
                  <RefreshCw size={12} /> Renew Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: Cancelled Policies */}
      {categorized.cancelled.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldX className="text-gray-400" size={18} /> Cancelled Policies ({categorized.cancelled.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categorized.cancelled.map(policy => (
              <div key={policy._id} className="card p-4 border border-gray-800 bg-gray-950/60 opacity-80 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-500 block">{policy.policyNumber}</span>
                    <h4 className="font-bold text-gray-300">{policy.planName}</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gray-800 text-gray-400 border border-gray-700">
                    CANCELLED
                  </span>
                </div>
                <div className="text-xs text-gray-400 space-y-0.5">
                  <p>Cancelled On: <strong>{new Date(policy.cancelledDate || policy.updatedAt).toLocaleDateString('en-GB')}</strong></p>
                  {policy.cancelledReason && <p>Reason: <em className="text-gray-500">{policy.cancelledReason}</em></p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETAILED POLICY MODAL */}
      {detailModalPolicy && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="card max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 border border-blue-500/30 bg-gray-950 text-white space-y-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">Policy Details</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-green-500/20 text-green-400 border border-green-500/30 uppercase">
                    {detailModalPolicy.policyStatus || detailModalPolicy.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Policy Number: <strong className="text-blue-400">{detailModalPolicy.policyNumber}</strong></p>
              </div>
              <button
                onClick={() => setDetailModalPolicy(null)}
                className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Complete Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Policy Number', val: detailModalPolicy.policyNumber },
                { label: 'Plan Name', val: detailModalPolicy.planName },
                { label: 'Policy Holder', val: user?.name || 'Gig Worker' },
                { label: 'Status', val: detailModalPolicy.policyStatus || detailModalPolicy.status },
                { label: 'Coverage Amount', val: `₹${(detailModalPolicy.coverageAmount || 0).toLocaleString('en-IN')}` },
                { label: 'Premium Amount', val: `₹${detailModalPolicy.premiumAmount || detailModalPolicy.weeklyPremium} / ${detailModalPolicy.paymentFrequency}` },
                { label: 'Start Date', val: new Date(detailModalPolicy.policyStartDate || detailModalPolicy.startDate).toLocaleDateString('en-GB') },
                { label: 'Expiry Date', val: new Date(detailModalPolicy.policyEndDate || detailModalPolicy.endDate || detailModalPolicy.expiryDate).toLocaleDateString('en-GB') },
                { label: 'Renewal Date', val: new Date(detailModalPolicy.renewalDate || detailModalPolicy.expiryDate).toLocaleDateString('en-GB') },
                { label: 'Next Due Date', val: detailModalPolicy.nextDueDate ? new Date(detailModalPolicy.nextDueDate).toLocaleDateString('en-GB') : 'N/A' },
                { label: 'Premiums Paid', val: detailModalPolicy.paidInstallments || 1 },
                { label: 'Pending Premiums', val: detailModalPolicy.pendingInstallments || 51 },
                { label: 'Missed Payments', val: detailModalPolicy.missedInstallments || 0 },
                { label: 'Total Premium Paid', val: `₹${((detailModalPolicy.paidInstallments || 1) * (detailModalPolicy.premiumAmount || 149)).toLocaleString('en-IN')}` }
              ].map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-gray-900/80 border border-gray-800">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block">{item.label}</span>
                  <span className="text-xs font-bold text-white truncate block mt-0.5">{item.val}</span>
                </div>
              ))}
            </div>

            {/* Covered Risks */}
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
              <span className="text-xs uppercase font-extrabold text-gray-400 block">Covered Disruption Events</span>
              <div className="flex items-center gap-2 flex-wrap">
                {(detailModalPolicy.coveredRisks || ['Rainfall', 'AQI', 'Temperature', 'Curfew', 'Flood', 'Cyclone']).map(risk => (
                  <span key={risk} className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-950/80 text-blue-300 border border-blue-500/30">
                    ✓ {risk}
                  </span>
                ))}
              </div>
            </div>

            {/* Vertical Policy Timeline */}
            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 space-y-3">
              <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Policy Lifecycle Timeline</h4>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 relative">
                {[
                  { title: 'Purchased', date: new Date(detailModalPolicy.policyStartDate || detailModalPolicy.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), ok: true },
                  { title: 'First Premium Paid', date: new Date(detailModalPolicy.policyStartDate || detailModalPolicy.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), ok: true },
                  { title: 'Next Premium Due', date: detailModalPolicy.nextDueDate ? new Date(detailModalPolicy.nextDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A', ok: false },
                  { title: 'Renewal Date', date: new Date(detailModalPolicy.policyEndDate || detailModalPolicy.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), ok: false }
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 sm:flex-col sm:items-center text-left sm:text-center flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step.ok ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                      {step.ok ? '✓' : '○'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{step.title}</p>
                      <p className="text-[10px] text-gray-400">{step.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Claims Summary */}
            {claimsData && (
              <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div><span className="text-[10px] text-gray-500 uppercase block">Claims Filed</span><strong className="text-white text-base">{claimsData.total}</strong></div>
                <div><span className="text-[10px] text-gray-500 uppercase block">Approved</span><strong className="text-green-400 text-base">{claimsData.approved}</strong></div>
                <div><span className="text-[10px] text-gray-500 uppercase block">Pending</span><strong className="text-amber-400 text-base">{claimsData.pending}</strong></div>
                <div><span className="text-[10px] text-gray-500 uppercase block">Rejected</span><strong className="text-red-400 text-base">{claimsData.rejected}</strong></div>
                <div><span className="text-[10px] text-gray-500 uppercase block">Total Payout</span><strong className="text-green-400 text-base">₹{claimsData.totalClaimAmount.toLocaleString('en-IN')}</strong></div>
              </div>
            )}

            {/* Payment History Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">Premium Payment History</h4>
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-900 text-gray-400 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="p-2.5">Invoice No</th>
                      <th className="p-2.5">Payment Date</th>
                      <th className="p-2.5">Amount</th>
                      <th className="p-2.5">Method</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(detailModalPolicy.paymentHistory || []).map((pay, i) => (
                      <tr key={i} className="hover:bg-gray-900/50">
                        <td className="p-2.5 font-mono text-gray-300">{pay.invoiceNo || `INV-00${i+1}`}</td>
                        <td className="p-2.5 text-gray-300">{new Date(pay.paymentDate).toLocaleDateString('en-GB')}</td>
                        <td className="p-2.5 font-bold text-white">₹{pay.amount}</td>
                        <td className="p-2.5 text-gray-400">{pay.method}</td>
                        <td className="p-2.5 font-bold text-green-400">{pay.status}</td>
                        <td className="p-2.5 text-right">
                          <a
                            href={`/api/policies/${detailModalPolicy._id}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-bold text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            <Download size={10} /> Download
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-gray-800 flex items-center justify-end gap-3 flex-wrap">
              <button
                onClick={() => handlePayPremiumDirect(detailModalPolicy._id)}
                disabled={actionLoading}
                className="py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold flex items-center gap-1.5"
              >
                <DollarSign size={14} /> Pay Premium ₹{detailModalPolicy.premiumAmount || detailModalPolicy.weeklyPremium}
              </button>
              <a
                href={`/api/policies/${detailModalPolicy._id}/download`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Download size={14} /> Download Policy PDF
              </a>
              <button
                onClick={() => handleCancelPolicy(detailModalPolicy._id)}
                disabled={actionLoading}
                className="py-2.5 px-4 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-800/40 text-xs font-bold flex items-center gap-1.5"
              >
                <XCircle size={14} /> Cancel Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
