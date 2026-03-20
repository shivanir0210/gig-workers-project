import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Policies from './pages/Policies';
import Claims from './pages/Claims';
import Payments from './pages/Payments';
import RiskMap from './pages/RiskMap';
import Chatbot from './pages/Chatbot';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-slate-400 text-sm">Loading...</div>
    </div>
  );
  return user ? <Layout>{children}</Layout> : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          duration: 3500,
          style: { fontSize: '13px', borderRadius: '10px', border: '1px solid #E2E8F0' }
        }} />
        <Routes>
          <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register"  element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/policies"  element={<PrivateRoute><Policies /></PrivateRoute>} />
          <Route path="/claims"    element={<PrivateRoute><Claims /></PrivateRoute>} />
          <Route path="/payments"  element={<PrivateRoute><Payments /></PrivateRoute>} />
          <Route path="/risk-map"  element={<PrivateRoute><RiskMap /></PrivateRoute>} />
          <Route path="/chatbot"   element={<PrivateRoute><Chatbot /></PrivateRoute>} />
          <Route path="*"          element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
