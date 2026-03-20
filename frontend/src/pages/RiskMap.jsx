import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../api';
import { MapPin, Thermometer, Wind, Droplets, Navigation } from 'lucide-react';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const userIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;background:#3B82F6;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 15px #3B82F6, 0 0 30px #3B82F6;"></div>`,
  className: 'animate-pulse', iconAnchor: [8, 8]
});

const RISK_COLORS = {
  none: '#22C55E', low: '#FACC15', medium: '#F97316', high: '#EF4444', extreme: '#EF4444'
};

const CITY_CENTERS = {
  Mumbai: [19.076, 72.877], Delhi: [28.704, 77.102], Bangalore: [12.972, 77.594],
  Chennai: [13.083, 80.270], Hyderabad: [17.385, 78.487], Pune: [18.520, 73.856]
};

function FlyTo({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.flyTo(coords, 11, { duration: 1.5 }); }, [coords]);
  return null;
}

export default function RiskMap() {
  const [heatmap, setHeatmap] = useState([]);
  const [userGps, setUserGps] = useState(null);
  const [userRisk, setUserRisk] = useState(null);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const watchRef = useRef(null);

  useEffect(() => {
    api.get('/risk/heatmap').then(r => { setHeatmap(r.data); setLoading(false); }).catch(() => setLoading(false));

    // Live GPS watch
    if (navigator.geolocation) {
      watchRef.current = navigator.geolocation.watchPosition(
        async pos => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setUserGps({ lat, lng });
          api.post('/users/update-gps', { lat, lng }).catch(() => {});

          // Find exact risk zone user is inside
          const zone = await api.get(`/risk/zone?lat=${lat}&lng=${lng}`).then(r => r.data).catch(() => null);
          if (zone) {
            setUserRisk(zone);
            if (['high', 'extreme'].includes(zone.riskLevel)) {
              setNotification(`🚨 You are in a high-risk zone (${zone.name}). Insurance protection active.`);
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('⚠ GigShield Alert', { body: `High risk detected in ${zone.name}` });
              }
            }
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000 }
      );
    }
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  function findNearestCity(lat, lng) {
    // Legacy function, replaced by /risk/zone endpoint, returning null
    return null;
  }

  const sorted = [...heatmap].sort((a, b) => {
    const o = { extreme: 4, high: 3, medium: 2, low: 1, none: 0 };
    return (o[b.riskLevel] || 0) - (o[a.riskLevel] || 0);
  });

  const mapCenter = userGps ? [userGps.lat, userGps.lng] : [20.5937, 78.9629];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Risk Map</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Live GPS tracking + real-time risk zones</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={async () => {
            try {
              api.post('/users/simulate-order', { status: 'active' });
              setNotification("🟢 You are currently on delivery. Insurance protection active.");
            } catch (err) {}
          }} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium cursor-pointer transition"
            style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Simulate Delivery
          </button>
          <button onClick={() => {
            setNotification("🔴 Severe storm simulation active! Map updating...");
            setHeatmap(prev => prev.map(z => z.name === (userRisk?.name || 'Mumbai') ? { ...z, riskLevel: 'high', weather: { ...z.weather, rainfall: 150 } } : z));
            if (userRisk) setUserRisk({ ...userRisk, riskLevel: 'high', weather: { ...userRisk.weather, rainfall: 150 } });
          }} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium cursor-pointer transition"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Force High Risk
          </button>
          {userGps && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>
              <Navigation size={11} className="animate-pulse" />
              Live · {userGps.lat.toFixed(4)}, {userGps.lng.toFixed(4)}
            </div>
          )}
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          {notification}
          <button onClick={() => setNotification(null)} className="ml-auto text-xs" style={{ color: '#6B7280' }}>✕</button>
        </div>
      )}

      {/* User risk status */}
      {userRisk && (
        <div className="card p-4 flex items-center gap-4 flex-wrap"
          style={{ borderColor: `${RISK_COLORS[userRisk.riskLevel]}40` }}>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ background: RISK_COLORS[userRisk.riskLevel], boxShadow: `0 0 8px ${RISK_COLORS[userRisk.riskLevel]}` }} />
            <span className="text-sm font-semibold text-white">📍 {userRisk.name} Geo-Zone</span>
          </div>
          <span className="text-sm" style={{ color: RISK_COLORS[userRisk.riskLevel] }}>
            ⚠ Risk: {userRisk.riskLevel?.toUpperCase()}
          </span>
          <span className="text-sm" style={{ color: '#9CA3AF' }}>🌧 {userRisk.weather?.rainfall || 0}mm</span>
          <span className="text-sm" style={{ color: '#9CA3AF' }}>💨 AQI {userRisk.aqi}</span>
          <span className="text-sm" style={{ color: '#9CA3AF' }}>🌡 {userRisk.weather?.temperature}°C</span>
        </div>
      )}

      {/* Leaflet Map */}
      <div className="card overflow-hidden" style={{ height: 420, border: '1px solid rgba(59,130,246,0.25)', boxShadow: '0 0 25px rgba(59,130,246,0.12)' }}>
        {!loading && (
          <MapContainer center={mapCenter} zoom={5} style={{ height: '100%', width: '100%', background: '#0B1220' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CARTO'
            />
            {userGps && <FlyTo coords={[userGps.lat, userGps.lng]} />}

            {/* Zone risk circles */}
            {heatmap.map(zone => {
              const color = RISK_COLORS[zone.riskLevel] || '#22C55E';
              return (
                <Circle key={zone._id || zone.name}
                  center={[zone.center.lat, zone.center.lng]}
                  radius={zone.radius}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 1.5 }}>
                  <Popup>
                    <div style={{ background: '#111827', color: '#E5E7EB', padding: 8, borderRadius: 8, minWidth: 140 }}>
                      <p style={{ fontWeight: 700, marginBottom: 4 }}>{zone.name} Geo-Zone</p>
                      <p style={{ fontSize: 11, color: color }}>Risk: {zone.riskLevel?.toUpperCase()}</p>
                      <p style={{ fontSize: 11 }}>Rain: {zone.weather?.rainfall}mm · AQI: {zone.aqi}</p>
                      <p style={{ fontSize: 11 }}>Temp: {zone.weather?.temperature}°C</p>
                    </div>
                  </Popup>
                </Circle>
              );
            })}

            {/* User live marker */}
            {userGps && (
              <Marker position={[userGps.lat, userGps.lng]} icon={userIcon}>
                <Popup>
                  <div style={{ background: '#111827', color: '#E5E7EB', padding: 8, borderRadius: 8 }}>
                    <p style={{ fontWeight: 700 }}>📍 Your Location</p>
                    <p style={{ fontSize: 11 }}>{userGps.lat.toFixed(4)}, {userGps.lng.toFixed(4)}</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        )}
      </div>

      {/* Zone Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map(zone => {
          const color = RISK_COLORS[zone.riskLevel] || '#22C55E';
          return (
            <div key={zone._id || zone.name} className="card p-4 transition-transform hover:-translate-y-1 hover:shadow-lg"
              style={{ borderLeft: `3px solid ${color}`,  boxShadow: `0 4px 20px ${color}15` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin size={14} style={{ color }} />
                  <span className="font-semibold text-white text-sm">{zone.name} Zone</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                    {zone.riskLevel?.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Droplets, label: 'Rain', value: `${zone.weather?.rainfall || 0}mm`, alert: (zone.weather?.rainfall || 0) > 50 },
                  { icon: Thermometer, label: 'Temp', value: `${zone.weather?.temperature || 30}°C`, alert: (zone.weather?.temperature || 30) > 42 },
                  { icon: Wind, label: 'AQI', value: zone.aqi || 50, alert: (zone.aqi || 50) > 200 },
                ].map(({ icon: I, label, value, alert }) => (
                  <div key={label} className="rounded-xl p-2.5 text-center"
                    style={{ background: alert ? 'rgba(239,68,68,0.1)' : '#0B1220', border: `1px solid ${alert ? 'rgba(239,68,68,0.25)' : '#1F2937'}` }}>
                    <I size={12} className="mx-auto mb-1" style={{ color: alert ? '#EF4444' : '#4B5563' }} />
                    <p className="text-xs" style={{ color: '#6B7280' }}>{label}</p>
                    <p className="text-sm font-bold" style={{ color: alert ? '#EF4444' : '#E5E7EB' }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="card p-4">
        <p className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: '#6B7280' }}>Risk Legend</p>
        <div className="flex flex-wrap gap-4">
          {Object.entries(RISK_COLORS).map(([level, color]) => (
            <div key={level} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
              <span className="text-xs capitalize font-medium" style={{ color: '#9CA3AF' }}>{level}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 grid grid-cols-3 gap-3 text-xs" style={{ borderTop: '1px solid #1F2937', color: '#4B5563' }}>
          <div>🌧 Rain &gt; 50mm → High</div>
          <div>🌡 Temp &gt; 42°C → High</div>
          <div>💨 AQI &gt; 200 → High</div>
        </div>
      </div>
    </div>
  );
}
