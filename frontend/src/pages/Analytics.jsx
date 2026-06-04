import { useEffect, useState } from 'react';
import api from '../api';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, BarChart2 } from 'lucide-react';

const TTStyle = { background: '#111827', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12, color: '#E5E7EB' };

export default function Analytics() {
  const [premiumTrend,    setPremiumTrend]    = useState([]);
  const [claimTrend,      setClaimTrend]      = useState([]);
  const [riskTrend,       setRiskTrend]       = useState([]);
  const [incomeLoss,      setIncomeLoss]      = useState([]);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/premium-trend').catch(() => ({ data: [] })),
      api.get('/analytics/claim-trend').catch(() => ({ data: [] })),
      api.get('/analytics/risk-trend').catch(() => ({ data: [] })),
      api.get('/analytics/income-loss-trend').catch(() => ({ data: [] }))
    ]).then(([pt, ct, rt, il]) => {
      setPremiumTrend(pt.data.map(d => ({
        date:    new Date(d.generatedDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        premium: d.premiumAmount,
        risk:    d.riskScore
      })));
      setClaimTrend(ct.data.map(d => ({ date: d._id, claims: d.count, payout: d.totalPayout })));
      setRiskTrend(rt.data.map(d => ({
        date:        new Date(d.recordedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        city:        d.city,
        aqi:         d.aqi,
        rainfall:    d.weather?.rainfall || 0,
        temperature: d.weather?.temperature || 0
      })));
      setIncomeLoss(il.data.map(d => ({
        date:   new Date(d.triggeredAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        loss:   d.payoutAmount,
        type:   d.triggerType,
        city:   d.affectedCity
      })));
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6 text-sm" style={{ color: '#4B5563' }}>Loading analytics...</div>;

  const sections = [
    {
      title: 'Premium Trend', icon: TrendingUp, color: '#3B82F6',
      desc: 'Weekly premium and risk score over time',
      empty: premiumTrend.length === 0,
      chart: (
        <LineChart data={premiumTrend}>
          <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TTStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#6B7280' }} />
          <Line type="monotone" dataKey="premium" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} name="Premium (₹)" />
          <Line type="monotone" dataKey="risk"    stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} name="Risk Score" />
        </LineChart>
      )
    },
    {
      title: 'Claim Trend', icon: BarChart2, color: '#22C55E',
      desc: 'Daily claims and total payouts',
      empty: claimTrend.length === 0,
      chart: (
        <BarChart data={claimTrend} barSize={24}>
          <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TTStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#6B7280' }} />
          <Bar dataKey="claims" fill="#22C55E" radius={[4, 4, 0, 0]} name="Claims" />
          <Bar dataKey="payout" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Payout (₹)" />
        </BarChart>
      )
    },
    {
      title: 'Risk Trend', icon: Activity, color: '#FACC15',
      desc: 'AQI, rainfall, and temperature over time',
      empty: riskTrend.length === 0,
      chart: (
        <LineChart data={riskTrend}>
          <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TTStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#6B7280' }} />
          <Line type="monotone" dataKey="aqi"         stroke="#FACC15" strokeWidth={2} dot={false} name="AQI" />
          <Line type="monotone" dataKey="rainfall"    stroke="#3B82F6" strokeWidth={2} dot={false} name="Rainfall (mm)" />
          <Line type="monotone" dataKey="temperature" stroke="#EF4444" strokeWidth={2} dot={false} name="Temp (°C)" />
        </LineChart>
      )
    },
    {
      title: 'Income Loss Trend', icon: TrendingDown, color: '#EF4444',
      desc: 'Estimated income loss per disruption event',
      empty: incomeLoss.length === 0,
      chart: (
        <AreaChart data={incomeLoss}>
          <defs>
            <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#4B5563' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TTStyle} />
          <Area type="monotone" dataKey="loss" stroke="#EF4444" fill="url(#lossGrad)" strokeWidth={2} name="Income Loss (₹)" />
        </AreaChart>
      )
    }
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Analytics</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Premium, claims, risk, and income loss trends</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {sections.map(({ title, icon: Icon, color, desc, empty, chart }) => (
          <div key={title} className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={15} style={{ color }} />
              <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>
            <p className="text-xs mb-4" style={{ color: '#4B5563' }}>{desc}</p>
            {empty ? (
              <div className="flex items-center justify-center h-36 rounded-xl" style={{ background: '#0B1220', border: '1px dashed #1F2937' }}>
                <p className="text-xs" style={{ color: '#4B5563' }}>No data yet — data will appear after activity</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>{chart}</ResponsiveContainer>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
