import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Shield, CheckCircle, XCircle, CreditCard, Lock, Smartphone, Wallet } from 'lucide-react';

const PLANS_META = {
  basic:    { glow: '#9CA3AF', label: 'BASIC',    gradient: 'linear-gradient(135deg,#374151,#1F2937)' },
  standard: { glow: '#3B82F6', label: 'STANDARD', gradient: 'linear-gradient(135deg,#1D4ED8,#3B82F6)' },
  premium:  { glow: '#8B5CF6', label: 'PREMIUM',  gradient: 'linear-gradient(135deg,#6D28D9,#8B5CF6)' },
};

const PAYMENT_MODES = [
  { key: 'upi',    label: 'UPI',          icon: Smartphone, desc: 'GPay, PhonePe, Paytm' },
  { key: 'card',   label: 'Debit / Card', icon: CreditCard, desc: 'Visa, Mastercard, RuPay' },
  { key: 'wallet', label: 'Wallet',       icon: Wallet,     desc: 'Paytm, Amazon Pay' },
];

export default function Policies() {
  const [plans, setPlans] = useState([]);
  const [myPolicies, setMyPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);

  const fetchData = async () => {
    const [p, m] = await Promise.all([
      api.get('/policies/plans').catch(() => ({ data: [] })),
      api.get('/policies/my').catch(() => ({ data: [] }))
    ]);
    setPlans(p.data); setMyPolicies(m.data);
  };

  useEffect(() => { fetchData(); }, []);

  const canPay = selectedPlan && paymentMethod;

  const handlePayAndSubscribe = async () => {
    if (!canPay) return;
    setLoading(true);
    try {
      const orderRes = await api.post('/payments/create-order', { planType: selectedPlan.key });
      const { orderId, amount, key, paymentId, isMock, isFree } = orderRes.data;

      if (isFree) {
        await api.post('/policies/create', { planType: selectedPlan.key });
        toast.success('Free Policy activated successfully!');
        setSelectedPlan(null); setPaymentMethod(null);
        await fetchData();
        return;
      }

      if (isMock) {
        await api.post('/payments/verify', {
          razorpayOrderId: orderId,
          razorpayPaymentId: `pay_mock_${Date.now()}`,
          razorpaySignature: 'mock_sig',
          paymentId, planType: selectedPlan.key, isMock: true
        });
        toast.success('Payment successful! Policy activated.');
        setSelectedPlan(null); setPaymentMethod(null);
        await fetchData();
        return;
      }

      const options = {
        key, amount: amount * 100, currency: 'INR',
        name: 'GigShield', description: `Weekly Premium — ${selectedPlan.key} plan`,
        order_id: orderId,
        handler: async (response) => {
          try {
            await api.post('/payments/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              paymentId, planType: selectedPlan.key, isMock: false
            });
            toast.success('Payment successful! Policy activated.');
            setSelectedPlan(null); setPaymentMethod(null);
            await fetchData();
          } catch { toast.error('Payment verification failed'); }
        },
        prefill: {}, theme: { color: '#3B82F6' }
      };
      new window.Razorpay(options).open();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Payment initiation failed');
    } finally { setLoading(false); }
  };

  const cancel = async (id) => {
    try {
      await api.put(`/policies/${id}/cancel`);
      toast.success('Policy cancelled');
      await fetchData();
    } catch { toast.error('Failed to cancel'); }
  };

  const hasActive = myPolicies.some(p => p.status === 'active');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">Insurance Plans</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Weekly subscription — select a plan and payment method to activate</p>
      </div>

      {!hasActive && plans.length > 0 && (
        <>
          {/* Step 1: Plan Selection */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: '#6B7280' }}>
              Step 1 — Select Plan
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map(plan => {
                const meta = PLANS_META[plan.key] || PLANS_META.basic;
                const isSelected = selectedPlan?.key === plan.key;
                return (
                  <div key={plan.key} onClick={() => setSelectedPlan(plan)}
                    className="card p-5 cursor-pointer transition-all"
                    style={isSelected ? {
                      borderColor: meta.glow,
                      boxShadow: `0 0 20px ${meta.glow}40`,
                      transform: 'translateY(-2px)'
                    } : { borderColor: '#1F2937' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: `${meta.glow}18`, color: meta.glow, border: `1px solid ${meta.glow}30` }}>
                        {meta.label}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: meta.glow }}>
                          <CheckCircle size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                    <h3 className="font-bold text-white">{plan.name}</h3>
                    <div className="mt-3 mb-1">
                      <span className="text-2xl font-bold text-white">₹{plan.weeklyPremium}</span>
                      <span className="text-sm font-normal ml-1" style={{ color: '#6B7280' }}>/week</span>
                    </div>
                    <p className="text-xs mb-3" style={{ color: '#6B7280' }}>Coverage up to ₹{plan.coverageAmount}</p>
                    <div className="pt-3 space-y-1.5" style={{ borderTop: '1px solid #1F2937' }}>
                      {plan.coverageTypes.map(t => (
                        <div key={t} className="flex items-center gap-2 text-xs" style={{ color: '#9CA3AF' }}>
                          <CheckCircle size={11} style={{ color: '#22C55E', flexShrink: 0 }} />
                          {t.charAt(0).toUpperCase() + t.slice(1)} disruption
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Payment Mode */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: '#6B7280' }}>
              Step 2 — Select Payment Method
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PAYMENT_MODES.map(({ key, label, icon: Icon, desc }) => {
                const isSelected = paymentMethod === key;
                return (
                  <div key={key} onClick={() => setPaymentMethod(key)}
                    className="card p-4 cursor-pointer transition-all flex items-center gap-3"
                    style={isSelected ? {
                      borderColor: '#3B82F6',
                      boxShadow: '0 0 16px rgba(59,130,246,0.3)',
                      background: 'rgba(59,130,246,0.08)'
                    } : {}}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: isSelected ? 'rgba(59,130,246,0.2)' : '#0B1220', border: `1px solid ${isSelected ? '#3B82F6' : '#1F2937'}` }}>
                      <Icon size={18} style={{ color: isSelected ? '#3B82F6' : '#6B7280' }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{desc}</p>
                    </div>
                    {isSelected && <CheckCircle size={16} style={{ color: '#3B82F6' }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation message + Pay button */}
          <div className="card p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm" style={{ color: canPay ? '#22C55E' : '#6B7280' }}>
              <Lock size={14} />
              {canPay
                ? `Ready to pay ₹${selectedPlan.weeklyPremium} via ${PAYMENT_MODES.find(m => m.key === paymentMethod)?.label}`
                : 'Please select a plan and payment method to continue'}
            </div>
            <button onClick={handlePayAndSubscribe} disabled={!canPay || loading}
              className="btn-neon flex items-center gap-2"
              style={!canPay ? { background: '#1F2937', color: '#4B5563', boxShadow: 'none', cursor: 'not-allowed' } : {}}>
              <CreditCard size={15} />
              {loading ? 'Processing...' : canPay
                ? `Pay & Activate — ₹${selectedPlan.weeklyPremium} via ${PAYMENT_MODES.find(m => m.key === paymentMethod)?.label}`
                : 'Select plan and payment method'}
            </button>
          </div>
        </>
      )}

      {/* My Policies */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">My Policies</h3>
        {myPolicies.length === 0 ? (
          <div className="card p-10 text-center">
            <Shield size={28} className="mx-auto mb-2" style={{ color: '#1F2937' }} />
            <p className="text-sm" style={{ color: '#4B5563' }}>No policies yet. Choose a plan above to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myPolicies.map(p => {
              const meta = PLANS_META[p.planName?.toLowerCase().includes('basic') ? 'basic' : p.planName?.toLowerCase().includes('premium') ? 'premium' : 'standard'];
              return (
                <div key={p._id} className="card p-4 flex items-center justify-between flex-wrap gap-3"
                  style={p.status === 'active' ? { borderColor: `${meta?.glow || '#22C55E'}40` } : {}}>
                  <div>
                    <p className="font-semibold text-white">{p.planName}</p>
                    <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>₹{p.weeklyPremium}/week · Coverage ₹{p.coverageAmount}</p>
                    <p className="text-xs mt-1" style={{ color: '#4B5563' }}>
                      {new Date(p.startDate).toLocaleDateString()} → {new Date(p.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs" style={{ color: '#4B5563' }}>Covers: {p.coverageType?.join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={p.status === 'active' ? 'badge-green' : p.status === 'expired' ? 'badge-gray' : 'badge-red'}>
                      {p.status.toUpperCase()}
                    </span>
                    {p.status === 'active' && (
                      <button onClick={() => cancel(p._id)}
                        className="flex items-center gap-1 text-xs transition"
                        style={{ color: '#EF4444' }}>
                        <XCircle size={13} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
