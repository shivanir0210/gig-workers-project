import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';
import { Shield, Eye, EyeOff, KeyRound, X } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm] = useState({ email: 'shivanirasappan@gmail.com', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password reset modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('shivanirasappan@gmail.com');
  const [newPassword, setNewPassword] = useState('password123');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Signed in successfully!');
      navigate('/dashboard');
    } catch (err) {
      console.error('[Login Error]:', err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Invalid credentials';
      toast.error(errMsg);
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const res = await api.post('/users/reset-password-dev', {
        email: resetEmail,
        newPassword
      });
      toast.success(res.data?.message || 'Password updated successfully!');
      setForm(prev => ({ ...prev, email: resetEmail, password: newPassword }));
      setShowResetModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Password reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: '#0B1220' }}>
      <div className="fixed top-1/4 left-1/4 w-64 h-64 md:w-96 md:h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle,#3B82F6,transparent)' }} />
      <div className="fixed bottom-1/4 right-1/4 w-64 h-64 md:w-96 md:h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle,#8B5CF6,transparent)' }} />

      <div className="card w-full max-w-sm p-6 sm:p-8 relative z-10">
        <div className="text-center mb-7">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#22C55E,#3B82F6,#8B5CF6)', boxShadow: '0 0 24px rgba(59,130,246,0.4)' }}>
            <Shield size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Sign in to GigShield</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>AI-Powered Parametric Insurance</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-gray-400">Email Address</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="input-dark w-full"
              style={{ fontSize: '16px' }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Password</label>
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="text-[11px] font-medium text-blue-400 hover:underline"
              >
                Reset Password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="input-dark w-full pr-10"
                style={{ fontSize: '16px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-neon w-full mt-2" style={{ minHeight: '44px' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: '#6B7280' }}>
          New to GigShield?{' '}
          <Link to="/register" className="font-semibold text-blue-400 hover:underline">Create account</Link>
        </p>
        <p className="text-center text-xs mt-2" style={{ color: '#4B5563' }}>
          Admin?{' '}
          <Link to="/admin/login" className="font-semibold text-amber-500 hover:underline">Admin Portal →</Link>
        </p>
      </div>

      {/* 1-Click Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-6 border border-blue-500/30 bg-gray-950 text-white relative shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="text-amber-400" size={18} />
                <h3 className="text-base font-bold text-white">Reset Account Password</h3>
              </div>
              <button onClick={() => setShowResetModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-gray-400">Account Email</label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  className="input-dark w-full"
                  style={{ fontSize: '15px' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider text-gray-400">New Password</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="input-dark w-full"
                  style={{ fontSize: '15px' }}
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="py-2.5 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold w-1/3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="btn-neon py-2.5 px-3 text-xs font-bold w-2/3 flex items-center justify-center gap-1"
                >
                  {resetLoading ? 'Updating...' : 'Set Password & Auto-fill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
