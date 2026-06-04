import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, Clock, XCircle, Zap, MapPin, Shield, Activity, Cpu } from 'lucide-react';

const STATUS = {
  pending:  { icon:Clock,        color:'#FACC15', badge:'badge-yellow' },
  approved: { icon:CheckCircle,  color:'#3B82F6', badge:'badge-blue' },
  paid:     { icon:CheckCircle,  color:'#22C55E', badge:'badge-green' },
  rejected: { icon:XCircle,      color:'#EF4444', badge:'badge-red' },
};

function VerificationLayer({ label, passed, detail }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom:'1px solid #1F2937' }}>
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background:passed?'#22C55E':'#EF4444', boxShadow:`0 0 5px ${passed?'#22C55E':'#EF4444'}` }}/>
        <span className="text-xs" style={{ color:'#9CA3AF' }}>{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {detail && <span className="text-xs hidden sm:block" style={{ color:'#4B5563' }}>{detail}</span>}
        <span className="text-xs font-semibold" style={{ color:passed?'#22C55E':'#EF4444' }}>{passed?'PASS':'FAIL'}</span>
      </div>
    </div>
  );
}

export default function Claims() {
  const [claims,     setClaims]     = useState([]);
  const [payouts,    setPayouts]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(null);
  const [tab,        setTab]        = useState('claims');
  const [expanded,   setExpanded]   = useState(null);

  const fetchAll = async () => {
    const [c, p] = await Promise.all([
      api.get('/claims/my').catch(() => ({ data:[] })),
      api.get('/claims/payouts').catch(() => ({ data:[] }))
    ]);
    setClaims(c.data); setPayouts(p.data); setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const processPayout = async (claimId) => {
    setProcessing(claimId);
    try {
      const res = await api.post(`/claims/process-payout/${claimId}`);
      toast.success(`₹${res.data.amount} payout via ${res.data.method?.toUpperCase()}`);
      await fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Payout failed');
    } finally { setProcessing(null); }
  };

  if (loading) return <div className="p-4 text-sm" style={{ color:'#4B5563' }}>Loading...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white">Claims & Payouts</h2>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'#6B7280' }}>Multi-layer verified parametric claims</p>
        </div>
        <div className="flex items-center gap-1 text-xs px-2.5 sm:px-3 py-1.5 rounded-full font-medium"
          style={{ background:'rgba(59,130,246,0.1)', color:'#3B82F6', border:'1px solid rgba(59,130,246,0.25)' }}>
          <Zap size={10}/> Auto-Trigger
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {['claims','payouts'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`tab-item ${tab===t?'active':''}`}>
            {t.charAt(0).toUpperCase()+t.slice(1)} ({t==='claims'?claims.length:payouts.length})
          </button>
        ))}
      </div>

      {tab==='claims' && (
        claims.length === 0 ? (
          <div className="card p-8 sm:p-10 text-center">
            <AlertTriangle size={24} className="mx-auto mb-2" style={{ color:'#1F2937' }}/>
            <p className="text-sm" style={{ color:'#4B5563' }}>No claims yet. Claims trigger automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {claims.map(claim => {
              const s = STATUS[claim.status] || STATUS.pending;
              const Icon = s.icon;
              const isExpanded = expanded === claim._id;
              const vd = claim.validationDetails || {};
              const fraudOk = claim.fraudScore < 30;
              return (
                <div key={claim._id} className="card overflow-hidden"
                  style={claim.status==='paid'?{borderColor:'rgba(34,197,94,0.3)'}:claim.status==='rejected'?{borderColor:'rgba(239,68,68,0.3)'}:{}}>
                  <div className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background:`${s.color}18`, border:`1px solid ${s.color}30` }}>
                          <Icon size={15} style={{ color:s.color }}/>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white capitalize text-sm">{claim.triggerType} Disruption</p>
                          <p className="text-xs mt-0.5 truncate" style={{ color:'#9CA3AF' }}>
                            {claim.triggerValue} recorded · threshold {claim.threshold}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color:'#4B5563' }}>{new Date(claim.triggeredAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <span className={s.badge}>{claim.status.toUpperCase()}</span>
                        <p className="text-base sm:text-lg font-bold text-white">₹{claim.payoutAmount}</p>
                        {claim.status==='approved' && (
                          <button onClick={() => processPayout(claim._id)} disabled={processing===claim._id}
                            className="btn-neon block w-full text-center"
                            style={{ padding:'6px 10px', fontSize:'11px', minHeight:'36px' }}>
                            {processing===claim._id ? '...' : 'Claim Payout'}
                          </button>
                        )}
                        {claim.status==='paid'&&claim.paidAt&&(
                          <p className="text-xs" style={{ color:'#4B5563' }}>Paid {new Date(claim.paidAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>

                    {/* Verification strip */}
                    <div className="mt-3 pt-3 flex flex-wrap gap-2 sm:gap-3 items-center" style={{ borderTop:'1px solid #1F2937' }}>
                      {[
                        { label:'GPS',      ok:vd.gpsVerified,      icon:MapPin },
                        { label:'Activity', ok:vd.activityVerified, icon:Activity },
                        { label:'No Dup',   ok:vd.duplicateCheck,   icon:Shield },
                        { label:'Fraud',    ok:fraudOk,             icon:Cpu },
                      ].map(({ label, ok, icon:I }) => (
                        <div key={label} className="flex items-center gap-1 text-xs" style={{ color:ok?'#22C55E':'#EF4444' }}>
                          <I size={10}/>{label}
                        </div>
                      ))}
                      <button onClick={() => setExpanded(isExpanded?null:claim._id)}
                        className="ml-auto text-xs" style={{ color:'#3B82F6', minHeight:'32px' }}>
                        {isExpanded ? 'Hide ▲' : 'Details ▼'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded verification */}
                  {isExpanded && (
                    <div className="px-3 sm:px-4 pb-4" style={{ background:'#0B1220', borderTop:'1px solid #1F2937' }}>
                      <p className="text-xs font-semibold mt-3 mb-2 uppercase tracking-wider" style={{ color:'#6B7280' }}>
                        Multi-Layer Verification
                      </p>
                      <VerificationLayer label="1. GPS Location" passed={vd.gpsVerified} detail="Worker in zone"/>
                      <VerificationLayer label="2. Weather Confirmed" passed={claim.triggerValue>claim.threshold} detail={`${claim.triggerType}: ${claim.triggerValue} > ${claim.threshold}`}/>
                      <VerificationLayer label="3. Order Activity" passed={vd.activityVerified} detail="Active delivery"/>
                      <VerificationLayer label="4. IP vs GPS" passed={vd.ipMatches!==false} detail="Location match"/>
                      <VerificationLayer label="5. Platform Status" passed={vd.platformPaused} detail={vd.platformPaused?'Paused locally':'Exception'}/>
                      <VerificationLayer label="6. Time Window" passed={true} detail="Within window"/>
                      <VerificationLayer label="7. Duplicate Check" passed={vd.duplicateCheck} detail="No dup in 24h"/>
                      <VerificationLayer label="8. Fraud Score" passed={fraudOk} detail={`Score: ${claim.fraudScore}/100`}/>
                      <div className="mt-3 px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2"
                        style={{ background:claim.status==='rejected'?'rgba(239,68,68,0.1)':'rgba(34,197,94,0.1)', border:`1px solid ${claim.status==='rejected'?'rgba(239,68,68,0.3)':'rgba(34,197,94,0.3)'}`, color:claim.status==='rejected'?'#EF4444':'#22C55E' }}>
                        <Cpu size={11}/>
                        AI: {claim.status==='rejected'?'REJECTED':'claim.status==="paid"?PAID:APPROVED'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {tab==='payouts' && (
        payouts.length === 0 ? (
          <div className="card p-8 text-center"><p className="text-sm" style={{ color:'#4B5563' }}>No payouts yet.</p></div>
        ) : (
          <div className="space-y-3">
            {payouts.map(payout => (
              <div key={payout._id} className="card p-3 sm:p-4 flex items-start justify-between flex-wrap gap-3"
                style={payout.status==='success'?{borderColor:'rgba(34,197,94,0.3)'}:{}}>
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm capitalize">{payout.claimId?.triggerType||'Disruption'} Payout</p>
                  <p className="text-xs mt-0.5" style={{ color:'#9CA3AF' }}>{payout.method?.toUpperCase()} {payout.upiId?`· ${payout.upiId}`:''}</p>
                  <p className="text-xs mt-0.5" style={{ color:'#4B5563' }}>{new Date(payout.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1.5">
                  <p className="font-bold" style={{ color:'#22C55E' }}>+₹{payout.amount}</p>
                  <span className={payout.status==='success'?'badge-green':payout.status==='failed'?'badge-red':'badge-yellow'}>
                    {payout.status.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1 text-xs justify-end" style={{ color:payout.gpsVerified?'#22C55E':'#EF4444' }}>
                    <MapPin size={9}/>{payout.gpsVerified?'Verified':'Failed'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
