import { useEffect, useState } from 'react';
import api from '../api';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, FileText, AlertTriangle, DollarSign, TrendingUp, Activity, Download, CheckCircle, XCircle, Shield, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

const TTStyle   = { background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12, color: '#E5E7EB' };
const PIE_COLORS = ['#22C55E', '#3B82F6', '#FACC15', '#EF4444', '#8B5CF6'];
const TABS = ['Overview', 'Verification', 'Fraud Center', 'Claims', 'Analytics'];

const FRAUD_COLOR = { safe: '#22C55E', review: '#3B82F6', suspicious: '#F97316', blocked: '#EF4444' };
const VERIFY_COLOR = { pending: '#FACC15', approved: '#22C55E', rejected: '#EF4444' };

export default function Admin() {
  const [tab,              setTab]              = useState('Overview');
  const [overview,         setOverview]         = useState(null);
  const [pendingWorkers,   setPendingWorkers]   = useState([]);
  const [fraudUsers,       setFraudUsers]       = useState([]);
  const [fraudClaims,      setFraudClaims]      = useState([]);
  const [allClaims,        setAllClaims]        = useState([]);
  const [claimAnalytics,   setClaimAnalytics]   = useState(null);
  const [platformAnalytics,setPlatformAnalytics] = useState([]);
  const [pool,             setPool]             = useState(null);
  const [users,            setUsers]            = useState([]);
  const [loading,          setLoading]          = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/overview').catch(() => ({ data: null })),
      api.get('/admin/pending-workers').catch(() => ({ data: [] })),
      api.get('/admin/fraud-users').catch(() => ({ data: [] })),
      api.get('/admin/fraud-claims').catch(() => ({ data: [] })),
      api.get('/admin/all-claims').catch(() => ({ data: [] })),
      api.get('/admin/claim-analytics').catch(() => ({ data: null })),
      api.get('/admin/platform-analytics').catch(() => ({ data: [] })),
      api.get('/admin/pool').catch(() => ({ data: null })),
      api.get('/admin/users?limit=15').catch(() => ({ data: { users: [] } }))
    ]).then(([ov, pw, fu, fc, ac, ca, pa, pl, us]) => {
      setOverview(ov.data);
      setPendingWorkers(pw.data);
      setFraudUsers(fu.data);
      setFraudClaims(fc.data);
      setAllClaims(ac.data);
      setClaimAnalytics(ca.data);
      setPlatformAnalytics(pa.data);
      setPool(pl.data);
      setUsers(us.data.users || []);
      setLoading(false);
    });
  }, []);

  const verifyWorker = async (id, status) => {
    try {
      await api.put(`/admin/verify-worker/${id}`, { status });
      setPendingWorkers(w => w.filter(u => u._id !== id));
      toast.success(`Worker ${status}`);
      const ov = await api.get('/admin/overview');
      setOverview(ov.data);
    } catch { toast.error('Failed'); }
  };

  const claimAction = async (id, status) => {
    try {
      await api.put(`/admin/claim-action/${id}`, { status });
      setAllClaims(c => c.map(x => x._id === id ? { ...x, status } : x));
      toast.success(`Claim ${status}`);
    } catch { toast.error('Failed'); }
  };

  const exportML = async (fmt) => {
    try {
      const res = await api.get(`/analytics/ml-export?format=${fmt}`, { responseType: fmt === 'csv' ? 'blob' : 'json' });
      const blob = fmt === 'csv' ? res.data : new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `gigshield_training_data.${fmt}`; a.click();
    } catch { toast.error('Export failed'); }
  };

  if (loading) return <div className="p-6 text-sm" style={{ color: '#4B5563' }}>Loading admin data...</div>;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Admin Dashboard</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Platform management and analytics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportML('json')} className="btn-outline flex items-center gap-1.5 text-xs"><Download size={12} /> JSON</button>
          <button onClick={() => exportML('csv')}  className="btn-neon   flex items-center gap-1.5 text-xs" style={{ padding: '8px 14px' }}><Download size={12} /> CSV (ML)</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: '#111827' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
            style={{ background: tab === t ? 'linear-gradient(135deg,#3B82F6,#8B5CF6)' : 'transparent', color: tab === t ? '#fff' : '#6B7280' }}>
            {t}
            {t === 'Verification' && pendingWorkers.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{ background: '#EF4444', color: '#fff' }}>{pendingWorkers.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'Overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Users',       value: overview?.totalUsers,           icon: Users,         color: '#3B82F6' },
              { label: 'Pending Verify',    value: overview?.pendingVerification,  icon: Eye,           color: '#F59E0B' },
              { label: 'Active Policies',   value: overview?.activePolicies,       icon: FileText,      color: '#22C55E' },
              { label: 'Total Claims',      value: overview?.totalClaims,          icon: AlertTriangle, color: '#FACC15' },
              { label: 'Premiums Collected',value: `₹${overview?.totalPremiumCollection || 0}`, icon: DollarSign, color: '#8B5CF6' },
              { label: 'Total Payouts',     value: `₹${overview?.totalPayouts || 0}`, icon: TrendingUp, color: '#EF4444' },
              { label: 'Pool Available',    value: `₹${overview?.availablePool || 0}`, icon: Shield,    color: '#22C55E' },
              { label: 'Fraud Blocked',     value: overview?.fraudBlocked,         icon: Activity,      color: '#EF4444' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} style={{ color }} />
                  <p className="text-xs font-medium" style={{ color: '#6B7280' }}>{label}</p>
                </div>
                <p className="text-2xl font-bold text-white">{value ?? 0}</p>
              </div>
            ))}
          </div>

          {/* Insurance Pool */}
          {pool && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Insurance Pool</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Premiums',  value: `₹${pool.totalPremiumCollected}`, color: '#22C55E' },
                  { label: 'Claims Paid',     value: `₹${pool.totalClaimsPaid}`,       color: '#EF4444' },
                  { label: 'Available Pool',  value: `₹${pool.availablePool}`,         color: '#3B82F6' }
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-4 text-center" style={{ background: '#0B1220', border: `1px solid ${color}30` }}>
                    <p className="text-xs font-medium mb-1" style={{ color: '#6B7280' }}>{label}</p>
                    <p className="text-xl font-bold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
              {/* Pool health bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1" style={{ color: '#4B5563' }}>
                  <span>Pool Health</span>
                  <span>{pool.totalPremiumCollected > 0 ? Math.round((pool.availablePool / pool.totalPremiumCollected) * 100) : 100}%</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: '#1F2937' }}>
                  <div className="h-2 rounded-full transition-all" style={{
                    width: `${pool.totalPremiumCollected > 0 ? Math.round((pool.availablePool / pool.totalPremiumCollected) * 100) : 100}%`,
                    background: 'linear-gradient(90deg,#22C55E,#3B82F6)'
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Users table */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Recent Users</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1F2937' }}>
                    {['Name', 'Platform', 'Home', 'Work', 'Income', 'Verify', 'Fraud', 'Joined'].map(h => (
                      <th key={h} className="pb-2 text-left font-semibold" style={{ color: '#4B5563' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} style={{ borderBottom: '1px solid #111827' }}>
                      <td className="py-2 text-white font-medium">{u.name}</td>
                      <td className="py-2" style={{ color: '#9CA3AF' }}>{u.platform === 'Other' ? u.customPlatform : u.platform}</td>
                      <td className="py-2" style={{ color: '#9CA3AF' }}>{u.homeCity === 'Other' ? u.customHomeCity : (u.homeCity || u.location?.city)}</td>
                      <td className="py-2" style={{ color: '#9CA3AF' }}>{u.workCity === 'Other' ? u.customWorkCity : (u.workCity  || u.location?.city)}</td>
                      <td className="py-2" style={{ color: '#9CA3AF' }}>₹{u.weeklyIncome}</td>
                      <td className="py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${VERIFY_COLOR[u.verificationStatus]}20`, color: VERIFY_COLOR[u.verificationStatus] }}>
                          {u.verificationStatus}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${FRAUD_COLOR[u.fraudStatus]}20`, color: FRAUD_COLOR[u.fraudStatus] }}>
                          {u.fraudStatus}
                        </span>
                      </td>
                      <td className="py-2" style={{ color: '#4B5563' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Verification Tab ── */}
      {tab === 'Verification' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Eye size={16} style={{ color: '#F59E0B' }} />
            <h3 className="text-sm font-semibold text-white">Pending Worker Verification ({pendingWorkers.length})</h3>
          </div>
          {pendingWorkers.length === 0 ? (
            <div className="card p-8 text-center text-sm" style={{ color: '#4B5563' }}>No pending verifications</div>
          ) : (
            pendingWorkers.map(u => (
              <div key={u._id} className="card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-white">{u.name}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>{u.email} · {u.phone}</p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>
                      Platform: <span className="text-white">{u.platform === 'Other' ? u.customPlatform : u.platform}</span>
                      {' · '}Worker ID: <span className="text-white">{u.workerId}</span>
                    </p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>
                      Home: <span className="text-white">{u.homeCity === 'Other' ? u.customHomeCity : u.homeCity}</span>
                      {' · '}Work: <span className="text-white">{u.workCity === 'Other' ? u.customWorkCity : u.workCity}</span>
                    </p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>
                      Aadhaar: <span className="text-white">{u.aadhaarNumber || '—'}</span>
                      {u.idProofUrl && <span className="ml-2 text-blue-400">· ID Proof uploaded</span>}
                    </p>
                    <p className="text-xs" style={{ color: '#4B5563' }}>Registered: {new Date(u.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => verifyWorker(u._id, 'approved')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button onClick={() => verifyWorker(u._id, 'rejected')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Fraud Center ── */}
      {tab === 'Fraud Center' && (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Flagged Users ({fraudUsers.length})</h3>
            {fraudUsers.length === 0 ? (
              <div className="card p-6 text-center text-sm" style={{ color: '#4B5563' }}>No flagged users</div>
            ) : (
              <div className="space-y-3">
                {fraudUsers.map(u => (
                  <div key={u._id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-semibold text-white text-sm">{u.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{u.email} · {u.platform}</p>
                      {u.fraudReason && <p className="text-xs mt-1" style={{ color: '#F97316' }}>⚠ {u.fraudReason}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xs" style={{ color: '#4B5563' }}>Fraud Score</p>
                        <p className="text-lg font-bold" style={{ color: u.fraudScore > 60 ? '#EF4444' : '#F97316' }}>{u.fraudScore}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: `${FRAUD_COLOR[u.fraudStatus]}20`, color: FRAUD_COLOR[u.fraudStatus] }}>
                        {u.fraudStatus?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Suspicious Claims ({fraudClaims.length})</h3>
            {fraudClaims.length === 0 ? (
              <div className="card p-6 text-center text-sm" style={{ color: '#4B5563' }}>No suspicious claims</div>
            ) : (
              <div className="overflow-x-auto card p-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1F2937' }}>
                      {['User', 'Trigger', 'Amount', 'Fraud Score', 'Status'].map(h => (
                        <th key={h} className="pb-2 text-left font-semibold" style={{ color: '#4B5563' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fraudClaims.map(c => (
                      <tr key={c._id} style={{ borderBottom: '1px solid #111827' }}>
                        <td className="py-2 text-white">{c.userId?.name}</td>
                        <td className="py-2" style={{ color: '#9CA3AF' }}>{c.triggerType}</td>
                        <td className="py-2" style={{ color: '#9CA3AF' }}>₹{c.payoutAmount}</td>
                        <td className="py-2" style={{ color: '#EF4444', fontWeight: 'bold' }}>{c.fraudScore}</td>
                        <td className="py-2">
                          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>{c.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Claims Management ── */}
      {tab === 'Claims' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white">All Claims ({allClaims.length})</h3>
          {allClaims.length === 0 ? (
            <div className="card p-8 text-center text-sm" style={{ color: '#4B5563' }}>No claims yet</div>
          ) : (
            <div className="space-y-3">
              {allClaims.map(c => (
                <div key={c._id} className="card p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-white text-sm">{c.userId?.name}</p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>{c.userId?.email} · {c.userId?.platform}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>
                        {c.claimReason || c.triggerType} · {c.affectedCity}
                        {' · '}Expected: ₹{c.expectedIncome} · Actual: ₹{c.actualIncome}
                      </p>
                      <p className="text-xs font-semibold" style={{ color: '#22C55E' }}>Payout: ₹{c.payoutAmount}</p>
                      <p className="text-xs" style={{ color: '#4B5563' }}>{new Date(c.triggeredAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.fraudScore > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                          Fraud: {c.fraudScore}
                        </span>
                      )}
                      <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{
                        background: c.status === 'paid' ? 'rgba(34,197,94,0.1)' : c.status === 'pending' ? 'rgba(250,204,21,0.1)' : 'rgba(239,68,68,0.1)',
                        color: c.status === 'paid' ? '#22C55E' : c.status === 'pending' ? '#FACC15' : '#EF4444'
                      }}>{c.status.toUpperCase()}</span>
                      {c.status === 'pending' && (
                        <div className="flex gap-1">
                          <button onClick={() => claimAction(c._id, 'approved')}
                            className="p-1.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => claimAction(c._id, 'rejected')}
                            className="p-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                            <XCircle size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Analytics Tab ── */}
      {tab === 'Analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {claimAnalytics?.byTrigger?.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Claims by Trigger Type</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={claimAnalytics.byTrigger} barSize={28}>
                    <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TTStyle} />
                    <Bar dataKey="count" name="Claims" radius={[4, 4, 0, 0]}>
                      {claimAnalytics.byTrigger.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {claimAnalytics?.byStatus?.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Claim Status Distribution</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={claimAnalytics.byStatus} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={65}
                      label={({ _id, count }) => `${_id}: ${count}`}>
                      {claimAnalytics.byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TTStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {platformAnalytics.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Users by Platform</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={platformAnalytics} barSize={32}>
                    <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TTStyle} />
                    <Bar dataKey="count" name="Users" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {claimAnalytics?.byCityType?.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Claims: Home vs Work City</h3>
                <div className="flex gap-4 flex-wrap">
                  {claimAnalytics.byCityType.map((c, i) => (
                    <div key={c._id} className="flex-1 rounded-xl p-4 text-center" style={{ background: '#0B1220', border: '1px solid #1F2937', minWidth: 120 }}>
                      <p className="text-xs font-semibold uppercase mb-1" style={{ color: PIE_COLORS[i] }}>{c._id || 'Other'} City</p>
                      <p className="text-xl font-bold text-white">{c.count}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>₹{c.totalPayout} paid</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
