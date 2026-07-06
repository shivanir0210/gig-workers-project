import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout       from './components/Layout';
import Login        from './pages/Login';
import AdminLogin   from './pages/AdminLogin';
import Register     from './pages/Register';
import Dashboard    from './pages/Dashboard';
import Policies     from './pages/Policies';
import Claims       from './pages/Claims';
import Payments     from './pages/Payments';
import RiskMap      from './pages/RiskMap';
import Chatbot      from './pages/Chatbot';
import Profile      from './pages/Profile';
import Analytics    from './pages/Analytics';
import Admin        from './pages/Admin';
import Notifications from './pages/Notifications';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1220' }}>
    <div className="text-sm" style={{ color: '#4B5563' }}>Loading...</div>
  </div>
);

const Forbidden = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1220' }}>
    <div className="text-center">
      <div className="text-6xl font-bold mb-4" style={{ color: '#EF4444' }}>403</div>
      <div className="text-white text-xl font-semibold mb-2">Access Forbidden</div>
      <p className="text-sm mb-6" style={{ color: '#6B7280' }}>You don't have permission to access this page.</p>
      <a href="/dashboard" className="btn-neon px-6 py-2 text-sm">Go to Dashboard</a>
    </div>
  </div>
);

// Only logged-in users with role=user
function UserRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'user') return <Forbidden />;
  return <Layout>{children}</Layout>;
}

// Only logged-in users with role=admin
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== 'admin') return <Forbidden />;
  return <Layout>{children}</Layout>;
}

// Redirect logged-in users away from public pages
function PublicRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (user?.role === 'user')  return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          duration: 3500,
          style: { fontSize: '13px', borderRadius: '10px', background: '#111827', color: '#E5E7EB', border: '1px solid #1F2937' }
        }} />
        <Routes>
          {/* Public */}
          <Route path="/login"       element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/admin/login" element={<PublicRoute><AdminLogin /></PublicRoute>} />
          <Route path="/register"    element={<PublicRoute><Register /></PublicRoute>} />

          {/* User routes */}
          <Route path="/dashboard"      element={<UserRoute><Dashboard /></UserRoute>} />
          <Route path="/policies"       element={<UserRoute><Policies /></UserRoute>} />
          <Route path="/claims"         element={<UserRoute><Claims /></UserRoute>} />
          <Route path="/payments"       element={<UserRoute><Payments /></UserRoute>} />
          <Route path="/risk-map"       element={<UserRoute><RiskMap /></UserRoute>} />
          <Route path="/analytics"      element={<UserRoute><Analytics /></UserRoute>} />
          <Route path="/chatbot"        element={<UserRoute><Chatbot /></UserRoute>} />
          <Route path="/profile"        element={<UserRoute><Profile /></UserRoute>} />
          <Route path="/notifications"  element={<UserRoute><Notifications /></UserRoute>} />

          {/* Admin routes */}
          <Route path="/admin/dashboard"      element={<AdminRoute><Admin tab="overview" /></AdminRoute>} />
          <Route path="/admin/workers"        element={<AdminRoute><Admin tab="workers" /></AdminRoute>} />
          <Route path="/admin/verification"   element={<AdminRoute><Admin tab="verification" /></AdminRoute>} />
          <Route path="/admin/policies"       element={<AdminRoute><Admin tab="policies" /></AdminRoute>} />
          <Route path="/admin/claims"         element={<AdminRoute><Admin tab="claims" /></AdminRoute>} />
          <Route path="/admin/payments"       element={<AdminRoute><Admin tab="payments" /></AdminRoute>} />
          <Route path="/admin/weather"        element={<AdminRoute><Admin tab="weather" /></AdminRoute>} />
          <Route path="/admin/aqi"            element={<AdminRoute><Admin tab="aqi" /></AdminRoute>} />
          <Route path="/admin/notifications"  element={<AdminRoute><Admin tab="notifications" /></AdminRoute>} />
          <Route path="/admin/analytics"      element={<AdminRoute><Admin tab="analytics" /></AdminRoute>} />
          <Route path="/admin/fraud"          element={<AdminRoute><Admin tab="fraud" /></AdminRoute>} />
          <Route path="/admin/reports"        element={<AdminRoute><Admin tab="reports" /></AdminRoute>} />
          <Route path="/admin/settings"       element={<AdminRoute><Admin tab="settings" /></AdminRoute>} />

          {/* Legacy /admin redirect */}
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
