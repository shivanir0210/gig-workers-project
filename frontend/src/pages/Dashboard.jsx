import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Shield, TrendingDown, CheckCircle, Star, MapPin, Bell, Home, Briefcase, AlertTriangle } from 'lucide-react';

const RISK_GLOW  = { none:'#22C55E', low:'#FACC15', medium:'#F97316', high:'#EF4444', extreme:'#EF4444' };
const RISK_LABEL = { none:'badge-green', low:'badge-yellow', medium:'badge-yellow', high:'badge-red', extreme:'badge-red' };

export default function Dashboard() {
  const { user } = useAuth();
  const [riskData,       setRiskData]       = useState(null);
  const [claimStats,     setClaimStats]     = useState({ total:0, paid:0, pending:0, totalPayout:0 });
  const [policy,         setPolicy]         = useState(null);
  const [prediction,     setPrediction]     = useState(null);
  const [paymentStats,   setPaymentStats]   = useState(null);
  const [gps,            setGps]            = useState(null);
  const [notifications,  setNotifications]  = useState([]);
  const [locationStatus, setLocationStatus] = useState([]);
  const [locationAlerts, setLocationAlerts] = useState([]);
  const watchRef = useRef(null);

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
    api.get('/policies/my').then(r => setPolicy(r.data.find(p => p.status === 'active'))).catch(() => {});
    api.get('/payments/stats').then(r => setPaymentStats(r.data)).catch(() => {});
    api.post('http://localhost:8000/income-prediction', { city: user.location.city, weeklyIncome: user.weeklyIncome })
      .then(r => setPrediction(r.data)).catch(() => {});
    api.get('/alerts/location-status').then(r => setLocationStatus(r.data)).catch(() => {});
    api.post('/alerts/check').then(r => { if (r.data.alerts?.length > 0) setLocationAlerts(r.data.alerts); }).catch(() => {});

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

      {/* Status banners */}
      {user?.verificationStatus === 'pending' && (
        <div className="flex items-start gap-2 px-3 sm:px-4 py-3 rounded-xl text-xs sm:text-sm font-medium"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#FCD34D' }}>
          ⏳ Account pending admin verification.
        </div>
      )}
      {locationAlerts.map((a, i) => (
        <div key={i} className="flex items-start gap-2 px-3 py-3 rounded-xl text-xs sm:text-sm"
          style={{ background: a.severity === 'extreme' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)', border: `1px solid ${a.severity === 'extreme' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, color: a.severity === 'extreme' ? '#FCA5A5' : '#FCD34D' }}>
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">{a.message}</p>
            <p className="text-xs mt-0.5 opacity-70">{a.cityType === 'work' ? '📍 Work' : '🏠 Home'} · {new Date(a.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>
      ))}
      {notifications.map((n, i) => (
        <div key={i} className="flex items-center gap-2 px-3 sm:px-4 py-3 rounded-xl text-xs sm:text-sm font-medium"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          <Bell size={13} className="flex-shrink-0" />⚠ {n.text}
        </div>
      ))}

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
