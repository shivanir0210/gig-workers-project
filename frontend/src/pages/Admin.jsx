import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, FileText, AlertTriangle, DollarSign, TrendingUp, Activity, Download, CheckCircle, XCircle, Shield, Eye, Search, Filter, RefreshCw, Bell, Cloud, Wind, CreditCard, Settings as SettingsIcon, Flag, ClipboardList, ShieldCheck, Trash2, Send, PlusCircle, Pencil, UserCheck, UserX } from 'lucide-react';
import toast from 'react-hot-toast';

const TTStyle    = { background:'#111827', border:'1px solid #1F2937', borderRadius:8, fontSize:11, color:'#E5E7EB' };
const PIE_COLORS = ['#22C55E','#3B82F6','#FACC15','#EF4444','#8B5CF6'];
const TABS       = ['Overview','Verification','Workers','Policies','Claims','Payments','Notifications','Weather','AQI','Analytics','Fraud','Reports','Settings'];
const FRAUD_COLOR  = { safe:'#22C55E', review:'#3B82F6', suspicious:'#F97316', blocked:'#EF4444' };
const VERIFY_COLOR = { pending:'#FACC15', approved:'#22C55E', rejected:'#EF4444' };

export default function Admin({ tab: initialTab }) {
  const backendBase = api.defaults.baseURL.replace('/api', '');
  const tabMap = { overview:'Overview', workers:'Workers', verification:'Verification', fraud:'Fraud', claims:'Claims', policies:'Policies', payments:'Payments', weather:'Weather', aqi:'AQI', notifications:'Notifications', analytics:'Analytics', reports:'Reports', settings:'Settings', users:'Overview' };
  const [tab, setTab] = useState(tabMap[initialTab] || 'Overview');
  const [overview,         setOverview]         = useState(null);

  useEffect(() => {
    setTab(tabMap[initialTab] || 'Overview');
  }, [initialTab]);
  const [pendingWorkers,   setPendingWorkers]   = useState([]);
  const [fraudUsers,       setFraudUsers]       = useState([]);
  const [fraudClaims,      setFraudClaims]      = useState([]);
  const [allClaims,        setAllClaims]        = useState([]);
  const [claimAnalytics,   setClaimAnalytics]   = useState(null);
  const [platformAnalytics,setPlatformAnalytics]= useState([]);
  const [pool,             setPool]             = useState(null);
  const [users,            setUsers]            = useState([]);
  const [policies,         setPolicies]         = useState([]);
  const [payments,         setPayments]         = useState([]);
  const [weatherData,      setWeatherData]      = useState([]);
  const [notifications,    setNotifications]    = useState([]);
  const [reports,          setReports]          = useState({ workers: [], claims: [], payments: [] });
  const [adminStats,       setAdminStats]       = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [workerSearch,     setWorkerSearch]     = useState('');
  const [workerCity,       setWorkerCity]       = useState('');
  const [workerPlatform,   setWorkerPlatform]   = useState('');
  const [policySearch,     setPolicySearch]     = useState('');
  const [policyStatus,     setPolicyStatus]     = useState('');
  const [notifForm,        setNotifForm]        = useState({ userId: '', title: '', message: '', type: 'admin', priority: 'medium' });
  const [broadcastForm,    setBroadcastForm]   = useState({ title: '', message: '', type: 'admin', priority: 'medium' });
  const [selectedWorker,   setSelectedWorker]   = useState(null);
  const [selectedClaim,    setSelectedClaim]    = useState(null);
  const [selectedPolicy,   setSelectedPolicy]   = useState(null);
  const [premiumHistory,   setPremiumHistory]   = useState([]);
  const [claimHistory,     setClaimHistory]     = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ov,pw,fu,fc,ac,ca,pa,pl,us,pol,pay,wt,not,ast] = await Promise.all([
          api.get('/admin/overview').catch(() => ({ data:null })),
          api.get('/admin/pending-workers').catch(() => ({ data:[] })),
          api.get('/admin/fraud-analysis').catch(() => ({ data:[] })),
          api.get('/admin/fraud-claims').catch(() => ({ data:[] })),
          api.get('/admin/all-claims').catch(() => ({ data:[] })),
          api.get('/admin/claim-analytics').catch(() => ({ data:null })),
          api.get('/admin/platform-analytics').catch(() => ({ data:[] })),
          api.get('/admin/pool').catch(() => ({ data:null })),
          api.get('/admin/users?limit=20').catch(() => ({ data:{ users:[] } })),
          api.get('/admin/policies').catch(() => ({ data:[] })),
          api.get('/admin/payments?limit=20').catch(() => ({ data:{ payments:[] } })),
          api.get('/admin/weather').catch(() => ({ data:[] })),
          api.get('/admin/notifications?limit=20').catch(() => ({ data:{ notifications:[] } })),
          api.get('/analytics/admin-stats').catch(() => ({ data:null }))
        ]);
        console.log('[ADMIN] /admin/users response', us.data);
        setOverview(ov.data); setPendingWorkers(pw.data); setFraudUsers(fu.data);
        setFraudClaims(fc.data); setAllClaims(ac.data); setClaimAnalytics(ca.data);
        setPlatformAnalytics(pa.data); setPool(pl.data); setUsers(us.data.users||[]);
        console.log('[ADMIN] workers setUsers length', (us.data.users||[]).length);
        setPolicies(pol.data || []); setPayments(pay.data.payments || []); setWeatherData(wt.data || []);
        setNotifications(not.data.notifications || []); setAdminStats(ast ? ast.data : null);
      } catch {
        toast.error('Unable to load admin dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
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

  const exportReport = async (type) => {
    try {
      const res = await api.get(`/admin/reports/${type}`, { responseType: 'blob' });
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(res.data);
      a.download = `${type}.csv`;
      a.click();
    } catch { toast.error('Report export failed'); }
  };

  const refreshDashboard = async () => {
    setLoading(true);
    try {
      const [ov,pw,fu,fc,ac,ca,pa,pl,us,pol,pay,wt,not] = await Promise.all([
        api.get('/admin/overview').catch(() => ({ data:null })),
        api.get('/admin/pending-workers').catch(() => ({ data:[] })),
        api.get('/admin/fraud-analysis').catch(() => ({ data:[] })),
        api.get('/admin/fraud-claims').catch(() => ({ data:[] })),
        api.get('/admin/all-claims').catch(() => ({ data:[] })),
        api.get('/admin/claim-analytics').catch(() => ({ data:null })),
        api.get('/admin/platform-analytics').catch(() => ({ data:[] })),
        api.get('/admin/pool').catch(() => ({ data:null })),
        api.get('/admin/users?limit=20').catch(() => ({ data:{ users:[] } })),
        api.get('/admin/policies').catch(() => ({ data:[] })),
        api.get('/admin/payments?limit=20').catch(() => ({ data:{ payments:[] } })),
        api.get('/admin/weather').catch(() => ({ data:[] })),
        api.get('/admin/notifications?limit=20').catch(() => ({ data:{ notifications:[] } }))
      ]);
      setOverview(ov.data); setPendingWorkers(pw.data); setFraudUsers(fu.data); setFraudClaims(fc.data); setAllClaims(ac.data); setClaimAnalytics(ca.data);
      setPlatformAnalytics(pa.data); setPool(pl.data); setUsers(us.data.users||[]); setPolicies(pol.data || []); setPayments(pay.data.payments || []); setWeatherData(wt.data || []); setNotifications(not.data.notifications || []);
      toast.success('Dashboard refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally {
      setLoading(false);
    }
  };

  const updateWorker = async (id, patch) => {
    try {
      await api.put(`/admin/users/${id}`, patch);
      setUsers(list => list.map(u => u._id === id ? { ...u, ...patch } : u));
      toast.success('Worker updated');
    } catch { toast.error('Failed to update worker'); }
  };

  const toggleWorkerStatus = async (id, status) => {
    try {
      await api.put(status ? `/admin/users/${id}/activate` : `/admin/users/${id}/suspend`);
      setUsers(list => list.map(u => u._id === id ? { ...u, isActive: status } : u));
      toast.success(status ? 'Worker activated' : 'Worker suspended');
    } catch { toast.error('Failed to update worker status'); }
  };

  const deleteWorker = async (id) => {
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(list => list.filter(u => u._id !== id));
      toast.success('Worker deleted');
    } catch { toast.error('Failed to delete worker'); }
  };

  const updatePolicyStatus = async (id, status) => {
    try {
      await api.put(`/admin/policies/${id}/status`, { status });
      setPolicies(list => list.map(p => p._id === id ? { ...p, status } : p));
      toast.success(`Policy ${status}`);
    } catch { toast.error('Failed to update policy'); }
  };

  const sendNotification = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/notifications/send', notifForm);
      setNotifForm({ userId: '', title: '', message: '', type: 'admin', priority: 'medium' });
      toast.success('Notification sent');
    } catch { toast.error('Failed to send notification'); }
  };

  const broadcastNotification = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/notifications/broadcast', broadcastForm);
      setBroadcastForm({ title: '', message: '', type: 'admin', priority: 'medium' });
      toast.success('Broadcast sent');
    } catch { toast.error('Failed to broadcast'); }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/admin/notifications/${id}`);
      setNotifications(list => list.filter(n => n._id !== id));
      toast.success('Notification deleted');
    } catch { toast.error('Failed to delete notification'); }
  };

  const openWorkerDetails = async (worker) => {
    try {
      const res = await api.get(`/admin/users/${worker._id}`);
      setSelectedWorker(res.data);
      const premiumRes = await api.get(`/admin/users/${worker._id}/premium-history`);
      setPremiumHistory(premiumRes.data || []);
    } catch { toast.error('Unable to load worker details'); }
  };

  const openClaimDetails = async (claim) => {
    try {
      const res = await api.get(`/admin/claims/${claim._id}/history`);
      setSelectedClaim({ claim, history: res.data || [] });
    } catch { toast.error('Unable to load claim history'); }
  };

  const openPolicyDetails = async (policy) => {
    setSelectedPolicy(policy);
  };

  const filteredWorkers = useMemo(() => {
    const filtered = users.filter(u => {
      const q = workerSearch.toLowerCase();
      const matchesSearch = !q || [u.name, u.email, u.phone, u.workerId, u.homeCity, u.workCity, u.location?.homeCity, u.location?.workCity, u.location?.city].filter(Boolean).join(' ').toLowerCase().includes(q);
      const matchesCity = !workerCity || [u.homeCity, u.workCity, u.customHomeCity, u.customWorkCity, u.location?.homeCity, u.location?.workCity, u.location?.city].filter(Boolean).join(' ').toLowerCase().includes(workerCity.toLowerCase());
      const matchesPlatform = !workerPlatform || (u.platform || '').toLowerCase() === workerPlatform.toLowerCase();
      return matchesSearch && matchesCity && matchesPlatform;
    });
    console.log('[ADMIN] filteredWorkers count', filtered.length, 'from users', users.length);
    return filtered;
  }, [users, workerSearch, workerCity, workerPlatform]);

  const filteredPolicies = useMemo(() => policies.filter(p => {
    const q = policySearch.toLowerCase();
    const matchesSearch = !q || [p.planName, p.userId?.name, p.userId?.email].filter(Boolean).join(' ').toLowerCase().includes(q);
    const matchesStatus = !policyStatus || p.status === policyStatus;
    return matchesSearch && matchesStatus;
  }), [policies, policySearch, policyStatus]);

  if (loading) return <div className="p-4 text-sm" style={{ color:'#4B5563' }}>Loading admin data...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Admin Dashboard</h2>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'#6B7280' }}>Secure portal for GigShield administration</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={refreshDashboard} className="btn-outline flex items-center gap-1 text-xs" style={{ minHeight:'36px' }}><RefreshCw size={11}/> Refresh</button>
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
              { label:'Total Registered Workers', value:overview?.totalUsers ?? users.length, icon:Users, color:'#3B82F6' },
              { label:'Active Policies', value:overview?.activePolicies ?? policies.filter(p=>p.status==='active').length, icon:FileText, color:'#22C55E' },
              { label:'Inactive Policies', value:policies.filter(p=>p.status!=='active').length, icon:Shield, color:'#F59E0B' },
              { label:'Total Claims Submitted', value:overview?.totalClaims ?? allClaims.length, icon:AlertTriangle, color:'#FACC15' },
              { label:'Claims Approved', value:allClaims.filter(c=>['approved','paid'].includes(c.status)).length, icon:CheckCircle, color:'#22C55E' },
              { label:'Claims Rejected', value:allClaims.filter(c=>c.status==='rejected').length, icon:XCircle, color:'#EF4444' },
              { label:'Total Premium Collected', value:`₹${overview?.totalPremiumCollection || 0}`, icon:DollarSign, color:'#8B5CF6' },
              { label:'Total Payout Amount', value:`₹${overview?.totalPayouts || 0}`, icon:TrendingUp, color:'#EF4444' },
              { label:'High Risk Cities', value:weatherData.filter(w=>['high','extreme'].includes(w.disruptionLevel)).length, icon:Activity, color:'#F97316' },
              { label:"Today's Weather Alerts", value:weatherData.filter(w=>w.disruptionLevel!=='none').length, icon:Cloud, color:'#3B82F6' },
              { label:"Today's AQI Alerts", value:weatherData.filter(w=>w.aqi>150).length, icon:Wind, color:'#FACC15' },
              { label:'Pending Notifications', value:notifications.filter(n=>!n.isRead).length, icon:Bell, color:'#8B5CF6' },
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

      {/* Workers */}
      {tab==='Workers' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-white">Worker Management</h3>
                <p className="text-xs" style={{ color:'#6B7280' }}>Search, filter, verify, suspend, activate and manage worker accounts.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-xs" style={{ color:'#9CA3AF' }}>
                <span className="mb-1 block">Search</span>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background:'#0B1220', border:'1px solid #1F2937' }}>
                  <Search size={13} />
                  <input value={workerSearch} onChange={(e)=>setWorkerSearch(e.target.value)} placeholder="Name, email or ID" className="bg-transparent outline-none w-full text-sm" />
                </div>
              </label>
              <label className="text-xs" style={{ color:'#9CA3AF' }}>
                <span className="mb-1 block">City</span>
                <input value={workerCity} onChange={(e)=>setWorkerCity(e.target.value)} placeholder="City" className="w-full rounded-xl px-3 py-2 text-sm" style={{ background:'#0B1220', border:'1px solid #1F2937' }} />
              </label>
              <label className="text-xs" style={{ color:'#9CA3AF' }}>
                <span className="mb-1 block">Platform</span>
                <select value={workerPlatform} onChange={(e)=>setWorkerPlatform(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm" style={{ background:'#0B1220', border:'1px solid #1F2937' }}>
                  <option value="">All Platforms</option>
                  <option value="Swiggy">Swiggy</option>
                  <option value="Zomato">Zomato</option>
                  <option value="Zepto">Zepto</option>
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto card p-3">
            <table className="w-full text-xs min-w-[780px]">
              <thead>
                <tr style={{ borderBottom:'1px solid #1F2937' }}>
                  {['Worker ID','Name','Mobile','Email','Home City','Work City','Platform','Trust Score','Verification','Weekly Premium','Risk Level','Actions'].map(h=> <th key={h} className="pb-2 text-left pr-3" style={{ color:'#4B5563' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.map(u => (
                  <tr key={u._id} style={{ borderBottom:'1px solid #111827' }}>
                    <td className="py-2 pr-3 text-white">{u.workerId || '—'}</td>
                    <td className="py-2 pr-3 text-white">{u.name}</td>
                    <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>{u.phone}</td>
                    <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>{u.email}</td>
                    <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>{u.homeCity || u.customHomeCity || u.location?.homeCity || '—'}</td>
                    <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>{u.workCity || u.customWorkCity || u.location?.workCity || '—'}</td>
                    <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>{u.platform}</td>
                    <td className="py-2 pr-3" style={{ color:'#FACC15' }}>{u.trustScore ?? 100}</td>
                    <td className="py-2 pr-3"><span className="px-2 py-1 rounded-full text-[10px]" style={{ background:`${VERIFY_COLOR[u.verificationStatus]||'#6B7280'}20`, color:VERIFY_COLOR[u.verificationStatus]||'#6B7280' }}>{u.verificationStatus || 'unknown'}</span></td>
                    <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>₹{u.weeklyPremium ?? 0}</td>
                    <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>{u.riskLevel || 'medium'}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => openWorkerDetails(u)} className="p-1.5 rounded-lg" style={{ background:'#111827', color:'#3B82F6' }}><Eye size={12}/></button>
                        <button onClick={() => updateWorker(u._id, { verificationStatus: u.verificationStatus === 'approved' ? 'pending' : 'approved' })} className="p-1.5 rounded-lg" style={{ background:'#111827', color:'#22C55E' }}><UserCheck size={12}/></button>
                        <button onClick={() => toggleWorkerStatus(u._id, !u.isActive)} className="p-1.5 rounded-lg" style={{ background:'#111827', color:'#FACC15' }}>{u.isActive ? <UserX size={12}/> : <UserCheck size={12}/>}</button>
                        <button onClick={() => deleteWorker(u._id)} className="p-1.5 rounded-lg" style={{ background:'#111827', color:'#EF4444' }}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredWorkers.length === 0 && (
              <div className="p-4 text-sm text-gray-400">No workers found. Try clearing the search or filters.</div>
            )}
          </div>
          {selectedWorker && (
            <div className="card p-4 space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Worker Profile</h3>
                  <p className="text-xs" style={{ color:'#6B7280' }}>{selectedWorker.user?.name || selectedWorker.user?.email}</p>
                </div>
                <button onClick={() => setSelectedWorker(null)} className="text-xs" style={{ color:'#6B7280' }}>Close</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl p-3" style={{ background:'#0B1220', border:'1px solid #1F2937' }}>
                  <p className="text-[10px] uppercase" style={{ color:'#4B5563' }}>Personal</p>
                  <p className="text-white mt-1">{selectedWorker.user?.name}</p>
                  <p style={{ color:'#9CA3AF' }}>{selectedWorker.user?.email}</p>
                  <p style={{ color:'#9CA3AF' }}>{selectedWorker.user?.phone}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background:'#0B1220', border:'1px solid #1F2937' }}>
                  <p className="text-[10px] uppercase" style={{ color:'#4B5563' }}>Policy / Risk</p>
                  <p className="text-white mt-1">Trust Score: {selectedWorker.user?.trustScore ?? 100}</p>
                  <p style={{ color:'#9CA3AF' }}>Verification: {selectedWorker.user?.verificationStatus}</p>
                  <p style={{ color:'#9CA3AF' }}>Fraud: {selectedWorker.user?.fraudStatus}</p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white mb-2">Premium History</h4>
                <div className="space-y-2">
                  {premiumHistory.length === 0 ? <p className="text-xs" style={{ color:'#6B7280' }}>No premium history yet.</p> : premiumHistory.map(item => (
                    <div key={item._id} className="flex items-center justify-between rounded-xl px-3 py-2 text-xs" style={{ background:'#0B1220', border:'1px solid #1F2937' }}>
                      <span style={{ color:'#9CA3AF' }}>{new Date(item.generatedDate).toLocaleDateString()}</span>
                      <span className="text-white">₹{item.premiumAmount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Policies */}
      {tab==='Policies' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-white">Policy Management</h3>
                <p className="text-xs" style={{ color:'#6B7280' }}>Activate, deactivate and inspect policy details.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs" style={{ color:'#9CA3AF' }}>
                <span className="mb-1 block">Search</span>
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background:'#0B1220', border:'1px solid #1F2937' }}>
                  <Search size={13} />
                  <input value={policySearch} onChange={(e)=>setPolicySearch(e.target.value)} placeholder="Worker name or email" className="bg-transparent outline-none w-full text-sm" />
                </div>
              </label>
              <label className="text-xs" style={{ color:'#9CA3AF' }}>
                <span className="mb-1 block">Status</span>
                <select value={policyStatus} onChange={(e)=>setPolicyStatus(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm" style={{ background:'#0B1220', border:'1px solid #1F2937' }}>
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
            </div>
          </div>
          <div className="grid gap-3">
            {filteredPolicies.map(p => (
              <div key={p._id} className="card p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{p.planName}</h4>
                    <p className="text-xs" style={{ color:'#6B7280' }}>{p.userId?.name} · {p.userId?.email}</p>
                    <p className="text-xs mt-1" style={{ color:'#9CA3AF' }}>Coverage: ₹{p.coverageAmount} · Premium: ₹{p.weeklyPremium}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openPolicyDetails(p)} className="px-2.5 py-1.5 rounded-lg text-xs" style={{ background:'#111827', color:'#3B82F6' }}>View</button>
                    <button onClick={() => updatePolicyStatus(p._id, p.status === 'active' ? 'cancelled' : 'active')} className="px-2.5 py-1.5 rounded-lg text-xs" style={{ background:'#111827', color:'#22C55E' }}>{p.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {selectedPolicy && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-white">Policy Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-sm">
                <div className="rounded-xl p-3" style={{ background:'#0B1220', border:'1px solid #1F2937' }}>
                  <p className="text-[10px] uppercase" style={{ color:'#4B5563' }}>Plan</p>
                  <p className="text-white mt-1">{selectedPolicy.planName}</p>
                  <p style={{ color:'#9CA3AF' }}>Status: {selectedPolicy.status}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background:'#0B1220', border:'1px solid #1F2937' }}>
                  <p className="text-[10px] uppercase" style={{ color:'#4B5563' }}>Coverage</p>
                  <p className="text-white mt-1">₹{selectedPolicy.coverageAmount}</p>
                  <p style={{ color:'#9CA3AF' }}>Weekly Premium: ₹{selectedPolicy.weeklyPremium}</p>
                </div>
              </div>
            </div>
          )}
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

      {/* Payments */}
      {tab==='Payments' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white">Payment History</h3>
            <p className="text-xs mt-1" style={{ color:'#6B7280' }}>Monitor premium collection and Razorpay transaction status.</p>
          </div>
          <div className="overflow-x-auto card p-3">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr style={{ borderBottom:'1px solid #1F2937' }}>
                  {['Worker','Amount','Status','Razorpay ID','Payment Date'].map(h=> <th key={h} className="pb-2 text-left pr-3" style={{ color:'#4B5563' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p._id} style={{ borderBottom:'1px solid #111827' }}>
                    <td className="py-2 pr-3 text-white">{p.userId?.name || '—'}</td>
                    <td className="py-2 pr-3 text-white">₹{p.amount}</td>
                    <td className="py-2 pr-3"><span className="px-2 py-1 rounded-full text-[10px]" style={{ background:p.status === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color:p.status === 'success' ? '#22C55E' : '#EF4444' }}>{p.status}</span></td>
                    <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>{p.razorpayPaymentId || p.razorpayOrderId || '—'}</td>
                    <td className="py-2 pr-3" style={{ color:'#9CA3AF' }}>{new Date(p.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notifications */}
      {tab==='Notifications' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <form onSubmit={sendNotification} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={notifForm.userId} onChange={(e)=>setNotifForm({...notifForm, userId:e.target.value})} placeholder="Worker ID" className="rounded-xl px-3 py-2 text-sm" style={{ background:'#0B1220', border:'1px solid #1F2937' }} />
              <input value={notifForm.title} onChange={(e)=>setNotifForm({...notifForm, title:e.target.value})} placeholder="Title" required className="rounded-xl px-3 py-2 text-sm" style={{ background:'#0B1220', border:'1px solid #1F2937' }} />
              <input value={notifForm.message} onChange={(e)=>setNotifForm({...notifForm, message:e.target.value})} placeholder="Message" required className="rounded-xl px-3 py-2 text-sm md:col-span-2" style={{ background:'#0B1220', border:'1px solid #1F2937' }} />
              <button type="submit" className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background:'linear-gradient(135deg,#3B82F6,#8B5CF6)', color:'#fff' }}><Send size={14}/> Send to Worker</button>
            </form>
            <form onSubmit={broadcastNotification} className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3" style={{ borderTop:'1px solid #1F2937' }}>
              <input value={broadcastForm.title} onChange={(e)=>setBroadcastForm({...broadcastForm, title:e.target.value})} placeholder="Broadcast Title" required className="rounded-xl px-3 py-2 text-sm" style={{ background:'#0B1220', border:'1px solid #1F2937' }} />
              <input value={broadcastForm.message} onChange={(e)=>setBroadcastForm({...broadcastForm, message:e.target.value})} placeholder="Broadcast Message" required className="rounded-xl px-3 py-2 text-sm" style={{ background:'#0B1220', border:'1px solid #1F2937' }} />
              <button type="submit" className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm md:col-span-2" style={{ background:'linear-gradient(135deg,#F59E0B,#EF4444)', color:'#fff' }}><Bell size={14}/> Broadcast to All Workers</button>
            </form>
          </div>
          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n._id} className="card p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{n.title}</p>
                  <p className="text-xs mt-1" style={{ color:'#9CA3AF' }}>{n.message}</p>
                  <p className="text-[10px] mt-1" style={{ color:'#4B5563' }}>{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                <button onClick={() => deleteNotification(n._id)} className="p-2 rounded-lg" style={{ background:'#111827', color:'#EF4444' }}><Trash2 size={13}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weather */}
      {tab==='Weather' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white">Weather Monitoring</h3>
            <p className="text-xs mt-1" style={{ color:'#6B7280' }}>Live weather data and severe weather alerts.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {weatherData.map(item => (
              <div key={item.city} className="card p-4" style={{ border: item.disruptionLevel !== 'none' ? '1px solid rgba(239,68,68,0.3)' : '1px solid #1F2937' }}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">{item.city}</h4>
                  <span className="px-2 py-1 rounded-full text-[10px]" style={{ background:item.disruptionLevel !== 'none' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color:item.disruptionLevel !== 'none' ? '#EF4444' : '#22C55E' }}>{item.disruptionLevel}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                  <div><p className="text-[10px] uppercase" style={{ color:'#4B5563' }}>Rainfall</p><p className="text-white">{item.rainfall ?? 0} mm</p></div>
                  <div><p className="text-[10px] uppercase" style={{ color:'#4B5563' }}>Temperature</p><p className="text-white">{item.temperature ?? 0}°C</p></div>
                  <div><p className="text-[10px] uppercase" style={{ color:'#4B5563' }}>Humidity</p><p className="text-white">{item.humidity ?? 0}%</p></div>
                  <div><p className="text-[10px] uppercase" style={{ color:'#4B5563' }}>Wind</p><p className="text-white">{item.windSpeed ?? 0} km/h</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AQI */}
      {tab==='AQI' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white">AQI Monitoring</h3>
            <p className="text-xs mt-1" style={{ color:'#6B7280' }}>Track current air quality across monitored cities.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {weatherData.map(item => (
              <div key={`${item.city}-aqi`} className="card p-4" style={{ border: item.aqi > 150 ? '1px solid rgba(239,68,68,0.3)' : '1px solid #1F2937' }}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">{item.city}</h4>
                  <span className="px-2 py-1 rounded-full text-[10px]" style={{ background: item.aqi > 150 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: item.aqi > 150 ? '#EF4444' : '#22C55E' }}>{item.aqi > 150 ? 'Dangerous' : 'Normal'}</span>
                </div>
                <div className="mt-3 text-sm">
                  <p className="text-[10px] uppercase" style={{ color:'#4B5563' }}>AQI</p>
                  <p className="text-white text-lg font-semibold">{item.aqi}</p>
                  <p className="text-xs mt-1" style={{ color:'#9CA3AF' }}>Air Quality: {item.aqi > 150 ? 'Poor' : 'Moderate'}</p>
                </div>
              </div>
            ))}
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

      {/* Reports */}
      {tab==='Reports' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white">Reports</h3>
            <p className="text-xs mt-1" style={{ color:'#6B7280' }}>Export worker, claims, premium and weather reports to CSV.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {['workers','claims','payments','weather'].map(type => (
              <div key={type} className="card p-4 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white capitalize">{type} Report</h4>
                  <p className="text-xs mt-1" style={{ color:'#6B7280' }}>Download report as CSV</p>
                </div>
                <button onClick={() => exportReport(type)} className="px-3 py-2 rounded-lg text-xs" style={{ background:'#111827', color:'#3B82F6' }}>Export</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings */}
      {tab==='Settings' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white">Security & Access</h3>
            <p className="text-xs mt-1" style={{ color:'#6B7280' }}>Admin-only access is enforced by protected routes and role checks.</p>
          </div>
          <div className="card p-4 text-sm" style={{ color:'#9CA3AF' }}>
            <p className="mb-2"><span className="text-white font-semibold">Role protection:</span> only admin users can access this dashboard.</p>
            <p className="mb-2"><span className="text-white font-semibold">Routes:</span> all admin views are behind the admin guard in the app router.</p>
            <p><span className="text-white font-semibold">Backend:</span> every admin endpoint requires the admin authentication middleware.</p>
          </div>
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
