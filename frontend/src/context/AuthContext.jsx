import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    api.get('/users/profile')
      .then(res => setUser(res.data))
      .catch(() => { localStorage.removeItem('token'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const cleanEmail = typeof email === 'string' ? email.trim() : email;
    const res = await api.post('/users/login', { email: cleanEmail, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const adminLogin = async (email, password) => {
    const res = await api.post('/users/admin/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post('/users/register', data);
    return res.data;
  };

  const logout = () => {
    const role = user?.role;
    localStorage.removeItem('token');
    setUser(null);
    return role;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, adminLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
