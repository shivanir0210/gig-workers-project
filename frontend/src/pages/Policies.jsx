import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Shield, CheckCircle, XCircle, CreditCard, Lock, Smartphone, Wallet } from 'lucide-react';

const PLANS_META = {
  basic:    { glow:'#9CA3AF', label:'BASIC' },
  standard: { glow:'#3B82F6', label:'STANDARD' },
  premium:  { glow:'#8B5CF6', label:'PREMIUM' },
};
const PAYMENT_MODES = [
  { key:'upi',    label:'UPI',          icon:Smartphone, desc:'GPay, PhonePe, Paytm' },
  { key:'card',   label:'Debit / Card', icon:CreditCard, desc:'Visa, Mastercard, RuPay' },
  { key:'wallet', label:'Wallet',       icon:Wallet,     desc:'Paytm, Amazon Pay' },
];

export default function Policies() {
  const [plans, setPlans]               = useState([]);
  const [myPolicies, setMyPolicies]     = useState([]);
  const [loading, setLoading]           = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);

  const fetchData = async () => {
    const [p, m] = await Promise.all([
      api.get('/policies/plans').catch(() => ({ data:[] })),
      api.get('/policies/my').catch(() => ({ data:[] }))
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
      const { orderId, amount, key, paymentId } = orderRes.data;

      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded');
      }

      const razor = new window.Razorpay({
        key,
        amount: amount * 100,
        currency: 'INR',
        name: 'GigShield',
        description: `Weekly Premium — ${selectedPlan.key}`,
        order_id: orderId,
        handler: async (r) => {
          try {
            await api.post('/payments/verify', {
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
              paymentId,
              planType: selectedPlan.key
            });
            toast.success('Payment successful!');
            setSelectedPlan(null);
            setPaymentMethod(null);
            await fetchData();
          } catch {
            toast.error('Payment verification failed');
          }
        },
        theme: { color: '#3B82F6' }
      });

      razor.open();

    } catch (err) { toast.error(err.response?.data?.error || 'Payment failed');
    } finally { setLoading(false); }
  };

  const cancel = async (id) => {
    try { await api.put(`/policies/${id}/cancel`); toast.success('Cancelled'); await fetchData(); }
    catch { toast.error('Failed to cancel'); }
  };

  const hasActive = myPolicies.some(p => p.status === 'active');

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-white">Insurance Plans</h2>
        <p className="text-xs sm:text-sm mt-0.5" style={{ color:'#6B7280' }}>Weekly subscription — select plan and payment method</p>
      </div>

      {!hasActive && plans.length > 0 && (
        <>
          {/* Step 1: Plan */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color:'#6B7280' }}>Step 1 — Select Plan</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {plans.map(plan => {
                const meta = PLANS_META[plan.key] || PLANS_META.basic;
                const isSelected = selectedPlan?.key === plan.key;
                return (
                  <div key={plan.key} onClick={() => setSelectedPlan(plan)}
                    className="card p-4 sm:p-5 cursor-pointer transition-all active:scale-95"
                    style={isSelected ? { borderColor:meta.glow, boxShadow:`0 0 20px ${meta.glow}40`, transform:'translateY(-2px)' } : {}}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background:`${meta.glow}18`, color:meta.glow, border:`1px solid ${meta.glow}30` }}>{meta.label}</span>
                      {isSelected && <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background:meta.glow }}><CheckCircle size={11} className="text-white"/></div>}
                    </div>
                    <h3 className="font-bold text-white text-sm sm:text-base">{plan.name}</h3>
                    <div className="mt-2 mb-1">
                      <span className="text-xl sm:text-2xl font-bold text-white">₹{plan.weeklyPremium}</span>
                      <span className="text-xs sm:text-sm font-normal ml-1" style={{ color:'#6B7280' }}>/week</span>
                    </div>
                    <p className="text-xs mb-3" style={{ color:'#6B7280' }}>Coverage ₹{plan.coverageAmount}</p>
                    <div className="pt-3 space-y-1.5" style={{ borderTop:'1px solid #1F2937' }}>
                      {plan.coverageTypes.map(t => (
                        <div key={t} className="flex items-center gap-2 text-xs" style={{ color:'#9CA3AF' }}>
                          <CheckCircle size={10} style={{ color:'#22C55E', flexShrink:0 }} />
                          {t.charAt(0).toUpperCase()+t.slice(1)} disruption
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Payment */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color:'#6B7280' }}>Step 2 — Payment Method</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PAYMENT_MODES.map(({ key, label, icon:Icon, desc }) => {
                const isSelected = paymentMethod === key;
                return (
                  <div key={key} onClick={() => setPaymentMethod(key)}
                    className="card p-3 sm:p-4 cursor-pointer transition-all flex items-center gap-3 active:scale-95"
                    style={isSelected ? { borderColor:'#3B82F6', boxShadow:'0 0 16px rgba(59,130,246,0.3)', background:'rgba(59,130,246,0.08)' } : {}}>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background:isSelected?'rgba(59,130,246,0.2)':'#0B1220', border:`1px solid ${isSelected?'#3B82F6':'#1F2937'}` }}>
                      <Icon size={16} style={{ color:isSelected?'#3B82F6':'#6B7280' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-xs truncate" style={{ color:'#6B7280' }}>{desc}</p>
                    </div>
                    {isSelected && <CheckCircle size={15} style={{ color:'#3B82F6', flexShrink:0 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pay button */}
          <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm" style={{ color:canPay?'#22C55E':'#6B7280' }}>
              <Lock size={13} />
              {canPay ? `Ready — ₹${selectedPlan.weeklyPremium} via ${PAYMENT_MODES.find(m=>m.key===paymentMethod)?.label}` : 'Select a plan and payment method'}
            </div>
            <button onClick={handlePayAndSubscribe} disabled={!canPay||loading}
              className="btn-neon flex items-center gap-2 w-full sm:w-auto justify-center"
              style={!canPay ? { background:'#1F2937', color:'#4B5563', boxShadow:'none', cursor:'not-allowed', minHeight:'44px' } : { minHeight:'44px' }}>
              <CreditCard size={14} />
              {loading ? 'Processing...' : canPay ? `Pay ₹${selectedPlan.weeklyPremium}` : 'Select plan & method'}
            </button>
          </div>
        </>
      )}

      {/* My Policies */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">My Policies</h3>
        {myPolicies.length === 0 ? (
          <div className="card p-8 sm:p-10 text-center">
            <Shield size={24} className="mx-auto mb-2" style={{ color:'#1F2937' }} />
            <p className="text-sm" style={{ color:'#4B5563' }}>No policies yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myPolicies.map(p => {
              const meta = PLANS_META[p.planName?.toLowerCase().includes('basic')?'basic':p.planName?.toLowerCase().includes('premium')?'premium':'standard'];
              return (
                <div key={p._id} className="card p-4 flex items-start justify-between flex-wrap gap-3"
                  style={p.status==='active'?{borderColor:`${meta?.glow||'#22C55E'}40`}:{}}>
                  <div>
                    <p className="font-semibold text-white text-sm sm:text-base">{p.planName}</p>
                    <p className="text-xs sm:text-sm mt-0.5" style={{ color:'#9CA3AF' }}>₹{p.weeklyPremium}/week · Coverage ₹{p.coverageAmount}</p>
                    <p className="text-xs mt-1" style={{ color:'#4B5563' }}>
                      {new Date(p.startDate).toLocaleDateString()} → {new Date(p.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs" style={{ color:'#4B5563' }}>Covers: {p.coverageType?.join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={p.status==='active'?'badge-green':p.status==='expired'?'badge-gray':'badge-red'}>
                      {p.status.toUpperCase()}
                    </span>
                    {p.status==='active'&&(
                      <button onClick={()=>cancel(p._id)} className="flex items-center gap-1 text-xs" style={{ color:'#EF4444', minHeight:'36px', padding:'4px 8px' }}>
                        <XCircle size={12} /> Cancel
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
