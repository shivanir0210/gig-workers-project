import { useEffect, useState } from 'react';
import api from '../api';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, FileText, AlertTriangle, DollarSign, TrendingUp, Activity, Download, CheckCircle, XCircle, Shield, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

const TTStyle    = { background:'#111827', border:'1px solid #1F2937', borderRadius:8, fontSize:11, color:'#E5E7EB' };
const PIE_COLORS = ['#22C55E','#3B82F6','#FACC15','#EF4444','#8B5CF6'];
const TABS       = ['Overview','Verification','Fraud','Claims','Analytics'];
const FRAUD_COLOR  = { safe:'#22C55E', review:'#3B82F6', suspicious:'#F97316', blocked:'#EF4444' };
const VERIFY_COLOR = { pending:'#FACC15', approved:'#22C55E', rejected:'#EF4444' };

export default function Admin({ tab: initialTab }) {
  const backendBase = api.defaults.baseURL.replace('/api', '');
  const tabMap = { overview:'Overview', verification:'Verification', fraud:'Fraud', claims:'Claims', analytics:'Analytics', users:'Overview', settings:'Overview' };
  const [tab, setTab] = useState(tabMap[initialTab] || 'Overview');
  const [overview,         setOverview]         = useState(null);
  const [pendingWorkers,   setPendingWorkers]   = useState([]);
  const [fraudUsers,       setFraudUsers]       = useState([]);
  const [fraudClaims,      setFraudClaims]      = useState([]);
  const [allClaims,        setAllClaims]        = useState([]);
  const [claimAnalytics,   setClaimAnalytics]   = useState(null);
  const [platformAnalytics,setPlatformAnalytics]= useState([]);
  const [pool,             setPool]             = useState(null);
  const [users,            setUsers]            = useState([]);
  const [adminStats,       setAdminStats]       = useState(null);
  const [loading,          setLoading]          = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/overview').catch(() => ({ data:null })),
      api.get('/admin/pending-workers').catch(() => ({ data:[] })),
      api.get('/admin/fraud-analysis').catch(() => ({ data:[] })),
      api.get('/admin/fraud-claims').catch(() => ({ data:[] })),
      api.get('/admin/all-claims').catch(() => ({ data:[] })),
      api.get('/admin/claim-analytics').catch(() => ({ data:null })),
      api.get('/admin/platform-analytics').catch(() => ({ data:[] })),
      api.get('/admin/pool').catch(() => ({ data:null })),
      api.get('/admin/users?limit=15').catch(() => ({ data:{ users:[] } })),
      api.get('/analytics/admin-stats').catch(() => ({ data:null }))
    ]).then(([ov,pw,fu,fc,ac,ca,pa,pl,us,ast]) => {
      setOverview(ov.data); setPendingWorkers(pw.data); setFraudUsers(fu.data);
      setFraudClaims(fc.data); setAllClaims(ac.data); setClaimAnalytics(ca.data);
      setPlatformAnalytics(pa.data); setPool(pl.data); setUsers(us.data.users||[]);
      setAdminStats(ast ? ast.data : null);
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

  const updateFraudStatus = async (userId, status, reason) => {
    try {
      await api.put(`/admin/update-fraud/${userId}`, { fraudStatus: status, fraudReason: reason });
      toast.success(`User marked as ${status}`);
      const fu = await api.get('/admin/fraud-analysis');
      setFraudUsers(fu.data);
      const ov = await api.get('/admin/overview');
      setOverview(ov.data);
    } catch { toast.error('Failed to update fraud status'); }
  };

  const claimAction = async (id, status) => {
    try {
      await api.put(`/admin/claim-action/${id}`, { status });
      setAllClaims(c => c.map(x => x._id===id?{...x,status}:x));
      toast.success(`Claim set to ${status}`);
      const ov = await api.get('/admin/overview');
      setOverview(ov.data);
    } catch { toast.error('Failed'); }
  };

  const exportML = async (fmt) => {
    try {
      const res = await api.get(`/analytics/ml-export?format=${fmt}`, { responseType:fmt==='csv'?'blob':'json' });
      const blob = fmt==='csv' ? res.data : new Blob([JSON.stringify(res.data,null,2)],{ type:'application/json' });
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `gigshield_training_data.${fmt}`; a.click();
    } catch { toast.error('Export failed'); }
  };

  if (loading) return <div className="p-4 text-sm" style={{ color:'#4B5563' }}>Loading admin data...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Admin Dashboard</h2>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'#6B7280' }}>Platform management</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>exportML('json')} className="btn-outline flex items-center gap-1 text-xs" style={{ minHeight:'36px' }}><Download size={11}/> JSON</button>
          <button onClick={()=>exportML('csv')}  className="btn-neon   flex items-center gap-1 text-xs" style={{ minHeight:'36px', padding:'8px 12px' }}><Download size={11}/> CSV</button>
        </div>
      </div>

      {/* Tabs — horizontal scroll on mobile */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background:'#111827' }}>
        {TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)}
            className="px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0"
            style={{ background:tab===t?'linear-gradient(135deg,#3B82F6,#8B5CF6)':'transparent', color:tab===t?'#fff':'#6B7280', minHeight:'36px' }}>
            {t}
            {t==='Verification'&&pendingWorkers.length>0&&(
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{ background:'#EF4444', color:'#fff' }}>{pendingWorkers.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab==='Overview' && (
        <div className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label:'Total Users',       value:overview?.totalUsers,          icon:Users,         color:'#3B82F6' },
              { label:'Pending Verify',    value:overview?.pendingVerification, icon:Eye,           color:'#F59E0B' },
              { label:'Active Policies',   value:overview?.activePolicies,      icon:FileText,      color:'#22C55E' },
              { label:'Total Claims',      value:overview?.totalClaims,         icon:AlertTriangle, color:'#FACC15' },
              { label:'Premiums',          value:`₹${overview?.totalPremiumCollection||0}`, icon:DollarSign, color:'#8B5CF6' },
              { label:'Payouts',           value:`₹${overview?.totalPayouts||0}`, icon:TrendingUp,  color:'#EF4444' },
              { label:'Pool',              value:`₹${overview?.availablePool||0}`, icon:Shield,     color:'#22C55E' },
              { label:'Fraud Blocked',     value:overview?.fraudBlocked,        icon:Activity,      color:'#EF4444' },
            ].map(({ label, value, icon:Icon, color }) => (
              <div key={label} className="stat-card">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon size={13} style={{ color }}/>
                  <p className="text-xs font-medium leading-tight" style={{ color:'#6B7280' }}>{label}</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-white">{value??0}</p>
              </div>
            ))}
          </div>

          {pool && (
            <div className="card p-4 sm:p-5">
              <h3 className="text-sm font-semibold text-white mb-3 sm:mb-4">Insurance Pool</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label:'Total Premiums', value:`₹${pool.totalPremiumCollected}`, color:'#22C55E' },
                  { label:'Claims Paid',    value:`₹${pool.totalClaimsPaid}`,       color:'#EF4444' },
                  { label:'Available',      value:`₹${pool.availablePool}`,         color:'#3B82F6' }
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl p-3 sm:p-4 text-center" style={{ background:'#0B1220', border:`1px solid ${color}30` }}>
                    <p className="text-xs font-medium mb-1" style={{ color:'#6B7280' }}>{label}</p>
                    <p className="text-lg sm:text-xl font-bold" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1" style={{ color:'#4B5563' }}>
                  <span>Pool Health</span>
                  <span>
                    {(() => {
                      const ratio = pool.totalPremiumCollected > 0 ? Math.round((pool.availablePool / pool.totalPremiumCollected) * 100) : 100;
                      const rating = ratio > 70 ? 'Excellent' : ratio > 45 ? 'Good' : ratio > 25 ? 'Moderate' : 'Critical';
                      return `${ratio}% (${rating})`;
                    })()}
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background:'#1F2937' }}>
                  <div className="h-2 rounded-full" style={{
                    width:`${pool.totalPremiumCollected > 0 ? Math.round((pool.availablePool / pool.totalPremiumCollected) * 100) : 100}%`,
                    background: pool.totalPremiumCollected > 0 && (pool.availablePool / pool.totalPremiumCollected) < 0.3 ? '#EF4444' : 'linear-gradient(90deg,#22C55E,#3B82F6)'
                  }}/>
                </div>
              </div>
            </div>
          )}

          {/* Users table — scrollable on mobile */}
          <div className="card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-white mb-3 sm:mb-4">Recent Users</h3>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-xs" style={{ minWidth:'540px' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #1F2937' }}>
                    {['Name','Platform','Home','Work','Income','Verify','Fraud','Joined'].map(h=>(
                      <th key={h} className="pb-2 text-left font-semibold whitespace-nowrap pr-3" style={{ color:'#4B5563' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} style={{ borderBottom:'1px solid #111827' }}>
                      <td className="py-2 text-white font-medium whitespace-nowrap pr-3">{u.name}</td>
                      <td className="py-2 whitespace-nowrap pr-3" style={{ color:'#9CA3AF' }}>{u.platform==='Other'?u.customPlatform:u.platform}</td>
                      <td className="py-2 whitespace-nowrap pr-3" style={{ color:'#9CA3AF' }}>{u.homeCity==='Other'?u.customHomeCity:(u.homeCity||u.location?.city)}</td>
                      <td className="py-2 whitespace-nowrap pr-3" style={{ color:'#9CA3AF' }}>{u.workCity==='Other'?u.customWorkCity:(u.workCity||u.location?.city)}</td>
                      <td className="py-2 whitespace-nowrap pr-3" style={{ color:'#9CA3AF' }}>₹{u.weeklyIncome}</td>
                      <td className="py-2 whitespace-nowrap pr-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background:`${VERIFY_COLOR[u.verificationStatus]||'#6B7280'}20`, color:VERIFY_COLOR[u.verificationStatus]||'#6B7280' }}>
                          {u.verificationStatus}
                        </span>
                      </td>
                      <td className="py-2 whitespace-nowrap pr-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background:`${FRAUD_COLOR[u.fraudStatus]||'#6B7280'}20`, color:FRAUD_COLOR[u.fraudStatus]||'#6B7280' }}>
                          {u.fraudStatus}
                        </span>
                      </td>
                      <td className="py-2 whitespace-nowrap" style={{ color:'#4B5563' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Verification */}
      {tab==='Verification' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2">
            <Eye size={15} style={{ color:'#F59E0B' }}/>
            <h3 className="text-sm font-semibold text-white">Pending ({pendingWorkers.length})</h3>
          </div>
          {pendingWorkers.length===0 ? (
            <div className="card p-8 text-center text-sm" style={{ color:'#4B5563' }}>No pending verifications</div>
          ) : pendingWorkers.map(u => (
            <div key={u._id} className="card p-4 sm:p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="font-semibold text-white">{u.name}</p>
                  <p className="text-xs truncate" style={{ color:'#9CA3AF' }}>{u.email} · {u.phone}</p>
                  <p className="text-xs" style={{ color:'#6B7280' }}>
                    {u.platform==='Other'?u.customPlatform:u.platform} · ID: {u.workerId}
                  </p>
                  <p className="text-xs" style={{ color:'#6B7280' }}>
                    Home: {u.homeCity==='Other'?u.customHomeCity:u.homeCity} · Work: {u.workCity==='Other'?u.customWorkCity:u.workCity}
                  </p>
                  <p className="text-xs" style={{ color:'#6B7280' }}>Aadhaar: {u.aadhaarNumber||'—'}</p>
                  
                  {/* Verification document uploads */}
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {u.aadhaarCardUrl ? (
                      <a href={`${backendBase}${u.aadhaarCardUrl}`} target="_blank" rel="noreferrer" 
                        className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20">
                        View Aadhaar Card
                      </a>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20">Aadhaar Missing</span>
                    )}
                    {u.workerIdCardUrl ? (
                      <a href={`${backendBase}${u.workerIdCardUrl}`} target="_blank" rel="noreferrer" 
                        className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20">
                        View Worker ID
                      </a>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20">Worker ID Missing</span>
                    )}
                    {u.platformScreenshotUrl ? (
                      <a href={`${backendBase}${u.platformScreenshotUrl}`} target="_blank" rel="noreferrer" 
                        className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20">
                        View Profile Screen
                      </a>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20">Screenshot Missing</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  <button onClick={()=>verifyWorker(u._id,'approved')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={{ minHeight:'40px', background:'rgba(34,197,94,0.15)', color:'#22C55E', border:'1px solid rgba(34,197,94,0.3)' }}>
                    <CheckCircle size={12}/> Approve
                  </button>
                  <button onClick={()=>verifyWorker(u._id,'rejected')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold" style={{ minHeight:'40px', background:'rgba(239,68,68,0.15)', color:'#EF4444', border:'1px solid rgba(239,68,68,0.3)' }}>
                    <XCircle size={12}/> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fraud Center */}
      {tab==='Fraud' && (
        <div className="space-y-4 sm:space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Flagged Users ({fraudUsers.length})</h3>
            {fraudUsers.length===0 ? (
              <div className="card p-6 text-center text-sm" style={{ color:'#4B5563' }}>No flagged users</div>
            ) : (
              <div className="space-y-3">
                {fraudUsers.map(u => (
                  <div key={u._id} className="card p-4 flex items-start justify-between flex-wrap gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold text-white text-sm">{u.name}</p>
                      <p className="text-xs truncate" style={{ color:'#9CA3AF' }}>{u.email} &middot; {u.platform}</p>
                      {u.phone && <p className="text-[11px]" style={{ color: '#4B5563' }}>Phone: {u.phone} {u.workerId && `· Worker ID: ${u.workerId}`}</p>}
                      {u.fraudReason && <p className="text-xs mt-1 text-orange-400">⚠ {u.fraudReason}</p>}
                      
                      {/* Action buttons */}
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {u.fraudStatus !== 'safe' && (
                          <button onClick={() => updateFraudStatus(u._id, 'safe', 'Dismissed by admin')}
                            className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 font-bold transition">
                            Dismiss / Safe
                          </button>
                        )}
                        {u.fraudStatus !== 'review' && (
                          <button onClick={() => updateFraudStatus(u._id, 'review', 'Anomalies under investigation')}
                            className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 font-bold transition">
                            Investigate
                          </button>
                        )}
                        {u.fraudStatus !== 'blocked' && (
                          <button onClick={() => updateFraudStatus(u._id, 'blocked', 'Blocked due to policy breach / duplicates')}
                            className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-bold transition">
                            Block User
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-center">
                        <p className="text-xs" style={{ color:'#4B5563' }}>Score</p>
                        <p className="text-lg font-bold" style={{ color:u.fraudScore>60?'#EF4444':'#F97316' }}>{u.fraudScore}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background:`${FRAUD_COLOR[u.fraudStatus]}20`, color:FRAUD_COLOR[u.fraudStatus] }}>
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
            {fraudClaims.length===0 ? (
              <div className="card p-6 text-center text-sm" style={{ color:'#4B5563' }}>No suspicious claims</div>
            ) : (
              <div className="overflow-x-auto card p-4">
                <table className="w-full text-xs" style={{ minWidth:'400px' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid #1F2937' }}>
                      {['User','Trigger','Amount','Fraud Score','Status'].map(h=>(
                        <th key={h} className="pb-2 text-left font-semibold pr-3" style={{ color:'#4B5563' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fraudClaims.map(c => (
                      <tr key={c._id} style={{ borderBottom:'1px solid #111827' }}>
                        <td className="py-2 text-white pr-3">{c.userId?.name}</td>
                        <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>{c.triggerType}</td>
                        <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>₹{c.payoutAmount}</td>
                        <td className="py-2 pr-3 font-bold" style={{ color:'#EF4444' }}>{c.fraudScore}</td>
                        <td className="py-2"><span className="px-2 py-0.5 rounded-full text-xs" style={{ background:'rgba(239,68,68,0.1)', color:'#EF4444' }}>{c.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Claims Management */}
      {tab==='Claims' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">All Claims ({allClaims.length})</h3>
          {allClaims.length===0 ? (
            <div className="card p-8 text-center text-sm" style={{ color:'#4B5563' }}>No claims yet</div>
          ) : allClaims.map(c => (
            <div key={c._id} className="card p-3 sm:p-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div>
                    <p className="font-semibold text-white text-sm">{c.userId?.name || 'Unknown Worker'}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Claim ID: {c._id}</p>
                  </div>
                  
                  <p className="text-xs truncate" style={{ color:'#9CA3AF' }}>{c.userId?.email}</p>
                  <p className="text-xs" style={{ color:'#6B7280' }}>
                    <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px]">{c.triggerType}</span> &middot; {c.affectedCity}
                  </p>
                  <p className="text-xs font-semibold" style={{ color:'#22C55E' }}>Payout Target: ₹{c.payoutAmount}</p>

                  {/* Expected / Actual Loss Details Widget */}
                  <div className="grid grid-cols-3 gap-2 p-2 rounded-xl text-center" style={{ background: '#0B1220', border: '1px solid #1F2937', maxWidth: '380px' }}>
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-semibold">Expected Income</p>
                      <p className="text-xs font-bold text-gray-200">₹{c.expectedIncome || c.userId?.averageDailyIncome || 0}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-semibold">Actual Income</p>
                      <p className="text-xs font-bold text-gray-200">₹{c.actualIncome || 0}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-500 uppercase font-semibold">Income Loss</p>
                      <p className="text-xs font-bold text-red-400">₹{c.actualIncomeLoss || Math.max(0, (c.expectedIncome || c.userId?.averageDailyIncome || 0) - (c.actualIncome || 0))}</p>
                    </div>
                  </div>

                  <p className="text-[10px]" style={{ color:'#4B5563' }}>{new Date(c.triggeredAt).toLocaleString()}</p>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {c.fraudScore>0&&<span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background:'rgba(239,68,68,0.1)', color:'#EF4444' }}>Fraud Score: {c.fraudScore}</span>}
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold"
                    style={{
                      background: c.status==='paid' || c.status==='approved' ? 'rgba(34,197,94,0.1)' : c.status==='pending' ? 'rgba(250,204,21,0.1)' : c.status==='investigating' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                      color: c.status==='paid' || c.status==='approved' ? '#22C55E' : c.status==='pending' ? '#FACC15' : c.status==='investigating' ? '#3B82F6' : '#EF4444'
                    }}>
                    {c.status.toUpperCase()}
                  </span>

                  {(c.status==='pending' || c.status==='investigating') && (
                    <div className="flex gap-1">
                      <button onClick={()=>claimAction(c._id,'approved')} className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)', minHeight: '36px' }}>
                        Approve
                      </button>
                      <button onClick={()=>claimAction(c._id,'rejected')} className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', minHeight: '36px' }}>
                        Reject
                      </button>
                      {c.status !== 'investigating' && (
                        <button onClick={()=>claimAction(c._id,'investigating')} className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                          style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)', minHeight: '36px' }}>
                          Investigate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analytics */}
      {tab==='Analytics' && (
        <div className="space-y-5">
          
          {/* Premium Analytics Charts */}
          {adminStats?.premium && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              <div className="card p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-white mb-2">Premium Collected (Daily)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={adminStats.premium.daily} barSize={24}>
                    <XAxis dataKey="_id" tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={TTStyle}/>
                    <Bar dataKey="total" name="Collected (₹)" fill="#3B82F6" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-white mb-2">Premium Collected (Weekly)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={adminStats.premium.weekly} barSize={24}>
                    <XAxis dataKey="_id" tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={TTStyle}/>
                    <Bar dataKey="total" name="Collected (₹)" fill="#8B5CF6" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-white mb-2">Premium Collected (Monthly)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={adminStats.premium.monthly} barSize={24}>
                    <XAxis dataKey="_id" tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={TTStyle}/>
                    <Bar dataKey="total" name="Collected (₹)" fill="#22C55E" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-white mb-2">Premium Collected (Yearly)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={adminStats.premium.yearly} barSize={24}>
                    <XAxis dataKey="_id" tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={TTStyle}/>
                    <Bar dataKey="total" name="Collected (₹)" fill="#EF4444" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Risk Analytics Hotspots */}
          {adminStats?.risk && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* High Risk Cities */}
              <div className="card p-4 space-y-2">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wide">High Risk Cities</h4>
                {adminStats.risk.highRiskCities.length === 0 ? (
                  <p className="text-xs text-gray-500 py-1">No active high risk cities.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {adminStats.risk.highRiskCities.map(c => (
                      <li key={c._id} className="flex justify-between text-gray-300 py-0.5 border-b border-gray-800/40">
                        <span>{c._id}</span>
                        <span className="font-semibold text-red-400 capitalize">{c.latestDisruption}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Flood Zones */}
              <div className="card p-4 space-y-2">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide">Flood Zones (&gt;50mm)</h4>
                {adminStats.risk.floodZones.length === 0 ? (
                  <p className="text-xs text-gray-500 py-1">No active flood warnings.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {adminStats.risk.floodZones.map(c => (
                      <li key={c._id} className="flex justify-between text-gray-300 py-0.5 border-b border-gray-800/40">
                        <span>{c._id}</span>
                        <span className="font-semibold text-blue-400">{c.latestRainfall} mm</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* AQI Hotspots */}
              <div className="card p-4 space-y-2">
                <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wide">AQI Hotspots (&gt;200)</h4>
                {adminStats.risk.aqiHotspots.length === 0 ? (
                  <p className="text-xs text-gray-500 py-1">All cities have safe air quality.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {adminStats.risk.aqiHotspots.map(c => (
                      <li key={c._id} className="flex justify-between text-gray-300 py-0.5 border-b border-gray-800/40">
                        <span>{c._id}</span>
                        <span className="font-semibold text-yellow-400">AQI {c.latestAqi}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </div>
          )}

          {/* Trigger and Platform Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {claimAnalytics?.byTrigger?.length>0&&(
              <div className="card p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Claims by Trigger</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={claimAnalytics.byTrigger} barSize={24}>
                    <XAxis dataKey="_id" tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={TTStyle}/>
                    <Bar dataKey="count" name="Claims" radius={[4,4,0,0]}>{claimAnalytics.byTrigger.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            
            {platformAnalytics.length>0&&(
              <div className="card p-4 sm:p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Users by Platform</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={platformAnalytics} barSize={28}>
                    <XAxis dataKey="_id" tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <YAxis tick={{ fontSize:10, fill:'#4B5563' }} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={TTStyle}/>
                    <Bar dataKey="count" name="Users" fill="#8B5CF6" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
