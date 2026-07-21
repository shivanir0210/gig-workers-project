import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Shield, TrendingDown, CheckCircle, Star, MapPin, Bell, Home, Briefcase, AlertTriangle } from 'lucide-react';
import PolicyAlertBanner from '../components/PolicyAlertBanner';
import InsuranceStatusWidget from '../components/InsuranceStatusWidget';

const RISK_GLOW  = { none:'#22C55E', low:'#FACC15', medium:'#F97316', high:'#EF4444', extreme:'#EF4444' };
const RISK_LABEL = { none:'badge-green', low:'badge-yellow', medium:'badge-yellow', high:'badge-red', extreme:'badge-red' };

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [riskData,       setRiskData]       = useState(null);
  const [claimStats,     setClaimStats]     = useState({ total:0, paid:0, pending:0, totalPayout:0 });
  const [policy,         setPolicy]         = useState(null);
  const [policyStatusData, setPolicyStatusData] = useState(null);
  const [prediction,     setPrediction]     = useState(null);
  const [paymentStats,   setPaymentStats]   = useState(null);
  const [gps,            setGps]            = useState(null);
  const [notifications,  setNotifications]  = useState([]);
  const [locationStatus, setLocationStatus] = useState([]);
  const [locationAlerts, setLocationAlerts] = useState([]);
  const [dualEligibility,setDualEligibility]= useState(null);
  const watchRef = useRef(null);

  const fetchPolicyStatus = () => {
    api.get('/policy/status')
      .then(r => setPolicyStatusData(r.data))
      .catch(() => {});
  };

  useEffect(() => {
    if (!user) return;
    api.get(`/risk/current/${user.location.city}`).then(r => {
      setRiskData(r.data);
      if (r.data.alerts?.length > 0) {
        setNotifications(r.data.alerts.map(a => ({ text: a })));
        if ('Notification' in window && Notification.permission === 'granted')
          r.data.alerts.forEach(a => new Notification('⚠ GigShield Alert', { body: a }));
      }
    }).catch(() => {});
    api.get('/claims/stats').then(r => setClaimStats(r.data)).catch(() => {});
    api.get('/policies/my').then(r => setPolicy(r.data.find(p => p.status === 'active' || p.policyStatus === 'ACTIVE'))).catch(() => {});
    fetchPolicyStatus();
    api.get('/payments/stats').then(r => setPaymentStats(r.data)).catch(() => {});
    api.post('http://localhost:8000/income-prediction', { city: user.location.city, weeklyIncome: user.weeklyIncome })
      .then(r => setPrediction(r.data)).catch(() => {});
    api.get('/alerts/location-status').then(r => setLocationStatus(r.data)).catch(() => {});
    api.post('/alerts/check').then(r => { if (r.data.alerts?.length > 0) setLocationAlerts(r.data.alerts); }).catch(() => {});
    api.post('/alerts/dual-check').then(r => setDualEligibility(r.data)).catch(() => {});

    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    if (navigator.geolocation) {
      watchRef.current = navigator.geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setGps({ lat, lng, verified: true });
          api.post('/users/update-gps', { lat, lng }).catch(() => {});
        },
        () => setGps({ verified: false }),
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
    }
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, [user]);

  const handlePayPremium = async () => {
    const nextDue = policy?.nextDueDate ? new Date(policy.nextDueDate) : null;
    if (nextDue && new Date() < nextDue) {
      const formattedNextDue = nextDue.toLocaleDateString('en-GB');
      toast.error(`Premium already paid. Next premium is due on ${formattedNextDue}.`);
      return;
    }
    try {
      const res = await api.post('/policy/pay-premium', { paymentMethod: 'UPI' });
      toast.success(res.data.message || 'Premium paid successfully!');
      fetchPolicyStatus();
      api.get('/policies/my').then(r => setPolicy(r.data.find(p => p.status === 'active' || p.policyStatus === 'ACTIVE'))).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to pay premium');
    }
  };

  const handleRenewPolicy = async () => {
    try {
      const res = await api.post('/policy/renew');
      toast.success(res.data.message || 'Policy renewed successfully!');
      fetchPolicyStatus();
      api.get('/policies/my').then(r => setPolicy(r.data.find(p => p.status === 'active' || p.policyStatus === 'ACTIVE'))).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to renew policy');
    }
  };

  const hasDocs = user?.aadhaarCardUrl || user?.workerIdCardUrl || user?.platformScreenshotUrl;
  const isApproved = user?.verificationStatus === 'approved';
  const hasPolicy = !!policy;

  let progressPercent = 25;
  if (hasDocs) progressPercent = 50;
  if (isApproved) progressPercent = 75;
  if (hasPolicy) progressPercent = 100;

  const daysRemaining = policy ? Math.max(0, Math.ceil((new Date(policy.endDate) - new Date()) / (1000 * 60 * 60 * 24))) : 0;

  const statCards = [
    { label: 'Weekly Premium',  value: `₹${user?.weeklyPremium || 0}`,          icon: Shield,      glow: '#3B82F6' },
    { label: 'Est. Loss/Week',  value: `₹${prediction?.estimatedWeeklyLoss||0}`, icon: TrendingDown,glow: '#EF4444' },
    { label: 'Total Payouts',   value: `₹${claimStats.totalPayout}`,             icon: CheckCircle, glow: '#22C55E' },
    { label: 'Trust Score',     value: `${user?.trustScore||100}/100`,           icon: Star,        glow: '#FACC15' },
  ];
  const riskColor = RISK_GLOW[riskData?.disruptionLevel] || '#22C55E';

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Dashboard</h2>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {user?.name} · {user?.platform} · {user?.location?.city}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {gps && (
            <div className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-medium"
              style={{ background: gps.verified ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.1)', color: gps.verified ? '#22C55E' : '#6B7280', border: `1px solid ${gps.verified ? 'rgba(34,197,94,0.3)' : '#1F2937'}` }}>
              <MapPin size={10} />
              <span className="hidden sm:inline">{gps.verified ? `GPS Live · ${gps.lat?.toFixed(3)}, ${gps.lng?.toFixed(3)}` : 'GPS Unavailable'}</span>
              <span className="sm:hidden">{gps.verified ? 'GPS ✓' : 'GPS ✗'}</span>
            </div>
          )}
          {riskData && (
            <div className={RISK_LABEL[riskData.disruptionLevel] || 'badge-green'}>
              {riskData.disruptionLevel?.toUpperCase()} RISK
            </div>
          )}
        </div>
      </div>

      {/* Policy Alerts & Reminders Banner */}
      {policyStatusData?.alerts && (
        <PolicyAlertBanner
          alerts={policyStatusData.alerts}
          policyStatus={policyStatusData.policyStatus}
          onPayPremium={handlePayPremium}
          onRenewPolicy={handleRenewPolicy}
          onActivatePolicy={() => navigate('/policies')}
        />
      )}

      {/* Verification & Coverage Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Verification Progress Tracker */}
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Verification Status</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse"
              style={{ background: isApproved ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: isApproved ? '#22C55E' : '#F59E0B' }}>
              Progress: {progressPercent}%
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="h-2 w-full rounded-full" style={{ background: '#1F2937' }}>
            <div className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${progressPercent}%`,
                background: progressPercent === 100 ? 'linear-gradient(90deg,#22C55E,#3B82F6)' : 'linear-gradient(90deg,#F59E0B,#3B82F6)'
              }}
            />
          </div>

          {/* Steps list */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
            {[
              { label: 'Account Created', checked: true },
              { label: 'Docs Uploaded', checked: !!hasDocs },
              {
                label: 'Verified',
                checked: isApproved,
                pending: user?.verificationStatus === 'pending',
                rejected: user?.verificationStatus === 'rejected'
              },
              { label: 'Policy Active', checked: hasPolicy }
            ].map((step, idx) => (
              <div key={idx} className="rounded-xl p-2.5 flex flex-col items-center justify-between"
                style={{ background: '#0B1220', border: '1px solid #1F2937' }}>
                <span className="text-[10px] uppercase font-semibold text-gray-500 mb-1">{step.label}</span>
                {step.checked ? (
                  <span className="text-xs font-bold text-green-500 flex items-center gap-0.5">✓ Done</span>
                ) : step.rejected ? (
                  <span className="text-xs font-bold text-red-500 flex items-center gap-0.5">✗ Rejected</span>
                ) : step.pending ? (
                  <span className="text-xs font-bold text-yellow-500 animate-pulse">⏳ Pending</span>
                ) : (
                  <span className="text-xs font-bold text-gray-600">Pending</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Insurance Status Widget */}
        <InsuranceStatusWidget
          statusData={policyStatusData || {
            policyStatus: hasPolicy ? 'ACTIVE' : 'INACTIVE',
            planName: policy ? policy.planName : 'No Plan',
            premiumAmount: policy ? (policy.premiumAmount || policy.weeklyPremium) : 0,
            paymentFrequency: policy ? (policy.paymentFrequency || 'Weekly') : 'Weekly',
            nextDueDate: policy ? (policy.nextDueDate || policy.endDate) : null,
            daysRemaining,
            coverageStatus: hasPolicy ? 'Protected' : 'Unprotected'
          }}
          onPayPremium={handlePayPremium}
          onRenewPolicy={handleRenewPolicy}
        />

      </div>

      {/* Today's Alerts Widget */}
      <div className="card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-red-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-white">Today's Alerts</h3>
          <span className="text-xs text-gray-500 ml-auto">Work Location Risk Monitoring</span>
        </div>

        {locationAlerts.length === 0 ? (
          <p className="text-xs text-gray-500 py-2">
            ✓ No alerts today. Weather conditions and air quality are safe across your home and work cities.
          </p>
        ) : (
          <div className="space-y-2">
            {locationAlerts.map((alert, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl text-xs sm:text-sm"
                style={{
                  background: alert.severity === 'extreme' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.08)',
                  border: `1px solid ${alert.severity === 'extreme' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)'}`,
                  color: alert.severity === 'extreme' ? '#FCA5A5' : '#FCD34D'
                }}>
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-white uppercase tracking-wider text-[10px]">
                    ⚠ {alert.alertType?.toUpperCase()} WARNING &middot; {alert.cityType?.toUpperCase()} ({alert.city})
                  </p>
                  <p className="opacity-90">{alert.message}</p>
                  <p className="text-[10px] opacity-70">
                    Expected Income disruption detected &middot; {new Date(alert.timestamp || Date.now()).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dual-City Eligibility Panel */}
      {dualEligibility && (
        <div className="card p-4 sm:p-5 space-y-4"
          style={{ borderColor: dualEligibility.eligible ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.25)' }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Shield size={14} style={{ color: dualEligibility.eligible ? '#22C55E' : '#EF4444' }} />
              <h3 className="text-sm font-semibold text-white">Dual-City Claim Eligibility</h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: dualEligibility.eligible ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: dualEligibility.eligible ? '#22C55E' : '#EF4444', border: `1px solid ${dualEligibility.eligible ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'}` }}>
              {dualEligibility.eligible ? '✅ Eligible for Claim' : '❌ Not Eligible'}
            </span>
          </div>

          {/* City comparison grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[{ label: 'Home City', key: 'homeData', city: dualEligibility.homeCity, icon: Home, color: '#8B5CF6' },
              { label: 'Work City', key: 'workData',  city: dualEligibility.workCity,  icon: Briefcase, color: '#3B82F6' }
            ].map(({ label, key, city, icon: Icon, color }) => {
              const d = dualEligibility[key];
              if (!d) return null;
              const THRESH = dualEligibility.thresholds || { rainfall: 50, aqi: 200, temperature: 42 };
              const rainAlert = d.weather?.rainfall >= THRESH.rainfall;
              const aqiAlert  = d.aqi >= THRESH.aqi;
              const tempAlert = d.weather?.temperature >= THRESH.temperature;
              return (
                <div key={key} className="rounded-xl p-3 sm:p-4 space-y-3"
                  style={{ background: '#0B1220', border: `1px solid ${color}30` }}>
                  <div className="flex items-center gap-2">
                    <Icon size={13} style={{ color }} />
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{label}</span>
                    <span className="text-sm font-bold text-white ml-1">{city}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Rainfall', value: `${d.weather?.rainfall || 0}mm`, alert: rainAlert, thresh: `>${THRESH.rainfall}mm` },
                      { label: 'AQI',      value: d.aqi || 0,                       alert: aqiAlert,  thresh: `>${THRESH.aqi}` },
                      { label: 'Temp',     value: `${d.weather?.temperature || 0}°C`, alert: tempAlert, thresh: `>${THRESH.temperature}°C` }
                    ].map(({ label: l, value, alert, thresh }) => (
                      <div key={l} className="rounded-lg p-2 text-center"
                        style={{ background: alert ? 'rgba(239,68,68,0.12)' : '#111827', border: `1px solid ${alert ? 'rgba(239,68,68,0.35)' : '#1F2937'}` }}>
                        <p className="text-[10px] font-medium" style={{ color: '#6B7280' }}>{l}</p>
                        <p className="text-xs font-bold mt-0.5" style={{ color: alert ? '#EF4444' : '#E5E7EB' }}>{value}</p>
                        <p className="text-[9px] mt-0.5" style={{ color: alert ? '#F87171' : '#374151' }}>{thresh}</p>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ background: ['high','extreme'].includes(d.disruptionLevel) ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', color: ['high','extreme'].includes(d.disruptionLevel) ? '#FCA5A5' : '#86EFAC' }}>
                    Disruption: {d.disruptionLevel?.toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Eligibility reason */}
          <div className="px-3 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: dualEligibility.eligible ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', color: dualEligibility.eligible ? '#86EFAC' : '#FCD34D', border: `1px solid ${dualEligibility.eligible ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
            {dualEligibility.eligible
              ? `✅ ${dualEligibility.reason}. You may submit a claim now.`
              : `ℹ️ ${dualEligibility.reason}. Both cities must exceed thresholds simultaneously.`}
          </div>

          {dualEligibility.eligible && (
            <Link to="/claims" className="btn-neon w-full text-center text-xs py-2.5 flex items-center justify-center gap-2" style={{ minHeight: '44px' }}>
              <AlertTriangle size={13} /> Submit Claim Now
            </Link>
          )}
        </div>
      )}

      {/* Stat Cards — 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map(({ label, value, icon: Icon, glow }) => (
          <div key={label} className="stat-card">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2 sm:mb-3"
              style={{ background: `${glow}18`, boxShadow: `0 0 12px ${glow}30` }}>
              <Icon size={15} style={{ color: glow }} />
            </div>
            <p className="text-xs font-medium leading-tight" style={{ color: '#6B7280' }}>{label}</p>
            <p className="text-lg sm:text-xl font-bold text-white mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Live Conditions + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {riskData && (
          <div className="card p-4 sm:p-5" style={{ borderColor: `${riskColor}40` }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Live — {riskData.city}</h3>
              <span className="text-xs" style={{ color: '#4B5563' }}>{riskData.weather?.description}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label:'Rainfall',    value:`${riskData.weather?.rainfall||0}mm`,       alert:riskData.weather?.rainfall>50 },
                { label:'Temperature', value:`${riskData.weather?.temperature||0}°C`,    alert:riskData.weather?.temperature>42 },
                { label:'AQI',         value:riskData.aqi,                               alert:riskData.aqi>200 },
                { label:'Humidity',    value:`${riskData.weather?.humidity||0}%`,        alert:false },
              ].map(({ label, value, alert }) => (
                <div key={label} className="rounded-xl p-2.5 sm:p-3"
                  style={{ background: alert ? 'rgba(239,68,68,0.1)' : '#0B1220', border: `1px solid ${alert ? 'rgba(239,68,68,0.3)' : '#1F2937'}` }}>
                  <p className="text-xs font-medium" style={{ color: '#6B7280' }}>{label}</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color: alert ? '#EF4444' : '#E5E7EB' }}>{value}</p>
                </div>
              ))}
            </div>
            {riskData.alerts?.map((a, i) => (
              <div key={i} className="mt-2 text-xs px-3 py-2 rounded-lg font-medium"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5' }}>
                🚨 {a}
              </div>
            ))}
          </div>
        )}
        <div className="card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-white mb-3 sm:mb-4">Claim Activity</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={[
              { name:'Total',   value:claimStats.total },
              { name:'Paid',    value:claimStats.paid },
              { name:'Pending', value:claimStats.pending }
            ]} barSize={28}>
              <XAxis dataKey="name" tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background:'#111827', border:'1px solid #1F2937', borderRadius:8, fontSize:11, color:'#E5E7EB' }} cursor={{ fill:'rgba(59,130,246,0.08)' }} />
              <Bar dataKey="value" fill="url(#barGrad)" radius={[4,4,0,0]} />
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Location Status */}
      {locationStatus.length > 0 && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <MapPin size={13} style={{ color: '#3B82F6' }} />
            <h3 className="text-sm font-semibold text-white">Work Location Status</h3>
            <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>Live</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {locationStatus.map(loc => {
              const rc = RISK_GLOW[loc.disruptionLevel] || '#22C55E';
              return (
                <div key={loc.city} className="rounded-xl p-3 sm:p-4" style={{ background: '#0B1220', border: `1px solid ${rc}30` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {loc.cityType === 'home' ? <Home size={12} style={{ color: '#8B5CF6' }} /> : <Briefcase size={12} style={{ color: '#3B82F6' }} />}
                      <span className="text-xs font-semibold" style={{ color: loc.cityType === 'home' ? '#8B5CF6' : '#3B82F6' }}>
                        {loc.cityType === 'home' ? 'HOME' : 'WORK'}
                      </span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${rc}20`, color: rc }}>
                      {loc.disruptionLevel?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-white mb-2">{loc.city}</p>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {[
                      { label:'Rain', value:`${loc.weather?.rainfall||0}mm`, alert:loc.weather?.rainfall>50 },
                      { label:'AQI',  value:loc.aqi||0,                      alert:loc.aqi>200 },
                      { label:'Temp', value:`${loc.weather?.temperature||0}°C`, alert:loc.weather?.temperature>42 }
                    ].map(({ label, value, alert }) => (
                      <div key={label} className="rounded-lg p-1.5 sm:p-2 text-center"
                        style={{ background: alert ? 'rgba(239,68,68,0.1)' : '#111827', border: `1px solid ${alert ? 'rgba(239,68,68,0.3)' : '#1F2937'}` }}>
                        <p className="text-xs" style={{ color: '#4B5563' }}>{label}</p>
                        <p className="text-xs font-bold mt-0.5" style={{ color: alert ? '#EF4444' : '#E5E7EB' }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Policy */}
      {policy && (
        <div className="card p-4 sm:p-5" style={{ borderColor: 'rgba(34,197,94,0.3)' }}>
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={13} style={{ color: '#22C55E' }} />
                <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>ACTIVE POLICY</span>
              </div>
              <p className="font-bold text-white">{policy.planName}</p>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: '#9CA3AF' }}>
                Coverage ₹{policy.coverageAmount} · ₹{policy.weeklyPremium}/week
              </p>
              <p className="text-xs mt-1" style={{ color: '#4B5563' }}>
                {policy.coverageType?.join(', ')} · Expires {new Date(policy.endDate).toLocaleDateString()}
              </p>
            </div>
            <span className="badge-green">ACTIVE</span>
          </div>
        </div>
      )}

      {/* Payment + Prediction */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {paymentStats && (
          <div className="card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Payment Summary</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label:'Premiums Paid',  value:`₹${paymentStats.totalPremiumsPaid}` },
                { label:'Successful',     value:paymentStats.successCount },
                { label:'Failed',         value:paymentStats.failedCount },
                { label:'Success Rate',   value:`${paymentStats.successRate}%` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-2.5" style={{ background: '#0B1220', border: '1px solid #1F2937' }}>
                  <p className="text-xs" style={{ color: '#6B7280' }}>{label}</p>
                  <p className="font-bold text-sm text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {prediction && (
          <div className="card p-4 sm:p-5" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
            <h3 className="text-sm font-semibold text-white mb-3">Income Risk Forecast</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label:'Est. Weekly Loss',    value:`₹${prediction.estimatedWeeklyLoss}`,   color:'#EF4444' },
                { label:'Disruption Days',     value:`${prediction.disruptionDaysPerWeek}d`,  color:'#F97316' },
                { label:'Loss %',              value:`${prediction.lossPercentage}%`,          color:'#FACC15' },
                { label:'Recommended',         value:prediction.recommendation,               color:'#22C55E' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-2.5" style={{ background: '#0B1220', border: '1px solid #1F2937' }}>
                  <p className="text-xs" style={{ color: '#6B7280' }}>{label}</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
