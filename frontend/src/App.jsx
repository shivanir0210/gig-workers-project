import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout    from './components/Layout';
import Login     from './pages/Login';
import Register  from './pages/Register';
import Dashboard from './pages/Dashboard';
import Policies  from './pages/Policies';
import Claims    from './pages/Claims';
import Payments  from './pages/Payments';
import RiskMap   from './pages/RiskMap';
import Chatbot   from './pages/Chatbot';
import Profile   from './pages/Profile';
import Analytics from './pages/Analytics';
import Admin     from './pages/Admin';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B1220' }}>
    <div className="text-sm" style={{ color: '#4B5563' }}>Loading...</div>
  </div>
);

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/dashboard" replace /> : children;
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
          <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register"  element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/policies"  element={<PrivateRoute><Policies /></PrivateRoute>} />
          <Route path="/claims"    element={<PrivateRoute><Claims /></PrivateRoute>} />
          <Route path="/payments"  element={<PrivateRoute><Payments /></PrivateRoute>} />
          <Route path="/risk-map"  element={<PrivateRoute><RiskMap /></PrivateRoute>} />
          <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="/chatbot"   element={<PrivateRoute><Chatbot /></PrivateRoute>} />
          <Route path="/profile"   element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/admin"     element={<PrivateRoute><Admin /></PrivateRoute>} />
          <Route path="*"          element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
