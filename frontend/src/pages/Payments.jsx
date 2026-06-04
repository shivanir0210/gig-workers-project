import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { CreditCard, CheckCircle, XCircle, Edit2, MapPin, CloudRain, Wind, Smartphone, Wallet, ArrowRight } from 'lucide-react';

const STATUS_BADGE = { success:'badge-green', created:'badge-gray', failed:'badge-red', refunded:'badge-yellow' };
const PAYMENT_MODES = [
  { key:'upi',    label:'UPI',    icon:Smartphone },
  { key:'card',   label:'Card',   icon:CreditCard },
  { key:'wallet', label:'Wallet', icon:Wallet },
];

export default function Payments() {
  const { user, setUser } = useAuth();
  const [payments,      setPayments]      = useState([]);
  const [payouts,       setPayouts]       = useState([]);
  const [stats,         setStats]         = useState(null);
  const [tab,           setTab]           = useState('premiums');
  const [loading,       setLoading]       = useState(true);
  const [upiForm,       setUpiForm]       = useState({ upiId:'', show:false });
  const [saving,        setSaving]        = useState(false);
  const [verifyStep,    setVerifyStep]    = useState(null);
  const [verifyData,    setVerifyData]    = useState(null);
  const [payoutForm,    setPayoutForm]    = useState({ name:'', upiId:'', mode:'' });
  const [payoutLoading, setPayoutLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/payments/history').catch(() => ({ data:[] })),
      api.get('/claims/payouts').catch(()  => ({ data:[] })),
      api.get('/payments/stats').catch(()  => ({ data:null }))
    ]).then(([p, po, s]) => { setPayments(p.data); setPayouts(po.data); setStats(s.data); setLoading(false); });
  }, []);

  const saveUpi = async () => {
    setSaving(true);
    try {
      await api.put('/users/payment-details', { upiId:upiForm.upiId });
      setUser(prev => ({ ...prev, upiId:upiForm.upiId }));
      toast.success('UPI ID saved');
      setUpiForm({ upiId:'', show:false });
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const startVerification = async () => {
    setVerifyStep('verifying');
    try {
      const gps = await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), 5000);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            p => { clearTimeout(t); resolve({ lat:p.coords.latitude, lng:p.coords.longitude }); },
            e => { clearTimeout(t); reject(e); },
            { maximumAge:10000, timeout:5000 }
          );
        } else { clearTimeout(t); reject(new Error('unavailable')); }
      }).catch(() => ({ lat:user?.location?.lat||19.076, lng:user?.location?.lng||72.877, fallback:true }));

      let weather = await api.get(`/risk/zone?lat=${gps.lat}&lng=${gps.lng}`).then(r => r.data).catch(() => null);
      if (!weather) weather = { weather:{ rainfall:0, temperature:30 }, aqi:50 };

      const rainfall = weather?.weather?.rainfall||0;
      const aqi      = weather?.aqi||0;
      const temp     = weather?.weather?.temperature||0;
      const riskDetected = rainfall > 50 || aqi > 200 || temp > 42;

      setVerifyData({ gps, rainfall, aqi, temp, riskDetected, timestamp:new Date().toISOString() });
      setVerifyStep(riskDetected ? 'verified' : 'failed');
      if (riskDetected) {
        toast.success('✅ Risk verified — eligible for payout');
        if (!gps.fallback) api.post('/users/update-gps', { lat:gps.lat, lng:gps.lng }).catch(() => {});
      } else { toast.error('❌ No active risk at your location'); }
    } catch { setVerifyStep('failed'); toast.error('Verification failed'); }
  };

  const submitPayout = async () => {
    if (!payoutForm.name || !payoutForm.upiId || !payoutForm.mode) return toast.error('Fill all fields');
    if (!/^[\w.\-_]{3,}@[a-zA-Z]{3,}$/.test(payoutForm.upiId)) return toast.error('Invalid UPI (e.g. name@bank)');
    setPayoutLoading(true);
    try {
      await api.post('/payout/save', { fullName:payoutForm.name, upiId:payoutForm.upiId, paymentMode:payoutForm.mode.toUpperCase() });
      toast.success('Payout details saved!');
      setVerifyStep(null); setVerifyData(null); setPayoutForm({ name:'', upiId:'', mode:'' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed');
    } finally { setPayoutLoading(false); }
  };

  if (loading) return <div className="p-4 text-sm" style={{ color:'#4B5563' }}>Loading...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-base sm:text-lg font-bold text-white">Payments & Payouts</h2>
        <p className="text-xs sm:text-sm mt-0.5" style={{ color:'#6B7280' }}>Premium transactions and claim disbursements</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label:'Total Premiums', value:`₹${stats.totalPremiumsPaid}`, glow:'#3B82F6' },
            { label:'Successful',     value:stats.successCount,            glow:'#22C55E' },
            { label:'Failed',         value:stats.failedCount,             glow:'#EF4444' },
            { label:'Success Rate',   value:`${stats.successRate}%`,       glow:'#8B5CF6' },
          ].map(({ label, value, glow }) => (
            <div key={label} className="stat-card">
              <p className="text-xs font-medium mb-1" style={{ color:'#6B7280' }}>{label}</p>
              <p className="text-lg sm:text-xl font-bold" style={{ color:glow }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Step 1: Verification */}
      <div className="card p-4 sm:p-5 space-y-3 sm:space-y-4" style={{ borderColor:'rgba(59,130,246,0.2)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background:'linear-gradient(135deg,#22C55E,#3B82F6)', color:'#fff' }}>1</div>
          <h3 className="text-sm font-semibold text-white">Claim Verification</h3>
          <span className="text-xs ml-auto" style={{ color:'#4B5563' }}>GPS + Weather</span>
        </div>

        {!verifyStep && (
          <div>
            <p className="text-xs mb-3" style={{ color:'#6B7280' }}>Verify location and weather to check payout eligibility.</p>
            <button onClick={startVerification} className="btn-neon flex items-center gap-2" style={{ minHeight:'44px' }}>
              <MapPin size={14}/> Start Verification
            </button>
          </div>
        )}
        {verifyStep === 'verifying' && (
          <div className="flex items-center gap-3 text-sm" style={{ color:'#9CA3AF' }}>
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
            Fetching GPS and weather...
          </div>
        )}
        {verifyData && verifyStep !== 'verifying' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label:'GPS',      value:verifyData.gps?.fallback?'Registered':'Live', ok:true },
                { label:'Rainfall', value:`${verifyData.rainfall}mm`,                  ok:verifyData.rainfall>50 },
                { label:'AQI',      value:verifyData.aqi,                               ok:verifyData.aqi>200 },
                { label:'Temp',     value:`${verifyData.temp}°C`,                       ok:verifyData.temp>42 },
              ].map(({ label, value, ok }) => (
                <div key={label} className="rounded-xl p-2.5 sm:p-3 text-center"
                  style={{ background:ok?'rgba(239,68,68,0.1)':'#0B1220', border:`1px solid ${ok?'rgba(239,68,68,0.3)':'#1F2937'}` }}>
                  <p className="text-xs mb-1" style={{ color:'#6B7280' }}>{label}</p>
                  <p className="font-bold text-sm" style={{ color:ok?'#EF4444':'#E5E7EB' }}>{value}</p>
                </div>
              ))}
            </div>
            <div className="px-3 sm:px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 flex-wrap"
              style={{ background:verifyStep==='verified'?'rgba(34,197,94,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${verifyStep==='verified'?'rgba(34,197,94,0.3)':'rgba(239,68,68,0.3)'}`, color:verifyStep==='verified'?'#22C55E':'#EF4444' }}>
              {verifyStep==='verified' ? '✅ Risk verified — eligible for payout' : '❌ No risk detected — cannot proceed'}
            </div>
            <button onClick={() => { setVerifyStep(null); setVerifyData(null); }}
              className="text-xs" style={{ color:'#4B5563', minHeight:'32px' }}>↺ Re-verify</button>
          </div>
        )}
      </div>

      {/* Step 2: Payout Setup */}
      {verifyStep === 'verified' && (
        <div className="card p-4 sm:p-5 space-y-3 sm:space-y-4" style={{ borderColor:'rgba(34,197,94,0.3)' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background:'linear-gradient(135deg,#22C55E,#3B82F6)', color:'#fff' }}>2</div>
            <h3 className="text-sm font-semibold text-white">Payout Setup</h3>
            <span className="badge-green ml-auto">ELIGIBLE</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:'#6B7280' }}>Full Name</label>
              <input value={payoutForm.name} onChange={e => setPayoutForm(f=>({...f,name:e.target.value}))}
                placeholder="Your full name" className="input-dark w-full" style={{ fontSize:'16px' }}/>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color:'#6B7280' }}>UPI ID</label>
              <input value={payoutForm.upiId} onChange={e => setPayoutForm(f=>({...f,upiId:e.target.value}))}
                placeholder="yourname@bank" className="input-dark w-full" style={{ fontSize:'16px' }}/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color:'#6B7280' }}>Payment Mode</label>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_MODES.map(({ key, label, icon:Icon }) => (
                <button key={key} onClick={() => setPayoutForm(f=>({...f,mode:key}))}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-1 sm:flex-none justify-center sm:justify-start"
                  style={{ minHeight:'44px', background:payoutForm.mode===key?'rgba(34,197,94,0.15)':'#0B1220', border:`1px solid ${payoutForm.mode===key?'rgba(34,197,94,0.4)':'#1F2937'}`, color:payoutForm.mode===key?'#22C55E':'#6B7280' }}>
                  <Icon size={14}/> {label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={submitPayout} disabled={payoutLoading||!payoutForm.name||!payoutForm.upiId||!payoutForm.mode}
            className="btn-neon flex items-center gap-2 w-full justify-center sm:w-auto" style={{ minHeight:'44px' }}>
            <ArrowRight size={14}/>{payoutLoading?'Processing...':'Save & Process Payout'}
          </button>
        </div>
      )}

      {/* UPI Account */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Payout Account</p>
            <p className="text-xs mt-0.5 truncate" style={{ color:'#6B7280' }}>
              {user?.upiId ? `UPI: ${user.upiId}` : 'No UPI ID set'}
            </p>
          </div>
          <button onClick={() => setUpiForm(f=>({...f,show:!f.show}))}
            className="btn-outline flex items-center gap-1.5 flex-shrink-0 text-xs" style={{ minHeight:'40px' }}>
            <Edit2 size={12}/>{user?.upiId?'Update':'Add UPI'}
          </button>
        </div>
        {upiForm.show && (
          <div className="mt-3 flex gap-2">
            <input value={upiForm.upiId} onChange={e => setUpiForm(f=>({...f,upiId:e.target.value}))}
              placeholder="yourname@upi" className="input-dark flex-1" style={{ fontSize:'16px' }}/>
            <button onClick={saveUpi} disabled={saving||!upiForm.upiId} className="btn-neon flex-shrink-0" style={{ minHeight:'44px' }}>
              {saving?'...':'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {['premiums','payouts'].map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`tab-item ${tab===t?'active':''}`}>
            {t.charAt(0).toUpperCase()+t.slice(1)} ({t==='premiums'?payments.length:payouts.length})
          </button>
        ))}
      </div>

      {tab==='premiums' && (
        payments.length===0 ? (
          <div className="card p-8 text-center"><CreditCard size={24} className="mx-auto mb-2" style={{ color:'#1F2937' }}/><p className="text-sm" style={{ color:'#4B5563' }}>No payments yet.</p></div>
        ) : (
          <div className="space-y-3">
            {payments.map(p => (
              <div key={p._id} className="card p-3 sm:p-4 flex items-start justify-between flex-wrap gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm">{p.description||'Premium Payment'}</p>
                  <p className="text-xs mt-0.5" style={{ color:'#6B7280' }}>{new Date(p.createdAt).toLocaleString()}</p>
                  {p.razorpayPaymentId&&<p className="text-xs font-mono mt-0.5 truncate" style={{ color:'#4B5563' }}>Ref: {p.razorpayPaymentId}</p>}
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <p className="font-bold text-white">₹{p.amount}</p>
                  <span className={STATUS_BADGE[p.status]||'badge-gray'}>{p.status.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab==='payouts' && (
        payouts.length===0 ? (
          <div className="card p-8 text-center"><p className="text-sm" style={{ color:'#4B5563' }}>No payouts yet.</p></div>
        ) : (
          <div className="space-y-3">
            {payouts.map(p => (
              <div key={p._id} className="card p-3 sm:p-4 flex items-start justify-between flex-wrap gap-3"
                style={p.status==='success'?{borderColor:'rgba(34,197,94,0.3)'}:{}}>
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm capitalize">{p.claimId?.triggerType||'Disruption'} Payout</p>
                  <p className="text-xs mt-0.5" style={{ color:'#9CA3AF' }}>{p.method?.toUpperCase()} {p.upiId?`· ${p.upiId}`:''}</p>
                  <p className="text-xs" style={{ color:'#4B5563' }}>{new Date(p.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1.5">
                  <p className="font-bold" style={{ color:'#22C55E' }}>+₹{p.amount}</p>
                  <span className={p.status==='success'?'badge-green':p.status==='failed'?'badge-red':'badge-yellow'}>
                    {p.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
