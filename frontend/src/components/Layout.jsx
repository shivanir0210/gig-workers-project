import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LayoutDashboard, FileText, AlertTriangle, Map, MessageCircle, LogOut, CreditCard } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/policies',  label: 'Policies',  icon: FileText },
  { path: '/claims',    label: 'Claims',     icon: AlertTriangle },
  { path: '/payments',  label: 'Payments',   icon: CreditCard },
  { path: '/risk-map',  label: 'Risk Map',   icon: Map },
  { path: '/chatbot',   label: 'AI Assistant', icon: MessageCircle },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen" style={{ background: '#0B1220' }}>
      {/* Sidebar */}
      <aside className="w-56 flex flex-col flex-shrink-0" style={{ background: '#0D1526', borderRight: '1px solid #1F2937' }}>
        {/* Logo */}
        <div className="p-5" style={{ borderBottom: '1px solid #1F2937' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#22C55E,#3B82F6)' }}>
              <Shield size={15} className="text-white" />
            </div>
            <span className="font-bold text-white text-base tracking-tight">GigShield</span>
          </div>
          <p className="text-xs mt-1.5" style={{ color: '#4B5563' }}>Parametric Insurance</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={active
                  ? { background: 'rgba(59,130,246,0.15)', color: '#3B82F6', boxShadow: '0 0 12px rgba(59,130,246,0.2)' }
                  : { color: '#6B7280' }
                }
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#9CA3AF'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#6B7280'; }}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3" style={{ borderTop: '1px solid #1F2937' }}>
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-semibold text-gray-300 truncate">{user?.name}</p>
            <p className="text-xs" style={{ color: '#4B5563' }}>{user?.platform} · {user?.location?.city}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-neonGreen" style={{ boxShadow: '0 0 6px #22C55E' }}></div>
              <span className="text-xs" style={{ color: '#4B5563' }}>Trust: {user?.trustScore}/100</span>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-lg transition"
            style={{ color: '#6B7280' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-h-screen">{children}</main>
    </div>
  );
}
