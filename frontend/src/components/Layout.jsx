import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import {
  Shield, LayoutDashboard, FileText, AlertTriangle,
  Map, MessageCircle, LogOut, CreditCard,
  User, BarChart2, Settings, Menu, X, Bell,
  ShieldCheck, Users, TrendingUp, Flag, ClipboardList,
  Cloud, Wind, FileBarChart, Send
} from 'lucide-react';

const userNavItems = [
  { path: '/dashboard',      label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/policies',       label: 'Policies',     icon: FileText },
  { path: '/claims',         label: 'Claims',       icon: AlertTriangle },
  { path: '/payments',       label: 'Payments',     icon: CreditCard },
  { path: '/risk-map',       label: 'Risk Map',     icon: Map },
  { path: '/analytics',      label: 'Analytics',    icon: BarChart2 },
  { path: '/notifications',  label: 'Notifications',icon: Bell },
  { path: '/chatbot',        label: 'AI Assistant', icon: MessageCircle },
  { path: '/profile',        label: 'Profile',      icon: User },
];

const adminNavItems = [
  { path: '/admin/dashboard',     label: 'Overview',        icon: LayoutDashboard },
  { path: '/admin/workers',       label: 'Workers',         icon: Users },
  { path: '/admin/verification',  label: 'Verification',    icon: ShieldCheck },
  { path: '/admin/policies',      label: 'Policies',        icon: FileText },
  { path: '/admin/claims',        label: 'Claims',          icon: ClipboardList },
  { path: '/admin/payments',      label: 'Payments',        icon: CreditCard },
  { path: '/admin/weather',       label: 'Weather',         icon: Cloud },
  { path: '/admin/aqi',           label: 'AQI',             icon: Wind },
  { path: '/admin/notifications', label: 'Notifications',   icon: Bell },
  { path: '/admin/analytics',     label: 'Analytics',       icon: TrendingUp },
  { path: '/admin/fraud',         label: 'Fraud Detection', icon: Flag },
  { path: '/admin/reports',       label: 'Reports',         icon: FileBarChart },
  { path: '/admin/settings',      label: 'Settings',        icon: Settings },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = user?.role === 'admin';
  const navItems = isAdmin ? adminNavItems : userNavItems;

  const handleLogout = () => {
    const role = logout();
    navigate(role === 'admin' ? '/admin/login' : '/login');
    setOpen(false);
  };

  useEffect(() => {
    if (!user || isAdmin) return;
    const fetchUnread = async () => {
      try { const res = await api.get('/notifications/unread-count'); setUnreadCount(res.data.count); }
      catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [user, isAdmin]);

  const accentColor = isAdmin ? '#F59E0B' : '#3B82F6';
  const accentGrad  = isAdmin ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : 'linear-gradient(135deg,#22C55E,#3B82F6)';

  const SidebarLink = ({ path, label, icon: Icon }) => {
    const isNotif = path === '/notifications';
    return (
      <NavLink
        to={path}
        end
        onClick={() => setOpen(false)}
        className={({ isActive }) => `flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium transition-all text-left relative ${isActive ? 'active-admin-link' : 'text-gray-400 hover:text-white'}`}
        style={({ isActive }) => isActive
          ? { background: `rgba(${isAdmin?'245,158,11':'59,130,246'},0.15)`, color: accentColor, boxShadow: `0 0 12px rgba(${isAdmin?'245,158,11':'59,130,246'},0.2)` }
          : { color: '#6B7280' }}>
        <Icon size={16} />
        <span>{label}</span>
        {isNotif && unreadCount > 0 && (
          <span className="absolute right-3 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-red-500 min-w-[18px] text-center">
            {unreadCount}
          </span>
        )}
      </NavLink>
    );
  };

  const SidebarHeader = () => (
    <div className="p-5" style={{ borderBottom: '1px solid #1F2937' }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: accentGrad }}>
          {isAdmin ? <ShieldCheck size={15} className="text-white" /> : <Shield size={15} className="text-white" />}
        </div>
        <span className="font-bold text-white text-base tracking-tight">GigShield</span>
      </div>
      <p className="text-xs mt-1.5" style={{ color: '#4B5563' }}>
        {isAdmin ? '⚡ Admin Portal' : 'Parametric Insurance'}
      </p>
    </div>
  );

  const SidebarFooter = ({ mobile }) => (
    <div className="p-3" style={{ borderTop: '1px solid #1F2937' }}>
      <div className="px-3 py-2 mb-1">
        <p className="text-xs font-semibold text-gray-300 truncate">{user?.name}</p>
        <p className="text-xs" style={{ color: '#4B5563' }}>
          {isAdmin ? '🔑 Administrator' : `${user?.platform} · ${user?.location?.city}`}
        </p>
      </div>
      <button onClick={handleLogout}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg transition"
        style={{ color: mobile ? '#EF4444' : '#6B7280', background: mobile ? 'rgba(239,68,68,0.08)' : 'transparent', minHeight: '36px' }}>
        <LogOut size={13} /> Sign Out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={{ background: '#0B1220' }}>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-56 flex-col flex-shrink-0"
        style={{ background: '#0D1526', borderRight: '1px solid #1F2937' }}>
        <SidebarHeader />
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => <SidebarLink key={item.path} {...item} />)}
        </nav>
        <SidebarFooter />
      </aside>

      {/* Mobile Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />
      )}

      {/* Mobile Drawer */}
      <aside className={`fixed top-0 left-0 h-full z-50 w-72 flex flex-col lg:hidden transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#0D1526', borderRight: '1px solid #1F2937' }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #1F2937' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: accentGrad }}>
              {isAdmin ? <ShieldCheck size={15} className="text-white" /> : <Shield size={15} className="text-white" />}
            </div>
            <span className="font-bold text-white text-base">GigShield</span>
          </div>
          <button onClick={() => setOpen(false)} className="p-2 rounded-lg" style={{ color: '#6B7280' }}>
            <X size={18} />
          </button>
        </div>
        <div className="px-3 py-3" style={{ borderBottom: '1px solid #1F2937' }}>
          <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
          <p className="text-xs mt-0.5" style={{ color: '#4B5563' }}>
            {isAdmin ? '🔑 Administrator' : `${user?.platform} · ${user?.location?.city}`}
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => <SidebarLink key={item.path} {...item} />)}
        </nav>
        <SidebarFooter mobile />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex lg:hidden items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: '#0D1526', borderBottom: '1px solid #1F2937' }}>
          <button onClick={() => setOpen(true)} className="p-2 rounded-lg" style={{ color: '#9CA3AF' }}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: accentGrad }}>
              <Shield size={12} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm">GigShield</span>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: accentGrad }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
