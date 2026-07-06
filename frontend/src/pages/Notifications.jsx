import { useEffect, useState, useMemo } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import {
  Bell, BellOff, Trash2, CheckSquare, Search,
  CloudRain, Wind, Thermometer, AlertTriangle,
  FileText, CreditCard, DollarSign, ShieldCheck,
  Lock, Star, Filter, CheckCheck
} from 'lucide-react';

// ── Config ────────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  weather:  { icon: CloudRain,    color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  label: 'Weather' },
  aqi:      { icon: Wind,         color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)',  label: 'AQI' },
  claim:    { icon: FileText,     color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  label: 'Claims' },
  policy:   { icon: ShieldCheck,  color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   label: 'Policy' },
  payment:  { icon: CreditCard,   color: '#06B6D4', bg: 'rgba(6,182,212,0.1)',   label: 'Payment' },
  payout:   { icon: DollarSign,   color: '#22C55E', bg: 'rgba(34,197,94,0.1)',   label: 'Payout' },
  admin:    { icon: Star,         color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  label: 'Admin' },
  security: { icon: Lock,         color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   label: 'Security' },
};

const PRIORITY_CONFIG = {
  critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)',  label: 'CRITICAL' },
  high:     { color: '#F97316', bg: 'rgba(249,115,22,0.15)', label: 'HIGH' },
  medium:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'MEDIUM' },
  low:      { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'LOW' },
};

const CATEGORIES = [
  { key: 'all',      label: 'All' },
  { key: 'weather',  label: '🌧️ Weather' },
  { key: 'aqi',      label: '🌫️ AQI' },
  { key: 'claim',    label: '📋 Claims' },
  { key: 'policy',   label: '📄 Policy' },
  { key: 'payment',  label: '💳 Payment' },
  { key: 'payout',   label: '💸 Payout' },
  { key: 'admin',    label: '⭐ Admin' },
  { key: 'security', label: '🔐 Security' },
];

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(date).toLocaleDateString();
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [category,  setCategory]  = useState('all');
  const [showUnread,setShowUnread]= useState(false);
  const [search,    setSearch]    = useState('');

  const fetch = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch { toast.error('Failed to load notifications'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`).catch(() => {});
    setNotifications(p => p.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all').catch(() => {});
    setNotifications(p => p.map(n => ({ ...n, isRead: true })));
    toast.success('All marked as read');
  };

  const del = async (id) => {
    await api.delete(`/notifications/${id}`).catch(() => {});
    setNotifications(p => p.filter(n => n._id !== id));
  };

  const clearAll = async () => {
    if (!window.confirm('Delete all notifications?')) return;
    await api.delete('/notifications').catch(() => {});
    setNotifications([]);
    toast.success('Cleared');
  };

  const displayed = useMemo(() => {
    let list = notifications;
    if (category !== 'all') list = list.filter(n => n.type === category);
    if (showUnread)         list = list.filter(n => !n.isRead);
    if (search.trim())      list = list.filter(n =>
      n.title?.toLowerCase().includes(search.toLowerCase()) ||
      n.message?.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [notifications, category, showUnread, search]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <div className="text-sm" style={{ color: '#4B5563' }}>Loading notifications...</div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Bell size={18} style={{ color: '#3B82F6' }} />
            Notifications
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#EF4444' }}>
                {unreadCount}
              </span>
            )}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
            {notifications.length} total · {unreadCount} unread
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
              style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.25)', minHeight: '36px' }}>
              <CheckCheck size={13} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', minHeight: '36px' }}>
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Search + Unread toggle */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4B5563' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search notifications..."
            className="input-dark w-full pl-8 text-xs" style={{ fontSize: '14px', height: '38px' }}
          />
        </div>
        <button onClick={() => setShowUnread(p => !p)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition flex-shrink-0"
          style={{ background: showUnread ? 'rgba(59,130,246,0.15)' : '#111827', color: showUnread ? '#3B82F6' : '#6B7280', border: `1px solid ${showUnread ? 'rgba(59,130,246,0.3)' : '#1F2937'}`, minHeight: '38px' }}>
          <Filter size={12} /> {showUnread ? 'Unread only' : 'All'}
        </button>
      </div>

      {/* Category tabs — horizontal scroll */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition"
            style={{
              background: category === c.key ? 'linear-gradient(135deg,#3B82F6,#8B5CF6)' : '#111827',
              color: category === c.key ? '#fff' : '#6B7280',
              border: `1px solid ${category === c.key ? 'transparent' : '#1F2937'}`,
              minHeight: '32px'
            }}>
            {c.label}
            {c.key !== 'all' && notifications.filter(n => n.type === c.key && !n.isRead).length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#EF4444' }}>
                {notifications.filter(n => n.type === c.key && !n.isRead).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="card p-10 text-center space-y-2">
          <BellOff size={28} className="mx-auto" style={{ color: '#1F2937' }} />
          <p className="text-sm font-medium" style={{ color: '#4B5563' }}>No notifications found</p>
          <p className="text-xs" style={{ color: '#374151' }}>
            {search ? 'Try a different search term.' : 'You\'re all caught up!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => {
            const tc = TYPE_CONFIG[n.type] || TYPE_CONFIG.weather;
            const pc = PRIORITY_CONFIG[n.priority] || PRIORITY_CONFIG.medium;
            const Icon = tc.icon;
            return (
              <div key={n._id}
                onClick={() => !n.isRead && markRead(n._id)}
                className="card p-3 sm:p-4 transition-all cursor-pointer"
                style={{
                  borderLeft: `3px solid ${pc.color}`,
                  background: n.isRead ? '#0D1526' : tc.bg,
                  opacity: n.isRead ? 0.75 : 1
                }}>
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: tc.bg, border: `1px solid ${tc.color}30` }}>
                    <Icon size={15} style={{ color: tc.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white leading-tight">{n.title}</span>
                      {!n.isRead && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#3B82F6' }} />}
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{n.message}</p>
                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ background: pc.bg, color: pc.color }}>
                        {pc.label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: tc.bg, color: tc.color }}>
                        {tc.label}
                      </span>
                      {n.city && (
                        <span className="text-[10px]" style={{ color: '#4B5563' }}>📍 {n.city}</span>
                      )}
                      <span className="text-[10px] ml-auto" style={{ color: '#374151' }}>
                        {timeAgo(n.createdAt || n.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.isRead && (
                      <button onClick={e => { e.stopPropagation(); markRead(n._id); }}
                        className="p-1.5 rounded-lg transition"
                        style={{ color: '#22C55E', minHeight: '32px', minWidth: '32px' }}
                        title="Mark as read">
                        <CheckSquare size={14} />
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); del(n._id); }}
                      className="p-1.5 rounded-lg transition"
                      style={{ color: '#4B5563', minHeight: '32px', minWidth: '32px' }}
                      title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
