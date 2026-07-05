const axios = require('axios');
const RiskData  = require('../models/RiskData');
const RiskZone  = require('../models/RiskZone');
const Claim     = require('../models/Claim');
const ClaimHistory = require('../models/ClaimHistory');
const Policy    = require('../models/Policy');
const User      = require('../models/User');
const Notification = require('../models/Notification');
const webpush = require('web-push');

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

async function createAndSendNotifications(zone, weather, aqiData) {
  try {
    const users = await User.find({ isActive: true });
    
    // Set VAPID keys if set
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        'mailto:support@gigshield.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    } else {
      // Development defaults
      webpush.setVapidDetails(
        'mailto:support@gigshield.com',
        'BEl62iUZGWDwE27gduOhIG91BroJ5F78KQt7gJH6M7d1fOa-YlZ48zP_XzXg2u_GfUoFUXx_E8L9f8X9f8X9f8X',
        'your-vapid-private-key'
      );
    }

    // Determine alerts to generate
    const conditions = [];
    if (weather.rainfall > 80) {
      conditions.push({ type: 'Flood Alert', severity: 'extreme', value: weather.rainfall, unit: 'mm', msg: `Flood warning generated. Your location has received ${weather.rainfall}mm rainfall.` });
    } else if (weather.rainfall > 50) {
      conditions.push({ type: 'Heavy Rain Alert', severity: 'high', value: weather.rainfall, unit: 'mm', msg: `Heavy Rain Alert. Your location has received ${weather.rainfall}mm rainfall.` });
    }

    if (aqiData.aqi > 200) {
      conditions.push({ type: 'AQI Alert', severity: aqiData.aqi > 300 ? 'extreme' : 'high', value: aqiData.aqi, unit: '', msg: `AQI is high at ${aqiData.aqi}. Extreme air pollution detected.` });
    }

    if (weather.temperature > 42) {
      conditions.push({ type: 'Heatwave Alert', severity: 'extreme', value: weather.temperature, unit: '°C', msg: `Heatwave Warning. High temperature of ${weather.temperature}°C detected.` });
    }

    if (weather.windSpeed > 25) {
      conditions.push({ type: 'Cyclone Alert', severity: 'extreme', value: weather.windSpeed, unit: ' km/h', msg: `Cyclone Alert. Heavy wind speeds of ${weather.windSpeed} km/h detected.` });
    }

    for (const user of users) {
      // Check if user is associated with this city (primary, home, or work)
      const primaryCity = user.location?.city;
      let cityType = null;
      if (user.workCity === zone.name || primaryCity === zone.name) cityType = 'work';
      else if (user.homeCity === zone.name) cityType = 'home';

      if (!cityType) continue;

      for (const cond of conditions) {
        // Prevent duplicate alerts in the last 4 hours
        const recent = await Notification.findOne({
          userId: user._id,
          city: zone.name,
          alertType: cond.type,
          timestamp: { $gte: new Date(Date.now() - 4 * 60 * 60 * 1000) }
        });

        if (!recent) {
          const capitalizedCityType = cityType.charAt(0).toUpperCase() + cityType.slice(1);
          const message = `⚠ ${cond.type} - ${capitalizedCityType} City: ${zone.name}. ${cond.msg} Possible income disruption detected.`;

          await Notification.create({
            userId: user._id,
            city: zone.name,
            alertType: cond.type,
            severity: cond.severity,
            message,
            isRead: false
          });

          // Send browser push notification if subscription exists
          if (user.pushSubscription) {
            try {
              await webpush.sendNotification(
                user.pushSubscription,
                JSON.stringify({
                  title: `🔔 GigShield Alert`,
                  body: `${cond.type}: Your ${cityType} city ${zone.name} has received ${cond.value}${cond.unit} ${cond.type.toLowerCase().includes('rain') ? 'rainfall' : cond.type.toLowerCase().includes('heat') ? 'heat' : 'levels'}. Possible income disruption detected.`,
                  url: '/notifications'
                })
              );
            } catch (err) {
              console.error('Failed to trigger web push notification:', err.message);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error running createAndSendNotifications:', err.message);
  }
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
    if (weather.windSpeed > 25) alerts.push(`Gale/Cyclone warning: ${weather.windSpeed} km/h wind`);

    Object.assign(zone, { riskLevel: disruptionLevel, weather, aqi: aqiData.aqi, alerts, lastUpdated: new Date() });
    await zone.save();

    await new RiskData({ city: zone.name, lat: zone.center.lat, lng: zone.center.lng, weather, aqi: aqiData.aqi, aqiCategory: aqiData.category, disruptionLevel, alerts }).save();

    // Trigger alerts/notifications
    // await createAndSendNotifications(zone, weather, aqiData);

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

    // Dual-city eligibility: BOTH home and work city must be affected
    const eligibility = await checkDualCityEligibility(user);
    if (!eligibility.eligible) continue;

    // Only trigger for the matched trigger type
    const triggerType  = eligibility.matchedTrigger;
    const triggerValue = triggerType === 'rainfall' ? weather.rainfall : triggerType === 'aqi' ? aqi : weather.temperature;
    const threshold    = policy.thresholds[triggerType];

    const existingClaim = await Claim.findOne({ userId: user._id, triggerType, triggeredAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    if (existingClaim) continue;

    const gpsCheck       = verifyUserLocationForZone(user, zone);
    const ipMatches      = verifyIpVsGps(user, gpsCheck.verified);
    const isPlatformPaused = ['high', 'extreme'].includes(getDisruptionLevel(weather, aqi));
    const isOrderActive  = user.currentOrder?.status === 'active';
    const fraudScore     = calculateFraudScore(user, gpsCheck.verified, ipMatches);
    const payoutAmount   = policy.coverageAmount * 0.25;
    const autoApprove    = gpsCheck.verified && ipMatches && fraudScore < 30;

    const claim = new Claim({
      userId: user._id, policyId: policy._id,
      affectedCity: zone.name, cityType: 'work',
      claimReason: `${triggerType} disruption in both ${eligibility.homeCity} and ${eligibility.workCity}`,
      triggerType, triggerValue, threshold, payoutAmount, fraudScore,
      status: autoApprove ? 'approved' : (gpsCheck.verified ? 'pending' : 'rejected'),
      validationDetails: {
        gpsVerified: gpsCheck.verified, activityVerified: isOrderActive,
        ipMatches, platformPaused: isPlatformPaused, duplicateCheck: true,
        anomalyScore: fraudScore, riskZoneId: zone._id,
        dualCityVerified: true,
        homeCityData: { city: eligibility.homeCity, rainfall: eligibility.homeData.weather.rainfall, aqi: eligibility.homeData.aqi, temperature: eligibility.homeData.weather.temperature },
        workCityData: { city: eligibility.workCity, rainfall: eligibility.workData.weather.rainfall, aqi: eligibility.workData.aqi, temperature: eligibility.workData.weather.temperature }
      }
    });
    await claim.save();

    await ClaimHistory.create({
      userId: user._id, claimId: claim._id,
      claimReason: claim.claimReason,
      affectedCity: zone.name, cityType: 'work',
      payoutAmount, status: claim.status,
      weatherData: { rainfall: weather.rainfall, temperature: weather.temperature, aqi, description: weather.description },
      triggerType, triggerValue, riskScore: user.riskScore || 50
    });

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

// ── Dual-city eligibility check ───────────────────────────────────────────────
async function checkDualCityEligibility(user) {
  const homeCity = user.homeCity === 'Other' ? user.customHomeCity : user.homeCity;
  const workCity = user.workCity === 'Other' ? user.customWorkCity : user.workCity;

  if (!homeCity || !workCity) {
    return { eligible: false, reason: 'Home city or work city not set', homeData: null, workData: null };
  }

  const [homeData, workData] = await Promise.all([
    checkCityDisruption(homeCity),
    checkCityDisruption(workCity)
  ]);

  const THRESHOLDS = { rainfall: 50, aqi: 200, temperature: 42 };

  const homeTriggers = {
    rainfall:    homeData.weather.rainfall    >= THRESHOLDS.rainfall,
    aqi:         homeData.aqi                 >= THRESHOLDS.aqi,
    temperature: homeData.weather.temperature >= THRESHOLDS.temperature
  };
  const workTriggers = {
    rainfall:    workData.weather.rainfall    >= THRESHOLDS.rainfall,
    aqi:         workData.aqi                 >= THRESHOLDS.aqi,
    temperature: workData.weather.temperature >= THRESHOLDS.temperature
  };

  // Find which trigger type satisfies BOTH cities
  const matchedTrigger = Object.keys(THRESHOLDS).find(t => homeTriggers[t] && workTriggers[t]);
  const eligible = !!matchedTrigger;

  let reason = '';
  if (!eligible) {
    const activeInHome = Object.keys(homeTriggers).filter(t => homeTriggers[t]);
    const activeInWork = Object.keys(workTriggers).filter(t => workTriggers[t]);
    if (!activeInHome.length && !activeInWork.length) reason = 'No weather disruption in either city';
    else if (activeInHome.length && !activeInWork.length) reason = `Disruption only in home city (${homeCity}), work city (${workCity}) is safe`;
    else if (!activeInHome.length && activeInWork.length) reason = `Disruption only in work city (${workCity}), home city (${homeCity}) is safe`;
    else reason = 'Different disruption types in each city — same trigger required in both';
  }

  return {
    eligible,
    matchedTrigger: matchedTrigger || null,
    reason: eligible ? `Both ${homeCity} and ${workCity} affected by ${matchedTrigger}` : reason,
    homeCity, workCity,
    homeData: { ...homeData, triggers: homeTriggers },
    workData: { ...workData, triggers: workTriggers },
    thresholds: THRESHOLDS
  };
}

module.exports = {
  fetchWeatherData, fetchWeatherByCoords, fetchAQIData, checkCityDisruption,
  checkDualCityEligibility, monitorAndTriggerClaims, getDisruptionLevel,
  isInsideZone, verifyUserLocationForZone, getUserCities, CITY_COORDS
};
