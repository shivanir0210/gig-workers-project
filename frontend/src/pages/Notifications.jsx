import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Bell, Trash2, CheckSquare, BellOff, AlertTriangle } from 'lucide-react';

const SEVERITY_COLORS = {
  extreme: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#FCA5A5' },
  high: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.25)', text: '#FDBA74' },
  medium: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', text: '#FCD34D' },
  low: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', text: '#93C5FD' }
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      toast.success('Marked as read');
    } catch {
      toast.error('Failed to mark read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all/status');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All marked as read');
    } catch {
      toast.error('Failed to mark all read');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
      toast.success('Deleted notification');
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Delete all notifications?')) return;
    try {
      await api.delete('/notifications');
      setNotifications([]);
      toast.success('Cleared all notifications');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const displayedNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.isRead) 
    : notifications;

  if (loading) return <div className="p-4 text-sm" style={{ color: '#4B5563' }}>Loading notifications...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Bell size={20} className="text-blue-500" /> Notifications Center
          </h2>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: '#6B7280' }}>
            Risk monitoring alerts and parametric warnings ({unreadCount} unread)
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="btn-outline flex items-center gap-1.5 text-xs" style={{ minHeight: '36px' }}>
              <CheckSquare size={13} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll} className="btn-outline flex items-center gap-1.5 text-xs" style={{ minHeight: '36px', color: '#EF4444', borderColor: 'rgba(239,68,68,0.2)' }}>
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {[
          { key: 'all', label: `All Alerts (${notifications.length})` },
          { key: 'unread', label: `Unread (${unreadCount})` }
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key)} className={`tab-item ${filter === t.key ? 'active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {displayedNotifications.length === 0 ? (
        <div className="card p-8 sm:p-10 text-center space-y-2">
          <BellOff size={28} className="mx-auto text-gray-700" />
          <p className="text-sm font-medium text-gray-500">No alerts found.</p>
          <p className="text-xs text-gray-600">You will receive notifications here when climate risks affect your work location.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedNotifications.map(n => {
            const styles = SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.low;
            return (
              <div key={n._id} className="card p-4 transition-all duration-300 relative overflow-hidden"
                style={{
                  background: n.isRead ? '#0D1526' : styles.bg,
                  borderColor: n.isRead ? '#1F2937' : styles.border,
                  borderLeft: `4px solid ${styles.text}`
                }}>
                <div className="flex items-start gap-3">
                  
                  {/* Bullet */}
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <AlertTriangle size={14} style={{ color: styles.text }} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: styles.text }}>
                        {n.alertType} &middot; {n.city}
                      </span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-blue-500" title="New Alert" />
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-200 leading-relaxed font-medium">{n.message}</p>
                    
                    <p className="text-[10px] text-gray-500">
                      {new Date(n.timestamp).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!n.isRead && (
                      <button onClick={() => markAsRead(n._id)} className="p-2 rounded-lg text-gray-500 hover:text-green-500 hover:bg-green-500/10 transition"
                        title="Mark as Read" style={{ minHeight: '36px' }}>
                        <CheckSquare size={14} />
                      </button>
                    )}
                    <button onClick={() => deleteNotification(n._id)} className="p-2 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition"
                      title="Delete" style={{ minHeight: '36px' }}>
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
