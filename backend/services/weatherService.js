const axios = require('axios');
const RiskData  = require('../models/RiskData');
const RiskZone  = require('../models/RiskZone');
const Claim     = require('../models/Claim');
const ClaimHistory = require('../models/ClaimHistory');
const Policy    = require('../models/Policy');
const User      = require('../models/User');

const CITY_COORDS = {
  Mumbai:    { lat: 19.076, lng: 72.877 },
  Delhi:     { lat: 28.704, lng: 77.102 },
  Bangalore: { lat: 12.972, lng: 77.594 },
  Chennai:   { lat: 13.083, lng: 80.270 },
  Hyderabad: { lat: 17.385, lng: 78.487 },
  Pune:      { lat: 18.520, lng: 73.856 },
  Coimbatore:{ lat: 11.017, lng: 76.958 },
  Pollachi:  { lat: 10.592, lng: 77.007 }
};

async function fetchWeatherData(city) {
  const coords = CITY_COORDS[city] || CITY_COORDS['Mumbai'];
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey || apiKey === 'your_openweather_api_key') return getMockWeatherData(city);
    const res = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lng}&appid=${apiKey}&units=metric`
    );
    const d = res.data;
    return { rainfall: d.rain?.['1h'] || 0, temperature: d.main.temp, humidity: d.main.humidity, windSpeed: d.wind.speed, description: d.weather[0].description };
  } catch { return getMockWeatherData(city); }
}

async function fetchWeatherByCoords(lat, lng) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey || apiKey === 'your_openweather_api_key') return getMockWeatherData('Mumbai');
    const res = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`
    );
    const d = res.data;
    return { rainfall: d.rain?.['1h'] || 0, temperature: d.main.temp, humidity: d.main.humidity, windSpeed: d.wind.speed, description: d.weather[0].description };
  } catch { return getMockWeatherData('Mumbai'); }
}

function getMockWeatherData() {
  const scenarios = [
    { rainfall: 0,  temperature: 32, humidity: 60, windSpeed: 10, description: 'clear sky' },
    { rainfall: 25, temperature: 28, humidity: 85, windSpeed: 20, description: 'moderate rain' },
    { rainfall: 65, temperature: 26, humidity: 95, windSpeed: 35, description: 'heavy rain' },
    { rainfall: 5,  temperature: 44, humidity: 30, windSpeed: 15, description: 'hot and dry' }
  ];
  return scenarios[Math.floor(Math.random() * scenarios.length)];
}

async function fetchAQIData(city) {
  const coords = CITY_COORDS[city] || CITY_COORDS['Mumbai'];
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey || apiKey === 'your_openweather_api_key') return getMockAQI();
    const res = await axios.get(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${coords.lat}&lon=${coords.lng}&appid=${apiKey}`
    );
    const aqi = res.data.list[0].main.aqi * 50;
    return { aqi, category: getAQICategory(aqi) };
  } catch { return getMockAQI(); }
}

function getMockAQI() {
  const aqi = Math.floor(Math.random() * 400) + 50;
  return { aqi, category: getAQICategory(aqi) };
}

function getAQICategory(aqi) {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

function getDisruptionLevel(weather, aqi) {
  if (weather.rainfall > 80 || aqi > 350 || weather.temperature > 45) return 'extreme';
  if (weather.rainfall > 50 || aqi > 250 || weather.temperature > 42) return 'high';
  if (weather.rainfall > 25 || aqi > 200 || weather.temperature > 38) return 'medium';
  if (weather.rainfall > 10 || aqi > 150) return 'low';
  return 'none';
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isInsideZone(userLat, userLng, zone) {
  const distKm = haversineKm(userLat, userLng, zone.center.lat, zone.center.lng);
  return (distKm * 1000) <= zone.radius;
}

function verifyUserLocationForZone(user, zone) {
  const userLat = user.currentGps?.lat || user.location.lat;
  const userLng = user.currentGps?.lng || user.location.lng;
  const inside  = isInsideZone(userLat, userLng, zone);
  const distKm  = haversineKm(userLat, userLng, zone.center.lat, zone.center.lng);
  if (!inside) return { verified: false, reason: `GPS not inside zone ${zone.name}`, distanceKm: distKm };
  if (user.gpsHistory?.length >= 2) {
    const [a, b] = user.gpsHistory.slice(-2);
    if (haversineKm(a.lat, a.lng, b.lat, b.lng) > 500)
      return { verified: false, reason: 'Suspicious GPS jump' };
  }
  return { verified: true, distanceKm: distKm };
}

// ── PHASE 3: Check disruption for a specific city ──────────────────────────
async function checkCityDisruption(city) {
  const weather  = await fetchWeatherData(city);
  const aqiData  = await fetchAQIData(city);
  const level    = getDisruptionLevel(weather, aqiData.aqi);
  return { city, weather, aqi: aqiData.aqi, aqiCategory: aqiData.category, disruptionLevel: level };
}

// PHASE 3: Get eligible cities for a user (home + work)
function getUserCities(user) {
  const cities = [];
  const primaryCity = user.location?.city;
  if (primaryCity) cities.push({ city: primaryCity, type: 'work' });
  if (user.homeCity && user.homeCity !== primaryCity) cities.push({ city: user.homeCity, type: 'home' });
  if (user.workCity && user.workCity !== primaryCity && user.workCity !== user.homeCity)
    cities.push({ city: user.workCity, type: 'work' });
  // Deduplicate
  return cities.filter((v, i, arr) => arr.findIndex(x => x.city === v.city) === i);
}

async function monitorAndTriggerClaims() {
  const count = await RiskZone.countDocuments();
  if (count === 0) {
    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      await RiskZone.create({ name: city, center: { lat: coords.lat, lng: coords.lng }, radius: 50000 });
    }
  }

  const zones = await RiskZone.find();
  for (const zone of zones) {
    const weather = await fetchWeatherByCoords(zone.center.lat, zone.center.lng);
    const aqiData = await fetchAQIData(zone.name);
    const disruptionLevel = getDisruptionLevel(weather, aqiData.aqi);
    const alerts = [];
    if (weather.rainfall > 50) alerts.push(`Heavy rainfall: ${weather.rainfall}mm`);
    if (aqiData.aqi > 200)     alerts.push(`Poor AQI: ${aqiData.aqi}`);
    if (weather.temperature > 42) alerts.push(`Extreme heat: ${weather.temperature}°C`);

    Object.assign(zone, { riskLevel: disruptionLevel, weather, aqi: aqiData.aqi, alerts, lastUpdated: new Date() });
    await zone.save();

    await new RiskData({ city: zone.name, lat: zone.center.lat, lng: zone.center.lng, weather, aqi: aqiData.aqi, aqiCategory: aqiData.category, disruptionLevel, alerts }).save();

    if (['high', 'extreme'].includes(disruptionLevel)) {
      await triggerAutoClaims(zone, weather, aqiData.aqi);
    }
  }
}

async function triggerAutoClaims(zone, weather, aqi) {
  const users = await User.find({ isActive: true });
  for (const user of users) {
    const policy = await Policy.findOne({ userId: user._id, status: 'active' });
    if (!policy) continue;

    // PHASE 3: Check if this zone matches any of the user's cities
    const userCities = getUserCities(user);
    const cityMatch  = userCities.find(c => c.city === zone.name);
    if (!cityMatch) continue;  // Zone doesn't affect this user

    const gpsCheck = verifyUserLocationForZone(user, zone);

    let triggerType = null, triggerValue = 0, threshold = 0;
    if (weather.rainfall > policy.thresholds.rainfall)   { triggerType = 'rainfall';    triggerValue = weather.rainfall;    threshold = policy.thresholds.rainfall; }
    else if (aqi > policy.thresholds.aqi)                { triggerType = 'aqi';         triggerValue = aqi;                threshold = policy.thresholds.aqi; }
    else if (weather.temperature > policy.thresholds.temperature) { triggerType = 'temperature'; triggerValue = weather.temperature; threshold = policy.thresholds.temperature; }
    if (!triggerType) continue;

    const existingClaim = await Claim.findOne({ userId: user._id, triggerType, triggeredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    if (existingClaim) continue;

    const ipMatches = verifyIpVsGps(user, gpsCheck.verified);
    const isPlatformPaused = ['high', 'extreme'].includes(getDisruptionLevel(weather, aqi));
    const isOrderActive = user.currentOrder?.status === 'active';
    const fraudScore = calculateFraudScore(user, gpsCheck.verified, ipMatches);
    const payoutAmount = policy.coverageAmount * 0.25;
    const autoApprove = gpsCheck.verified && ipMatches && fraudScore < 30;

    const claim = new Claim({
      userId: user._id, policyId: policy._id,
      affectedCity: zone.name, cityType: cityMatch.type,
      triggerType, triggerValue, threshold, payoutAmount, fraudScore,
      status: autoApprove ? 'approved' : (gpsCheck.verified ? 'pending' : 'rejected'),
      validationDetails: { gpsVerified: gpsCheck.verified, activityVerified: isOrderActive, ipMatches, platformPaused: isPlatformPaused, duplicateCheck: true, anomalyScore: fraudScore, riskZoneId: zone._id }
    });
    await claim.save();

    // PHASE 4: Write to ClaimHistory
    await ClaimHistory.create({
      userId: user._id, claimId: claim._id,
      claimReason: `${triggerType} disruption in ${cityMatch.type} city (${zone.name})`,
      affectedCity: zone.name, cityType: cityMatch.type,
      payoutAmount, status: claim.status,
      weatherData: { rainfall: weather.rainfall, temperature: weather.temperature, aqi, description: weather.description },
      triggerType, triggerValue, riskScore: user.riskScore || 50
    });

    // Push history ref to user
    await User.findByIdAndUpdate(user._id, { $push: { claimHistory: claim._id } });
  }
}

function calculateFraudScore(user, gpsVerified, ipMatches) {
  let score = 0;
  if (!gpsVerified) score += 40;
  if (!ipMatches)   score += 30;
  if (user.trustScore < 70) score += 25;
  if (user.trustScore < 50) score += 20;
  return Math.min(score, 100);
}

function verifyIpVsGps(user, gpsVerified) {
  if (!user.ipAddress) return true;
  return gpsVerified;
}

module.exports = {
  fetchWeatherData, fetchWeatherByCoords, fetchAQIData, checkCityDisruption,
  monitorAndTriggerClaims, getDisruptionLevel, isInsideZone,
  verifyUserLocationForZone, getUserCities, CITY_COORDS
};
