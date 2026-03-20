import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { CreditCard, CheckCircle, XCircle, Edit2, MapPin, CloudRain, Wind, Smartphone, Wallet, ArrowRight } from 'lucide-react';

const STATUS_BADGE = { success: 'badge-green', created: 'badge-gray', failed: 'badge-red', refunded: 'badge-yellow' };
const PAYMENT_MODES = [
  { key: 'upi',    label: 'UPI',    icon: Smartphone },
  { key: 'card',   label: 'Card',   icon: CreditCard },
  { key: 'wallet', label: 'Wallet', icon: Wallet },
];

export default function Payments() {
  const { user, setUser } = useAuth();
  const [payments, setPayments] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('premiums');
  const [loading, setLoading] = useState(true);

  // UPI setup
  const [upiForm, setUpiForm] = useState({ upiId: '', show: false });
  const [saving, setSaving] = useState(false);

  // Multi-step payout verification
  const [verifyStep, setVerifyStep] = useState(null); // null | 'verifying' | 'verified' | 'failed'
  const [verifyData, setVerifyData] = useState(null);
  const [payoutForm, setPayoutForm] = useState({ name: '', upiId: '', mode: '' });
  const [payoutLoading, setPayoutLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/payments/history').catch(() => ({ data: [] })),
      api.get('/claims/payouts').catch(() => ({ data: [] })),
      api.get('/payments/stats').catch(() => ({ data: null }))
    ]).then(([p, po, s]) => {
      setPayments(p.data); setPayouts(po.data); setStats(s.data); setLoading(false);
    });
  }, []);

  const saveUpi = async () => {
    setSaving(true);
    try {
      await api.put('/users/payment-details', { upiId: upiForm.upiId });
      setUser(prev => ({ ...prev, upiId: upiForm.upiId }));
      toast.success('UPI ID saved');
      setUpiForm({ upiId: '', show: false });
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  // Step 1: Verify GPS + Weather
  const startVerification = async () => {
    setVerifyStep('verifying');
    try {
      // Get GPS
      const gps = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            p => { clearTimeout(timeout); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
            err => { clearTimeout(timeout); reject(err); },
            { maximumAge: 10000, timeout: 5000, enableHighAccuracy: false }
          );
        } else {
          clearTimeout(timeout); reject(new Error('unavailable'));
        }
      }).catch(() => (user?.location ? { lat: user.location.lat, lng: user.location.lng, fallback: true } : { lat: 19.076, lng: 72.877, fallback: true }));

      // Get weather for zone
      let weather = await api.get(`/risk/zone?lat=${gps.lat}&lng=${gps.lng}`).then(r => r.data).catch(() => null);
      if (!weather) {
         weather = { weather: { rainfall: 0, temperature: 30 }, aqi: 50, name: user?.location?.city };
      }

      const rainfall = weather?.weather?.rainfall || 0;
      const aqi = weather?.aqi || 0;
      const temp = weather?.weather?.temperature || 0;

      const riskDetected = rainfall > 50 || aqi > 200 || temp > 42;
      const data = { gps, rainfall, aqi, temp, city: weather?.city, riskDetected, timestamp: new Date().toISOString() };
      setVerifyData(data);
      setVerifyStep(riskDetected ? 'verified' : 'failed');

      if (riskDetected) {
        toast.success('✅ Risk verified — you are eligible for payout');
        // Send GPS update
        if (!gps.fallback) api.post('/users/update-gps', { lat: gps.lat, lng: gps.lng }).catch(() => {});
      } else {
        toast.error('❌ No active risk detected at your location');
      }
    } catch {
      setVerifyStep('failed');
      toast.error('Verification failed');
    }
  };

  const submitPayout = async () => {
    if (!payoutForm.name || !payoutForm.upiId || !payoutForm.mode) {
      toast.error('Please fill all payout details');
      return;
    }
    const upiRegex = /^[\w.\-_]{3,}@[a-zA-Z]{3,}$/;
    if (!upiRegex.test(payoutForm.upiId)) {
      toast.error('Invalid UPI ID format (e.g. name@bank)');
      return;
    }
    setPayoutLoading(true);
    try {
      await api.post('/payout/save', {
        fullName: payoutForm.name,
        upiId: payoutForm.upiId,
        paymentMode: payoutForm.mode.toUpperCase()
      });
      toast.success('Payout details saved! Payouts will be processed on next eligible claim.');
      setVerifyStep(null); setVerifyData(null); setPayoutForm({ name: '', upiId: '', mode: '' });
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to save payout details';
      toast.error(errorMsg); 
    } finally { setPayoutLoading(false); }
  };

  if (loading) return <div className="p-6 text-sm" style={{ color: '#4B5563' }}>Loading...</div>;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Payments & Payouts</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Premium transactions and claim disbursements</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Premiums', value: `₹${stats.totalPremiumsPaid}`, glow: '#3B82F6' },
            { label: 'Successful', value: stats.successCount, glow: '#22C55E' },
            { label: 'Failed', value: stats.failedCount, glow: '#EF4444' },
            { label: 'Success Rate', value: `${stats.successRate}%`, glow: '#8B5CF6' },
          ].map(({ label, value, glow }) => (
            <div key={label} className="stat-card">
              <p className="text-xs font-medium mb-1" style={{ color: '#6B7280' }}>{label}</p>
              <p className="text-xl font-bold" style={{ color: glow }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Multi-Step Payout Verification ── */}
      <div className="card p-5 space-y-4" style={{ borderColor: 'rgba(59,130,246,0.2)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg,#22C55E,#3B82F6)', color: '#fff' }}>1</div>
          <h3 className="text-sm font-semibold text-white">Claim Verification</h3>
          <span className="text-xs ml-auto" style={{ color: '#4B5563' }}>GPS + Weather + AQI</span>
        </div>

        {!verifyStep && (
          <div>
            <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
              Verify your location and current weather conditions to check payout eligibility.
            </p>
            <button onClick={startVerification} className="btn-neon flex items-center gap-2">
              <MapPin size={14} /> Start Verification
            </button>
          </div>
        )}

        {verifyStep === 'verifying' && (
          <div className="flex items-center gap-3 text-sm" style={{ color: '#9CA3AF' }}>
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Fetching GPS and weather data...
          </div>
        )}

        {verifyData && verifyStep !== 'verifying' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { label: 'GPS', value: verifyData.gps?.fallback ? 'Registered' : 'Live', icon: MapPin, ok: true },
                { label: 'Rainfall', value: `${verifyData.rainfall}mm`, icon: CloudRain, ok: verifyData.rainfall > 50 },
                { label: 'AQI', value: verifyData.aqi, icon: Wind, ok: verifyData.aqi > 200 },
                { label: 'Temp', value: `${verifyData.temp}°C`, icon: null, ok: verifyData.temp > 42 },
              ].map(({ label, value, icon: I, ok }) => (
                <div key={label} className="rounded-xl p-3 text-center"
                  style={{ background: ok ? 'rgba(239,68,68,0.1)' : '#0B1220', border: `1px solid ${ok ? 'rgba(239,68,68,0.3)' : '#1F2937'}` }}>
                  <p className="text-xs mb-1" style={{ color: '#6B7280' }}>{label}</p>
                  <p className="font-bold text-sm" style={{ color: ok ? '#EF4444' : '#E5E7EB' }}>{value}</p>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
              style={{
                background: verifyStep === 'verified' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${verifyStep === 'verified' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: verifyStep === 'verified' ? '#22C55E' : '#EF4444'
              }}>
              {verifyStep === 'verified'
                ? '✅ Risk detected at your location — you are eligible to claim payout'
                : '❌ No active risk detected — claim cannot proceed at this time'}
            </div>

            <button onClick={() => { setVerifyStep(null); setVerifyData(null); }}
              className="text-xs" style={{ color: '#4B5563' }}>↺ Re-verify</button>
          </div>
        )}
      </div>

      {/* Step 2: Payout Setup — only if verified */}
      {verifyStep === 'verified' && (
        <div className="card p-5 space-y-4" style={{ borderColor: 'rgba(34,197,94,0.3)', boxShadow: '0 0 20px rgba(34,197,94,0.1)' }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: 'linear-gradient(135deg,#22C55E,#3B82F6)', color: '#fff' }}>2</div>
            <h3 className="text-sm font-semibold text-white">Payout Setup</h3>
            <span className="badge-green ml-auto">ELIGIBLE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6B7280' }}>Full Name</label>
              <input value={payoutForm.name} onChange={e => setPayoutForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your full name" className="input-dark" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6B7280' }}>UPI ID</label>
              <input value={payoutForm.upiId} onChange={e => setPayoutForm(f => ({ ...f, upiId: e.target.value }))}
                placeholder="yourname@bank" className="input-dark" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#6B7280' }}>Payment Mode</label>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_MODES.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setPayoutForm(f => ({ ...f, mode: key }))}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={payoutForm.mode === key
                    ? { background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E' }
                    : { background: '#0B1220', border: '1px solid #1F2937', color: '#6B7280' }}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={submitPayout} disabled={payoutLoading || !payoutForm.name || !payoutForm.upiId || !payoutForm.mode}
            className="btn-neon flex items-center gap-2">
            <ArrowRight size={14} />
            {payoutLoading ? 'Processing...' : 'Save & Process Payout'}
          </button>
        </div>
      )}

      {/* UPI Account */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Payout Account</p>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
              {user?.upiId ? `UPI: ${user.upiId}` : 'No UPI ID — payouts use mock transfer'}
            </p>
          </div>
          <button onClick={() => setUpiForm(f => ({ ...f, show: !f.show }))} className="btn-outline flex items-center gap-1.5">
            <Edit2 size={12} /> {user?.upiId ? 'Update' : 'Add UPI'}
          </button>
        </div>
        {upiForm.show && (
          <div className="mt-3 flex gap-2">
            <input value={upiForm.upiId} onChange={e => setUpiForm(f => ({ ...f, upiId: e.target.value }))}
              placeholder="yourname@upi" className="input-dark flex-1" />
            <button onClick={saveUpi} disabled={saving || !upiForm.upiId} className="btn-neon">
              {saving ? '...' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {['premiums', 'payouts'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab-item ${tab === t ? 'active' : ''}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)} ({t === 'premiums' ? payments.length : payouts.length})
          </button>
        ))}
      </div>

      {tab === 'premiums' && (
        payments.length === 0 ? (
          <div className="card p-10 text-center">
            <CreditCard size={28} className="mx-auto mb-2" style={{ color: '#1F2937' }} />
            <p className="text-sm" style={{ color: '#4B5563' }}>No premium payments yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map(p => (
              <div key={p._id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-semibold text-white text-sm">{p.description || 'Premium Payment'}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{new Date(p.createdAt).toLocaleString()}</p>
                  {p.razorpayPaymentId && <p className="text-xs font-mono mt-0.5" style={{ color: '#4B5563' }}>Ref: {p.razorpayPaymentId}</p>}
                  {p.policyId && <p className="text-xs" style={{ color: '#4B5563' }}>{p.policyId.planName}</p>}
                </div>
                <div className="text-right space-y-1">
                  <p className="font-bold text-white">₹{p.amount}</p>
                  <span className={STATUS_BADGE[p.status] || 'badge-gray'}>{p.status.toUpperCase()}</span>
                  {p.paidAt && <p className="text-xs" style={{ color: '#4B5563' }}>Paid {new Date(p.paidAt).toLocaleDateString()}</p>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'payouts' && (
        payouts.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm" style={{ color: '#4B5563' }}>No payouts yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payouts.map(p => (
              <div key={p._id} className="card p-4 flex items-center justify-between flex-wrap gap-3"
                style={p.status === 'success' ? { borderColor: 'rgba(34,197,94,0.3)' } : {}}>
                <div>
                  <p className="font-semibold text-white text-sm capitalize">{p.claimId?.triggerType || 'Disruption'} Payout</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{p.method?.toUpperCase()} {p.upiId ? `· ${p.upiId}` : ''}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#4B5563' }}>{new Date(p.createdAt).toLocaleString()}</p>
                  {p.razorpayPayoutId && <p className="text-xs font-mono" style={{ color: '#4B5563' }}>Ref: {p.razorpayPayoutId}</p>}
                </div>
                <div className="text-right space-y-1.5">
                  <p className="font-bold" style={{ color: '#22C55E' }}>+₹{p.amount}</p>
                  <span className={p.status === 'success' ? 'badge-green' : p.status === 'failed' ? 'badge-red' : 'badge-yellow'}>
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
