import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../api';
import { Shield, MapPin, Briefcase, DollarSign } from 'lucide-react';

const CITIES    = ['Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Pune','Coimbatore','Pollachi','Other'];
const PLATFORMS = ['Swiggy','Zomato','Zepto','Blinkit','Dunzo','Other'];
const CITY_COORDS = {
  Mumbai:{lat:19.076,lng:72.877},Delhi:{lat:28.704,lng:77.102},Bangalore:{lat:12.972,lng:77.594},
  Chennai:{lat:13.083,lng:80.270},Hyderabad:{lat:17.385,lng:78.487},Pune:{lat:18.520,lng:73.856},
  Coimbatore:{lat:11.017,lng:76.958},Pollachi:{lat:10.592,lng:77.007},Other:{lat:20.5937,lng:78.9629}
};

const lbl = 'block text-xs font-semibold mb-1.5 uppercase tracking-wider';
const clr = { color: '#6B7280' };
const inp = { fontSize: '16px' }; // prevents iOS zoom

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name:'',email:'',password:'',phone:'',platform:'Swiggy',customPlatform:'',workerId:'',
    city:'Mumbai',homeCity:'Mumbai',customHomeCity:'',workCity:'Mumbai',customWorkCity:'',
    weeklyIncome:'',averageDailyIncome:'',averageOrdersPerDay:'',onlineHoursPerDay:'',
    aadhaarNumber:'',
    aadhaarCardFile:null,
    workerIdCardFile:null,
    platformScreenshotFile:null
  });
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const actualHomeCity = form.homeCity==='Other' ? form.customHomeCity : form.homeCity;
  const actualWorkCity = form.workCity==='Other' ? form.customWorkCity : form.workCity;

  const uploadFile = async (file) => {
    if (!file) return '';
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await api.post('/users/upload', {
            name: file.name,
            base64: reader.result
          });
          resolve(res.data.url);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!/^\d{12}$/.test(form.aadhaarNumber)) return toast.error('Aadhaar must be 12 digits');
    if(!actualHomeCity) return toast.error('Enter home city');
    if(!actualWorkCity) return toast.error('Enter work city');
    setLoading(true);
    try {
      let aadhaarCardUrl = '', workerIdCardUrl = '', platformScreenshotUrl = '';
      if (form.aadhaarCardFile || form.workerIdCardFile || form.platformScreenshotFile) {
        toast.loading('Uploading documents...', { id: 'regUpload' });
        try {
          aadhaarCardUrl = await uploadFile(form.aadhaarCardFile);
          workerIdCardUrl = await uploadFile(form.workerIdCardFile);
          platformScreenshotUrl = await uploadFile(form.platformScreenshotFile);
        } catch(uploadErr) {
          console.error('Upload error:', uploadErr);
          toast.dismiss('regUpload');
          toast.error('Document upload failed. Proceeding without documents.');
        }
        toast.dismiss('regUpload');
      }

      const locationCity = actualHomeCity || 'Mumbai';
      const coords = CITY_COORDS[locationCity] || CITY_COORDS[form.homeCity] || { lat: 20.5937, lng: 78.9629 };
      await register({
        name:form.name,email:form.email,password:form.password,phone:form.phone,
        platform:form.platform,customPlatform:form.customPlatform,workerId:form.workerId,
        aadhaarNumber:form.aadhaarNumber,
        aadhaarCardUrl,
        workerIdCardUrl,
        platformScreenshotUrl,
        location:{ city: locationCity, lat: coords.lat, lng: coords.lng },
        homeCity:form.homeCity,workCity:form.workCity,
        customHomeCity:form.customHomeCity,customWorkCity:form.customWorkCity,
        weeklyIncome:Number(form.weeklyIncome),
        averageDailyIncome:Number(form.averageDailyIncome)||Math.round(Number(form.weeklyIncome)/6),
        averageOrdersPerDay:Number(form.averageOrdersPerDay)||0,
        onlineHoursPerDay:Number(form.onlineHoursPerDay)||0
      });
      toast.success('Account created! Pending admin verification.');
      navigate('/login');
    } catch(err) {
      toast.dismiss('regUpload');
      toast.error(err.response?.data?.error||'Registration failed');
    } finally { setLoading(false); }
  };

  const steps = ['Basic Info','Work Details','Verification'];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background:'#0B1220' }}>
      <div className="card w-full max-w-lg p-5 sm:p-8 relative z-10">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{background:'linear-gradient(135deg,#22C55E,#3B82F6,#8B5CF6)',boxShadow:'0 0 24px rgba(59,130,246,0.4)'}}>
            <Shield size={20} className="text-white"/>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-white">Create your account</h1>
          <p className="text-xs sm:text-sm mt-1" style={clr}>GigShield — Income Protection</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-6">
          {steps.map((label,i)=>{
            const s=i+1;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{background:step>=s?'linear-gradient(135deg,#22C55E,#3B82F6)':'#1F2937',color:step>=s?'#fff':'#4B5563'}}>
                    {s}
                  </div>
                  <span className="text-xs hidden sm:block" style={{color:step>=s?'#9CA3AF':'#4B5563'}}>{label}</span>
                </div>
                {s<3&&<div className="flex-1 h-px mx-2" style={{background:step>s?'#22C55E':'#1F2937'}}/>}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Step 1 */}
          {step===1&&(
            <div className="space-y-3">
              <div>
                <label className={lbl} style={clr}>Full Name</label>
                <input value={form.name} onChange={e=>set('name',e.target.value)} required className="input-dark w-full" style={inp} placeholder="Your name"/>
              </div>
              <div>
                <label className={lbl} style={clr}>Email</label>
                <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} required className="input-dark w-full" style={inp} placeholder="email@example.com"/>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={lbl} style={clr}>Password</label>
                  <input type="password" value={form.password} onChange={e=>set('password',e.target.value)} required className="input-dark w-full" style={inp}/>
                </div>
                <div>
                  <label className={lbl} style={clr}>Phone</label>
                  <input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} required className="input-dark w-full" style={inp} placeholder="10-digit"/>
                </div>
                <div>
                  <label className={lbl} style={clr}>Platform</label>
                  <select value={form.platform} onChange={e=>set('platform',e.target.value)} className="input-dark w-full" style={inp}>
                    {PLATFORMS.map(p=><option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl} style={clr}>Worker ID</label>
                  <input value={form.workerId} onChange={e=>set('workerId',e.target.value)} required className="input-dark w-full" style={inp} placeholder="Platform Worker ID"/>
                </div>
              </div>
              {form.platform==='Other'&&(
                <div>
                  <label className={lbl} style={clr}>Platform Name</label>
                  <input value={form.customPlatform} onChange={e=>set('customPlatform',e.target.value)} required className="input-dark w-full" style={inp}/>
                </div>
              )}
              <button type="button" onClick={()=>setStep(2)} className="btn-neon w-full mt-2" style={{minHeight:'44px'}}>
                Next — Work Details →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step===2&&(
            <div className="space-y-3">
              {/* Location */}
              <div className="p-3 rounded-xl" style={{background:'#0B1220',border:'1px solid #1F2937'}}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={13} style={{color:'#3B82F6'}}/>
                  <span className="text-xs font-semibold text-white uppercase tracking-wide">Location</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl} style={clr}>Home City</label>
                    <select value={form.homeCity} onChange={e=>set('homeCity',e.target.value)} className="input-dark w-full" style={inp}>
                      {CITIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                    {form.homeCity==='Other'&&<input value={form.customHomeCity} onChange={e=>set('customHomeCity',e.target.value)} className="input-dark w-full mt-2" style={inp} placeholder="Enter home city" required/>}
                    <p className="text-xs mt-1" style={{color:'#4B5563'}}>Where you live</p>
                  </div>
                  <div>
                    <label className={lbl} style={clr}>Work City</label>
                    <select value={form.workCity} onChange={e=>set('workCity',e.target.value)} className="input-dark w-full" style={inp}>
                      {CITIES.map(c=><option key={c}>{c}</option>)}
                    </select>
                    {form.workCity==='Other'&&<input value={form.customWorkCity} onChange={e=>set('customWorkCity',e.target.value)} className="input-dark w-full mt-2" style={inp} placeholder="Enter work city" required/>}
                    <p className="text-xs mt-1" style={{color:'#4B5563'}}>Where you deliver</p>
                  </div>
                </div>
                {actualHomeCity&&actualWorkCity&&actualHomeCity!==actualWorkCity&&(
                  <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{background:'rgba(59,130,246,0.1)',color:'#3B82F6',border:'1px solid rgba(59,130,246,0.25)'}}>
                    ✓ Claims eligible in both {actualHomeCity} and {actualWorkCity}
                  </div>
                )}
              </div>

              {/* Income */}
              <div className="p-3 rounded-xl" style={{background:'#0B1220',border:'1px solid #1F2937'}}>
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={13} style={{color:'#22C55E'}}/>
                  <span className="text-xs font-semibold text-white uppercase tracking-wide">Income</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl} style={clr}>Weekly Income (₹)</label>
                    <input type="number" inputMode="numeric" value={form.weeklyIncome} onChange={e=>set('weeklyIncome',e.target.value)} required className="input-dark w-full" style={inp} placeholder="e.g. 3500"/>
                  </div>
                  <div>
                    <label className={lbl} style={clr}>Daily Income (₹)</label>
                    <input type="number" inputMode="numeric" value={form.averageDailyIncome} onChange={e=>set('averageDailyIncome',e.target.value)} className="input-dark w-full" style={inp} placeholder="Auto-calc"/>
                  </div>
                </div>
              </div>

              {/* Activity */}
              <div className="p-3 rounded-xl" style={{background:'#0B1220',border:'1px solid #1F2937'}}>
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase size={13} style={{color:'#8B5CF6'}}/>
                  <span className="text-xs font-semibold text-white uppercase tracking-wide">Activity</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl} style={clr}>Avg Orders/Day</label>
                    <input type="number" inputMode="numeric" value={form.averageOrdersPerDay} onChange={e=>set('averageOrdersPerDay',e.target.value)} className="input-dark w-full" style={inp} placeholder="e.g. 12"/>
                  </div>
                  <div>
                    <label className={lbl} style={clr}>Online Hours/Day</label>
                    <input type="number" inputMode="numeric" value={form.onlineHoursPerDay} onChange={e=>set('onlineHoursPerDay',e.target.value)} className="input-dark w-full" style={inp} placeholder="e.g. 8"/>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={()=>setStep(1)} className="btn-outline flex-1" style={{minHeight:'44px'}}>← Back</button>
                <button type="button" onClick={()=>setStep(3)} className="btn-neon flex-1" style={{minHeight:'44px'}}>Next →</button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step===3&&(
            <div className="space-y-3">
              <div className="p-3 rounded-xl" style={{background:'#0B1220',border:'1px solid #1F2937'}}>
                <div className="flex items-center gap-2 mb-1">
                  <Shield size={13} style={{color:'#F59E0B'}}/>
                  <span className="text-xs font-semibold text-white uppercase tracking-wide">Identity Verification</span>
                </div>
                <p className="text-xs mb-3" style={clr}>Required to verify you are a real gig worker</p>
                <div className="space-y-3">
                  <div>
                    <label className={lbl} style={clr}>Aadhaar Number</label>
                    <input value={form.aadhaarNumber}
                      onChange={e=>set('aadhaarNumber',e.target.value.replace(/\D/g,'').slice(0,12))}
                      required className="input-dark w-full" style={inp} placeholder="12-digit Aadhaar" maxLength={12} inputMode="numeric"/>
                    <p className="text-xs mt-1" style={{color:'#4B5563'}}>{form.aadhaarNumber.length}/12 digits</p>
                  </div>
                  <div>
                    <label className={lbl} style={clr}>Upload Aadhaar Card</label>
                    <input type="file" accept="image/*,.pdf" onChange={e=>set('aadhaarCardFile',e.target.files[0])}
                      className="input-dark w-full cursor-pointer" required/>
                    <p className="text-xs mt-1" style={{color:'#4B5563'}}>Aadhaar front side (image or PDF)</p>
                  </div>
                  <div>
                    <label className={lbl} style={clr}>Upload Worker ID Card</label>
                    <input type="file" accept="image/*,.pdf" onChange={e=>set('workerIdCardFile',e.target.files[0])}
                      className="input-dark w-full cursor-pointer" required/>
                    <p className="text-xs mt-1" style={{color:'#4B5563'}}>Worker ID proof (image or PDF)</p>
                  </div>
                  <div>
                    <label className={lbl} style={clr}>Upload Platform Screenshot</label>
                    <input type="file" accept="image/*" onChange={e=>set('platformScreenshotFile',e.target.files[0])}
                      className="input-dark w-full cursor-pointer" required/>
                    <p className="text-xs mt-1" style={{color:'#4B5563'}}>Gig platform active profile screen capture</p>
                  </div>
                </div>
              </div>
              <div className="px-3 py-2 rounded-lg text-xs" style={{background:'rgba(245,158,11,0.1)',color:'#F59E0B',border:'1px solid rgba(245,158,11,0.25)'}}>
                ⏳ Account pending admin review before policies can be purchased.
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setStep(2)} className="btn-outline flex-1" style={{minHeight:'44px'}}>← Back</button>
                <button type="submit" disabled={loading} className="btn-neon flex-1" style={{minHeight:'44px'}}>
                  {loading?'Creating...':'Create Account'}
                </button>
              </div>
            </div>
          )}
        </form>

        <p className="text-center text-sm mt-5" style={clr}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold" style={{color:'#3B82F6'}}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
