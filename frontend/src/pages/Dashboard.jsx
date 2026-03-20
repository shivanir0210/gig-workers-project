import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Shield, TrendingDown, CheckCircle, Star, MapPin, Bell } from 'lucide-react';

const RISK_GLOW = { none: '#22C55E', low: '#FACC15', medium: '#F97316', high: '#EF4444', extreme: '#EF4444' };
const RISK_LABEL = { none: 'badge-green', low: 'badge-yellow', medium: 'badge-yellow', high: 'badge-red', extreme: 'badge-red' };

export default function Dashboard() {
  const { user } = useAuth();
  const [riskData, setRiskData] = useState(null);
  const [claimStats, setClaimStats] = useState({ total: 0, paid: 0, pending: 0, totalPayout: 0 });
  const [policy, setPolicy] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [paymentStats, setPaymentStats] = useState(null);
  const [gps, setGps] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const watchRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    api.get(`/risk/current/${user.location.city}`).then(r => {
      setRiskData(r.data);
      // Smart notification
      if (r.data.alerts?.length > 0) {
        setNotifications(r.data.alerts.map(a => ({ text: a, type: 'warning' })));
        if ('Notification' in window && Notification.permission === 'granted') {
          r.data.alerts.forEach(a => new Notification('⚠ GigShield Alert', { body: a }));
        }
      }
    }).catch(() => {});
    api.get('/claims/stats').then(r => setClaimStats(r.data)).catch(() => {});
    api.get('/policies/my').then(r => setPolicy(r.data.find(p => p.status === 'active'))).catch(() => {});
    api.get('/payments/stats').then(r => setPaymentStats(r.data)).catch(() => {});
    api.post('http://localhost:8000/income-prediction', { city: user.location.city, weeklyIncome: user.weeklyIncome })
      .then(r => setPrediction(r.data)).catch(() => {});

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Live GPS watchPosition
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
    { label: 'Weekly Premium', value: `₹${user?.weeklyPremium || 0}`, icon: Shield, glow: '#3B82F6' },
    { label: 'Est. Weekly Loss', value: `₹${prediction?.estimatedWeeklyLoss || 0}`, icon: TrendingDown, glow: '#EF4444' },
    { label: 'Total Payouts', value: `₹${claimStats.totalPayout}`, icon: CheckCircle, glow: '#22C55E' },
    { label: 'Trust Score', value: `${user?.trustScore || 100}/100`, icon: Star, glow: '#FACC15' },
  ];

  const riskColor = RISK_GLOW[riskData?.disruptionLevel] || '#22C55E';

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Dashboard</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{user?.name} · {user?.platform} · {user?.location?.city}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {gps && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: gps.verified ? 'rgba(34,197,94,0.12)' : 'rgba(156,163,175,0.1)', color: gps.verified ? '#22C55E' : '#6B7280', border: `1px solid ${gps.verified ? 'rgba(34,197,94,0.3)' : '#1F2937'}` }}>
              <MapPin size={11} />
              {gps.verified ? `GPS Live · ${gps.lat?.toFixed(3)}, ${gps.lng?.toFixed(3)}` : 'GPS Unavailable'}
            </div>
          )}
          {riskData && (
            <div className={RISK_LABEL[riskData.disruptionLevel] || 'badge-green'}>
              {riskData.disruptionLevel?.toUpperCase()} RISK
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
              <Bell size={14} className="flex-shrink-0" style={{ color: '#EF4444' }} />
              ⚠ {n.text} — Insurance coverage active
            </div>
          ))}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, glow }) => (
          <div key={label} className="stat-card group cursor-default">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${glow}18`, boxShadow: `0 0 12px ${glow}30` }}>
              <Icon size={17} style={{ color: glow }} />
            </div>
            <p className="text-xs font-medium" style={{ color: '#6B7280' }}>{label}</p>
            <p className="text-xl font-bold text-white mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Live Conditions */}
        {riskData && (
          <div className="card p-5" style={{ borderColor: `${riskColor}40` }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Live Conditions — {riskData.city}</h3>
              <span className="text-xs" style={{ color: '#4B5563' }}>{riskData.weather?.description}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Rainfall', value: `${riskData.weather?.rainfall || 0} mm`, alert: riskData.weather?.rainfall > 50 },
                { label: 'Temperature', value: `${riskData.weather?.temperature || 0}°C`, alert: riskData.weather?.temperature > 42 },
                { label: 'AQI Index', value: riskData.aqi, alert: riskData.aqi > 200 },
                { label: 'Humidity', value: `${riskData.weather?.humidity || 0}%`, alert: false },
              ].map(({ label, value, alert }) => (
                <div key={label} className="rounded-xl p-3"
                  style={{ background: alert ? 'rgba(239,68,68,0.1)' : '#0B1220', border: `1px solid ${alert ? 'rgba(239,68,68,0.3)' : '#1F2937'}` }}>
                  <p className="text-xs font-medium" style={{ color: '#6B7280' }}>{label}</p>
                  <p className="font-bold text-sm mt-0.5" style={{ color: alert ? '#EF4444' : '#E5E7EB' }}>{value}</p>
                </div>
              ))}
            </div>
            {riskData.alerts?.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {riskData.alerts.map((a, i) => (
                  <div key={i} className="text-xs px-3 py-2 rounded-lg font-medium"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5' }}>
                    🚨 {a}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Claim Chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Claim Activity</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={[
              { name: 'Total', value: claimStats.total },
              { name: 'Paid', value: claimStats.paid },
              { name: 'Pending', value: claimStats.pending }
            ]} barSize={32}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4B5563' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#4B5563' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 10, fontSize: 12, color: '#E5E7EB' }} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
              <Bar dataKey="value" fill="url(#barGrad)" radius={[5, 5, 0, 0]} />
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Policy */}
      {policy && (
        <div className="card p-5" style={{ borderColor: 'rgba(34,197,94,0.3)', boxShadow: '0 0 20px rgba(34,197,94,0.1)' }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={14} style={{ color: '#22C55E' }} />
                <span className="text-xs font-semibold" style={{ color: '#6B7280' }}>ACTIVE POLICY</span>
              </div>
              <p className="font-bold text-white">{policy.planName}</p>
              <p className="text-sm mt-0.5" style={{ color: '#9CA3AF' }}>Coverage ₹{policy.coverageAmount} · Premium ₹{policy.weeklyPremium}/week</p>
              <p className="text-xs mt-1" style={{ color: '#4B5563' }}>Covers: {policy.coverageType?.join(', ')} · Expires {new Date(policy.endDate).toLocaleDateString()}</p>
            </div>
            <span className="badge-green">ACTIVE</span>
          </div>
        </div>
      )}

      {/* Payment + Prediction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {paymentStats && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Payment Summary</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Total Premiums Paid', value: `₹${paymentStats.totalPremiumsPaid}` },
                { label: 'Successful', value: paymentStats.successCount },
                { label: 'Failed', value: paymentStats.failedCount },
                { label: 'Success Rate', value: `${paymentStats.successRate}%` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: '#0B1220', border: '1px solid #1F2937' }}>
                  <p className="text-xs" style={{ color: '#6B7280' }}>{label}</p>
                  <p className="font-bold text-sm text-white mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {prediction && (
          <div className="card p-5" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
            <h3 className="text-sm font-semibold text-white mb-3">Income Risk Forecast</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Est. Weekly Loss', value: `₹${prediction.estimatedWeeklyLoss}`, color: '#EF4444' },
                { label: 'Disruption Days', value: `${prediction.disruptionDaysPerWeek} days`, color: '#F97316' },
                { label: 'Loss %', value: `${prediction.lossPercentage}%`, color: '#FACC15' },
                { label: 'Recommended', value: prediction.recommendation, color: '#22C55E' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-3" style={{ background: '#0B1220', border: '1px solid #1F2937' }}>
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
