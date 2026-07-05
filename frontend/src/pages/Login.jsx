import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid credentials');
    } finally { setLoading(false); }
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
          {[{ key: 'email', label: 'Email Address', type: 'email' },
            { key: 'password', label: 'Password', type: 'password' }].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6B7280' }}>{label}</label>
              <input type={type} required value={form[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                className="input-dark w-full" style={{ fontSize: '16px' }} />
            </div>
          ))}
          <button type="submit" disabled={loading} className="btn-neon w-full mt-2"
            style={{ minHeight: '44px' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: '#6B7280' }}>
          New to GigShield?{' '}
          <Link to="/register" className="font-semibold" style={{ color: '#3B82F6' }}>Create account</Link>
        </p>
        <p className="text-center text-xs mt-2" style={{ color: '#4B5563' }}>
          Admin?{' '}
          <Link to="/admin/login" className="font-semibold" style={{ color: '#F59E0B' }}>Admin Portal →</Link>
        </p>
      </div>
    </div>
  );
}
