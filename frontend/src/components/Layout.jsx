import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield, LayoutDashboard, FileText, AlertTriangle,
  Map, MessageCircle, LogOut, CreditCard,
  User, BarChart2, Settings, Menu, X
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/policies',  label: 'Policies',     icon: FileText },
  { path: '/claims',    label: 'Claims',        icon: AlertTriangle },
  { path: '/payments',  label: 'Payments',      icon: CreditCard },
  { path: '/risk-map',  label: 'Risk Map',      icon: Map },
  { path: '/analytics', label: 'Analytics',    icon: BarChart2 },
  { path: '/chatbot',   label: 'AI Assistant',  icon: MessageCircle },
  { path: '/profile',   label: 'Profile',       icon: User },
  { path: '/admin',     label: 'Admin',         icon: Settings },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();
  const [open, setOpen] = useState(false);

  const handleNav = (path) => { navigate(path); setOpen(false); };
  const handleLogout = () => { logout(); navigate('/login'); setOpen(false); };

  const NavLink = ({ path, label, icon: Icon }) => {
    const active = location.pathname === path;
    return (
      <button onClick={() => handleNav(path)}
        className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium transition-all text-left"
        style={active
          ? { background: 'rgba(59,130,246,0.15)', color: '#3B82F6', boxShadow: '0 0 12px rgba(59,130,246,0.2)' }
          : { color: '#6B7280' }}>
        <Icon size={16} />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="flex min-h-screen" style={{ background: '#0B1220' }}>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex w-56 flex-col flex-shrink-0"
        style={{ background: '#0D1526', borderRight: '1px solid #1F2937' }}>
        <div className="p-5" style={{ borderBottom: '1px solid #1F2937' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#22C55E,#3B82F6)' }}>
              <Shield size={15} className="text-white" />
            </div>
            <span className="font-bold text-white text-base tracking-tight">GigShield</span>
          </div>
          <p className="text-xs mt-1.5" style={{ color: '#4B5563' }}>Parametric Insurance</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => <NavLink key={item.path} {...item} />)}
        </nav>
        <div className="p-3" style={{ borderTop: '1px solid #1F2937' }}>
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-gray-300 truncate">{user?.name}</p>
            <p className="text-xs" style={{ color: '#4B5563' }}>{user?.platform} · {user?.location?.city}</p>
            <div className="mt-1 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E' }} />
              <span className="text-xs" style={{ color: '#4B5563' }}>Trust {user?.trustScore}/100</span>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg transition"
            style={{ color: '#6B7280' }}>
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile Overlay ── */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />
      )}

      {/* ── Mobile Drawer ── */}
      <aside className={`fixed top-0 left-0 h-full z-50 w-72 flex flex-col lg:hidden transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#0D1526', borderRight: '1px solid #1F2937' }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #1F2937' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#22C55E,#3B82F6)' }}>
              <Shield size={15} className="text-white" />
            </div>
            <span className="font-bold text-white text-base">GigShield</span>
          </div>
          <button onClick={() => setOpen(false)} className="p-2 rounded-lg" style={{ color: '#6B7280' }}>
            <X size={18} />
          </button>
        </div>
        <div className="px-3 py-3" style={{ borderBottom: '1px solid #1F2937' }}>
          <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
          <p className="text-xs mt-0.5" style={{ color: '#4B5563' }}>{user?.platform} · {user?.location?.city}</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22C55E' }} />
            <span className="text-xs" style={{ color: '#4B5563' }}>Trust {user?.trustScore}/100</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => <NavLink key={item.path} {...item} />)}
        </nav>
        <div className="p-3" style={{ borderTop: '1px solid #1F2937' }}>
          <button onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-3 text-sm rounded-xl transition"
            style={{ color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="flex lg:hidden items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ background: '#0D1526', borderBottom: '1px solid #1F2937' }}>
          <button onClick={() => setOpen(true)} className="p-2 rounded-lg" style={{ color: '#9CA3AF' }}>
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#22C55E,#3B82F6)' }}>
              <Shield size={12} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm">GigShield</span>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
