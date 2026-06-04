import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { User, MapPin, DollarSign, Briefcase, Shield, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Coimbatore', 'Pollachi', 'Other'];

export default function Profile() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({});
  const [premiumHistory, setPremiumHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('profile');

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '', phone: user.phone || '', platform: user.platform || 'Swiggy',
        homeCity: user.homeCity || user.location?.city || '',
        workCity:  user.workCity  || user.location?.city || '',
        weeklyIncome:        user.weeklyIncome        || '',
        averageDailyIncome:  user.averageDailyIncome  || '',
        averageOrdersPerDay: user.averageOrdersPerDay || '',
        onlineHoursPerDay:   user.onlineHoursPerDay   || ''
      });
    }
    api.get('/history/premium-history').then(r => setPremiumHistory(r.data)).catch(() => {});
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/users/profile', {
        name: form.name, phone: form.phone, platform: form.platform,
        homeCity: form.homeCity, workCity: form.workCity,
        weeklyIncome:        Number(form.weeklyIncome),
        averageDailyIncome:  Number(form.averageDailyIncome),
        averageOrdersPerDay: Number(form.averageOrdersPerDay),
        onlineHoursPerDay:   Number(form.onlineHoursPerDay)
      });
      toast.success('Profile updated — premium recalculated');
      // Refresh user
      const res = await api.get('/users/profile');
      // Update auth context by re-fetching (context reads from /users/profile on mount)
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally { setSaving(false); }
  };

  const inputCls = 'input-dark';
  const labelCls = 'block text-xs font-semibold mb-1.5 uppercase tracking-wider';

  const chartData = premiumHistory.map(p => ({
    date: new Date(p.generatedDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    premium: p.premiumAmount,
    risk: p.riskScore
  }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Profile</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Worker ID: {user?._id?.slice(-8).toUpperCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#22C55E', boxShadow: '0 0 6px #22C55E' }} />
          <span className="text-xs font-semibold" style={{ color: '#22C55E' }}>Trust Score: {user?.trustScore}/100</span>
        </div>
      </div>

      {/* Risk badge row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Risk Score',   value: user?.riskScore  || 50, color: '#EF4444',  unit: '/100' },
          { label: 'Risk Level',   value: user?.riskLevel?.toUpperCase() || 'MEDIUM', color: '#FACC15' },
          { label: 'Weekly Premium', value: `₹${user?.weeklyPremium || 0}`, color: '#3B82F6' },
          { label: 'Platform',     value: user?.platform || '—', color: '#8B5CF6' },
        ].map(({ label, value, color, unit }) => (
          <div key={label} className="stat-card">
            <p className="text-xs mb-1" style={{ color: '#6B7280' }}>{label}</p>
            <p className="text-xl font-bold" style={{ color }}>{value}{unit || ''}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {['profile', 'premium-history'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab-item ${tab === t ? 'active' : ''}`}>
            {t === 'profile' ? 'Edit Profile' : 'Premium History'}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <form onSubmit={save} className="space-y-4">
          {/* Personal */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <User size={14} style={{ color: '#3B82F6' }} />
              <span className="text-sm font-semibold text-white">Personal Information</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls} style={{ color: '#6B7280' }}>Full Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} style={{ color: '#6B7280' }}>Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} style={{ color: '#6B7280' }}>Platform</label>
                <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className={inputCls}>
                  {['Zepto', 'Swiggy', 'Zomato', 'Other'].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={14} style={{ color: '#22C55E' }} />
              <span className="text-sm font-semibold text-white">Location Details</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: '#6B7280' }}>Home City</label>
                <select value={form.homeCity} onChange={e => setForm(f => ({ ...f, homeCity: e.target.value }))} className={inputCls}>
                  {CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <p className="text-xs mt-1" style={{ color: '#4B5563' }}>Where you live</p>
              </div>
              <div>
                <label className={labelCls} style={{ color: '#6B7280' }}>Work City</label>
                <select value={form.workCity} onChange={e => setForm(f => ({ ...f, workCity: e.target.value }))} className={inputCls}>
                  {CITIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <p className="text-xs mt-1" style={{ color: '#4B5563' }}>Where you deliver</p>
              </div>
            </div>
            {form.homeCity && form.workCity && form.homeCity !== form.workCity && (
              <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)' }}>
                ✓ Claims will be checked for disruptions in both {form.homeCity} and {form.workCity}
              </div>
            )}
          </div>

          {/* Income */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={14} style={{ color: '#FACC15' }} />
              <span className="text-sm font-semibold text-white">Income Details</span>
              <span className="text-xs ml-auto" style={{ color: '#4B5563' }}>Changes recalculate premium</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: '#6B7280' }}>Weekly Income (₹)</label>
                <input type="number" value={form.weeklyIncome} onChange={e => setForm(f => ({ ...f, weeklyIncome: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} style={{ color: '#6B7280' }}>Daily Income (₹)</label>
                <input type="number" value={form.averageDailyIncome} onChange={e => setForm(f => ({ ...f, averageDailyIncome: e.target.value }))} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase size={14} style={{ color: '#8B5CF6' }} />
              <span className="text-sm font-semibold text-white">Activity Details</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: '#6B7280' }}>Avg Orders/Day</label>
                <input type="number" value={form.averageOrdersPerDay} onChange={e => setForm(f => ({ ...f, averageOrdersPerDay: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} style={{ color: '#6B7280' }}>Online Hours/Day</label>
                <input type="number" value={form.onlineHoursPerDay} onChange={e => setForm(f => ({ ...f, onlineHoursPerDay: e.target.value }))} className={inputCls} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-neon">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      )}

      {tab === 'premium-history' && (
        <div className="space-y-4">
          {chartData.length > 1 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Premium Trend</h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="premium" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 3 }} name="Premium (₹)" />
                  <Line type="monotone" dataKey="risk" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 3 }} name="Risk Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {premiumHistory.length === 0 ? (
            <div className="card p-10 text-center">
              <TrendingUp size={28} className="mx-auto mb-2" style={{ color: '#1F2937' }} />
              <p className="text-sm" style={{ color: '#4B5563' }}>No premium history yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {premiumHistory.map(p => (
                <div key={p._id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-white text-sm">₹{p.premiumAmount}/week — {p.planName || 'Standard'}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                      Home: {p.homeCity} · Work: {p.workCity} · Income: ₹{p.weeklyIncome}
                    </p>
                    <p className="text-xs" style={{ color: '#4B5563' }}>{new Date(p.generatedDate).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: '#6B7280' }}>Risk Score</p>
                    <p className="font-bold" style={{ color: p.riskScore > 70 ? '#EF4444' : p.riskScore > 50 ? '#FACC15' : '#22C55E' }}>
                      {p.riskScore}/100
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
