import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { ShieldCheck } from 'lucide-react';

export default function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminLogin(form.email, form.password);
      navigate('/admin/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid admin credentials');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0B1220' }}>
      <div className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle,#F59E0B,transparent)' }} />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle,#EF4444,transparent)' }} />

      <div className="card w-full max-w-sm p-8 relative z-10" style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#F59E0B,#EF4444)', boxShadow: '0 0 24px rgba(245,158,11,0.4)' }}>
            <ShieldCheck size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Admin Portal</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>GigShield Administration</p>
          <div className="mt-2 px-3 py-1 rounded-full text-xs inline-block font-semibold"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
            🔒 Restricted Access
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[{ key: 'email', label: 'Admin Email', type: 'email' },
            { key: 'password', label: 'Password', type: 'password' }].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6B7280' }}>{label}</label>
              <input type={type} required value={form[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                className="input-dark w-full" style={{ fontSize: '16px' }} />
            </div>
          ))}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all mt-2"
            style={{ background: 'linear-gradient(135deg,#F59E0B,#EF4444)', minHeight: '44px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Signing in...' : 'Sign In as Admin'}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: '#4B5563' }}>
          Not an admin?{' '}
          <a href="/login" className="font-semibold" style={{ color: '#3B82F6' }}>User Login</a>
        </p>
      </div>
    </div>
  );
}
