const express = require('express');
const RiskData = require('../models/RiskData');
const RiskZone = require('../models/RiskZone');
const { fetchWeatherData, fetchAQIData, getDisruptionLevel, CITY_COORDS, isInsideZone } = require('../services/weatherService');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/current/:city', async (req, res) => {
  try {
    const city = req.params.city;
    const weather = await fetchWeatherData(city);
    const aqiData = await fetchAQIData(city);
    const disruptionLevel = getDisruptionLevel(weather, aqiData.aqi);
    const alerts = [];
    if (weather.rainfall > 50) alerts.push(`Heavy rainfall: ${weather.rainfall}mm`);
    if (aqiData.aqi > 200) alerts.push(`Poor AQI: ${aqiData.aqi}`);
    if (weather.temperature > 42) alerts.push(`Extreme heat: ${weather.temperature}°C`);

    res.json({ city, weather, aqi: aqiData.aqi, aqiCategory: aqiData.category, disruptionLevel, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/heatmap', async (req, res) => {
  try {
    const count = await RiskZone.countDocuments();
    if (count === 0) {
      for (const [city, coords] of Object.entries(CITY_COORDS)) {
        await RiskZone.create({ name: city, center: { lat: coords.lat, lng: coords.lng }, radius: 5000 });
      }
    }
    const zones = await RiskZone.find();
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/zone', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'Lat/lng required' });
    
    const zones = await RiskZone.find();
    const matchedZone = zones.find(z => isInsideZone(Number(lat), Number(lng), z));
    if (matchedZone) return res.json(matchedZone);
    res.status(404).json({ error: 'No zone found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history/:city', async (req, res) => {
  try {
    const data = await RiskData.find({ city: req.params.city })
      .sort({ recordedAt: -1 })
      .limit(30);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/mock-delivery-activity/:userId', auth, async (req, res) => {
  const activities = [
    { date: new Date(), deliveries: 12, earnings: 850, hoursWorked: 8, status: 'active' },
    { date: new Date(Date.now() - 86400000), deliveries: 8, earnings: 620, hoursWorked: 6, status: 'active' },
    { date: new Date(Date.now() - 172800000), deliveries: 0, earnings: 0, hoursWorked: 0, status: 'disrupted' }
  ];
  res.json(activities);
});

module.exports = router;
