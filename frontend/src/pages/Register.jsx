import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune'];
const CITY_COORDS = {
  Mumbai: { lat: 19.076, lng: 72.877 }, Delhi: { lat: 28.704, lng: 77.102 },
  Bangalore: { lat: 12.972, lng: 77.594 }, Chennai: { lat: 13.083, lng: 80.270 },
  Hyderabad: { lat: 17.385, lng: 78.487 }, Pune: { lat: 18.520, lng: 73.856 }
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', platform: 'Swiggy', city: 'Mumbai', weeklyIncome: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password, phone: form.phone, platform: form.platform, location: { city: form.city, ...CITY_COORDS[form.city] }, weeklyIncome: Number(form.weeklyIncome) });
      toast.success('Account created! Please log in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  const field = (key, label, type, col = 2) => (
    <div key={key} className={col === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6B7280' }}>{label}</label>
      <input type={type} required value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="input-dark" />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: '#0B1220' }}>
      <div className="fixed top-1/4 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle,#22C55E,transparent)' }} />
      <div className="card w-full max-w-md p-8 relative z-10">
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#22C55E,#3B82F6,#8B5CF6)', boxShadow: '0 0 24px rgba(59,130,246,0.4)' }}>
            <Shield size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Create your account</h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>GigShield — Income Protection Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field('name', 'Full Name', 'text', 2)}
            {field('email', 'Email Address', 'email', 2)}
            {field('password', 'Password', 'password', 2)}
            {field('phone', 'Phone', 'tel', 1)}
            {field('weeklyIncome', 'Weekly Income (₹)', 'number', 1)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[['platform', 'Platform', ['Zepto','Swiggy','Zomato','Other']], ['city', 'City', CITIES]].map(([key, label, opts]) => (
              <div key={key}>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#6B7280' }}>{label}</label>
                <select value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="input-dark">
                  {opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <button type="submit" disabled={loading} className="btn-neon w-full mt-2">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm mt-5" style={{ color: '#6B7280' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold" style={{ color: '#3B82F6' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
