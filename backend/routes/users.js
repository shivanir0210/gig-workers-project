const express  = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const axios     = require('axios');
const fs        = require('fs');
const path      = require('path');
const User           = require('../models/User');
const PremiumHistory = require('../models/PremiumHistory');
const VerificationLog = require('../models/VerificationLog');
const auth      = require('../middleware/auth');
const { callOcrService, readUploadedFile, computeVerification, normalizeAadhaar } = require('../services/ocrService');
const router    = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────
async function calcPremiumAndRisk(city, weeklyIncome, platform) {
  try {
    const mlRes = await axios.post(`${process.env.ML_SERVICE_URL}/predict-risk`, { city, weeklyIncome, platform });
    return { riskLevel: mlRes.data.riskLevel, weeklyPremium: mlRes.data.weeklyPremium, riskScore: Math.round(mlRes.data.cityRiskScore * 100) };
  } catch {
    const riskLevel    = weeklyIncome > 5000 ? 'high' : weeklyIncome > 3000 ? 'medium' : 'low';
    const weeklyPremium = weeklyIncome * (riskLevel === 'high' ? 0.03 : riskLevel === 'medium' ? 0.02 : 0.015);
    const riskScore    = riskLevel === 'high' ? 75 : riskLevel === 'medium' ? 55 : 35;
    return { riskLevel, weeklyPremium: Math.round(weeklyPremium), riskScore };
  }
}

// ── Upload Base64 Document ───────────────────────────────────────────────────
router.post('/upload', async (req, res) => {
  try {
    const { name, base64 } = req.body;
    if (!name || !base64) return res.status(400).json({ error: 'Missing name or base64 data' });
    
    // Extract base64 clean data
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let base64Data = base64;
    if (matches && matches.length === 3) {
      base64Data = matches[2];
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const uploadDir = path.join(__dirname, '../uploads');
    const uploadPath = path.join(uploadDir, filename);
    
    // Ensure uploads folder exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    fs.writeFileSync(uploadPath, buffer);
    res.json({ url: `/uploads/${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Aadhaar OCR Verification ─────────────────────────────────────────────────
router.post('/verify-aadhaar', async (req, res) => {
  try {
    const { name, base64, aadhaarNumber } = req.body;
    if (!name || !base64) return res.status(400).json({ error: 'Missing name or base64 data' });

    const ocrResult = await callOcrService({ name, base64 });
    const ocrAadhaar = ocrResult?.aadhaarNumber || '';
    const ocrConfidence = Number(ocrResult?.confidence || 0);
    const verification = computeVerification(aadhaarNumber, ocrAadhaar, ocrConfidence);

    res.json({
      ocrAadhaar,
      ocrConfidence,
      verificationStatus: verification.verificationStatus,
      verificationMessage: verification.verificationMessage,
      rawText: ocrResult?.rawText || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, platform, customPlatform, workerId,
            aadhaarNumber, idProofUrl, profileScreenshotUrl,
            workerIdCardUrl, aadhaarCardUrl, platformScreenshotUrl, location,
            weeklyIncome, homeCity, workCity, customHomeCity, customWorkCity,
            averageDailyIncome, averageOrdersPerDay, onlineHoursPerDay } = req.body;

    // Prevent duplicate users by Aadhaar, worker ID, email, or phone before any password hashing or account creation.
    if (aadhaarNumber && await User.findOne({ aadhaarNumber }))
      return res.status(400).json({ error: 'A worker with this Aadhaar Number is already registered.' });
    if (await User.findOne({ workerId }))
      return res.status(400).json({ error: 'Worker ID already exists.' });
    if (await User.findOne({ email }))
      return res.status(400).json({ error: 'Email already registered.' });
    if (await User.findOne({ phone }))
      return res.status(400).json({ error: 'Mobile number already registered.' });

    const hashed = await bcrypt.hash(password, 10);
    const actualHomeCity = homeCity === 'Other' ? customHomeCity : homeCity;
    const actualWorkCity = workCity === 'Other' ? customWorkCity : workCity;
    const { riskLevel, weeklyPremium, riskScore } = await calcPremiumAndRisk(location.city, weeklyIncome, platform);

    // If the Aadhaar document was uploaded, attempt OCR verification immediately.
    let ocrResult = null;
    if (aadhaarCardUrl) {
      const filePayload = await readUploadedFile(aadhaarCardUrl);
      if (filePayload) {
        ocrResult = await callOcrService(filePayload);
      }
    }

    const ocrAadhaar     = ocrResult?.aadhaarNumber || '';
    const ocrConfidence  = Number(ocrResult?.confidence || 0);
    const verification   = computeVerification(aadhaarNumber, ocrAadhaar, ocrConfidence);

    const user = new User({
      name, email, password: hashed, phone,
      role: 'user',
      platform, customPlatform, workerId,
      aadhaarNumber,
      enteredAadhaar: aadhaarNumber,
      ocrAadhaar,
      ocrConfidence,
      verificationStatus: verification.verificationStatus,
      verificationMessage: verification.verificationMessage,
      idProofUrl: idProofUrl || aadhaarCardUrl,
      profileScreenshotUrl: profileScreenshotUrl || platformScreenshotUrl,
      workerIdCardUrl,
      aadhaarCardUrl: aadhaarCardUrl || idProofUrl,
      platformScreenshotUrl: platformScreenshotUrl || profileScreenshotUrl,
      location,
      homeCity: actualHomeCity || location.city,
      workCity: actualWorkCity || location.city,
      customHomeCity, customWorkCity,
      weeklyIncome,
      averageDailyIncome:  averageDailyIncome  || Math.round(weeklyIncome / 6),
      averageOrdersPerDay: averageOrdersPerDay || 0,
      onlineHoursPerDay:   onlineHoursPerDay   || 0,
      riskLevel, weeklyPremium, riskScore
    });
    await user.save();

    await VerificationLog.create({
      userId: user._id,
      enteredAadhaar: normalizeAadhaar(aadhaarNumber),
      ocrAadhaar: normalizeAadhaar(ocrAadhaar),
      ocrConfidence,
      verificationStatus: verification.verificationStatus,
      verificationMessage: verification.verificationMessage,
      action: 'auto-check',
      rawText: ocrResult?.rawText || ''
    });

    // PHASE 5: record first premium history entry
    const ph = await PremiumHistory.create({
      userId: user._id, premiumAmount: weeklyPremium, riskScore, riskLevel,
      weeklyIncome, homeCity: user.homeCity, workCity: user.workCity,
      averageDailyIncome: user.averageDailyIncome,
      averageOrdersPerDay: user.averageOrdersPerDay,
      onlineHoursPerDay: user.onlineHoursPerDay
    });
    await User.findByIdAndUpdate(user._id, { $push: { premiumHistory: ph._id } });

    const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.aadhaarNumber;
    delete safeUser.enteredAadhaar;
    delete safeUser.ocrAadhaar;
    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    // Handle MongoDB duplicate key errors with user-friendly validation messages.
    if (err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || err.keyValue || {})[0];
      const messageMap = {
        email: 'Email already registered.',
        phone: 'Mobile number already registered.',
        workerId: 'Worker ID already exists.',
        aadhaarNumber: 'A worker with this Aadhaar Number is already registered.'
      };
      const message = dupField ? messageMap[dupField] || 'Duplicate value already exists.' : 'Duplicate registration data detected.';
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    console.log('====================================================');
    console.log('[POST /api/users/login] Step 1: Incoming request body ->', { email: req.body?.email });

    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      console.warn('[POST /api/users/login] Missing email or password');
      return res.status(400).json({ success: false, message: 'Email and password are required.', error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    console.log('[POST /api/users/login] Step 2: Clean email lookup ->', cleanEmail);

    const user = await User.findOne({ email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') });

    if (!user) {
      console.warn('[POST /api/users/login] User not found in MongoDB for email:', cleanEmail);
      return res.status(401).json({ success: false, message: 'Invalid email or password.', error: 'Invalid email or password.' });
    }

    console.log('[POST /api/users/login] Step 3: User record found in MongoDB -> User ID:', user._id, '| Role:', user.role, '| FraudStatus:', user.fraudStatus, '| IsActive:', user.isActive);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn('[POST /api/users/login] Password hash mismatch for user ID:', user._id);
      return res.status(401).json({ success: false, message: 'Invalid email or password.', error: 'Invalid email or password.' });
    }

    if (user.isActive === false || user.fraudStatus === 'blocked') {
      console.warn('[POST /api/users/login] Account is deactivated or blocked for user ID:', user._id);
      return res.status(403).json({ success: false, message: 'Account is deactivated or blocked.', error: 'Account is deactivated or blocked.' });
    }

    const secret = process.env.JWT_SECRET || 'giginsurance_secret_key_2024';
    const token = jwt.sign({ id: user._id, role: user.role || 'user' }, secret, { expiresIn: '7d' });

    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.aadhaarNumber;
    delete safeUser.enteredAadhaar;
    delete safeUser.ocrAadhaar;

    console.log('[POST /api/users/login] Step 4: Login successful! JWT generated for user ID:', user._id);
    console.log('====================================================');

    res.json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error('[POST /api/users/login Error] Stack trace:\n', err.stack || err);
    res.status(500).json({ success: false, message: err.message, error: err.message });
  }
});

// ── Password Reset Endpoint (Dev / Recovery) ──────────────────────────────────
router.post('/reset-password-dev', async (req, res) => {
  try {
    const { email, newPassword = 'password123' } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i') });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found for email: ' + cleanEmail });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    console.log(`[Password Reset] Successfully updated password for ${user.email} to: ${newPassword}`);

    res.json({
      success: true,
      message: `Password for ${user.email} successfully updated to "${newPassword}". You can now log in!`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin Login ───────────────────────────────────────────────────────────────
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Input Presence Check (400 Bad Request)
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = new RegExp('^' + cleanEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '$', 'i');

    // 2. User Lookup by Email (404 Not Found if missing)
    const user = await User.findOne({ email: emailRegex });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 3. Password Verification (401 Unauthorized if incorrect)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    // 4. Role Verification (403 Forbidden if not admin)
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
    }

    // 5. Account Status Check
    if (user.isActive === false || user.fraudStatus === 'blocked') {
      return res.status(403).json({ success: false, message: 'Admin account is deactivated or blocked.' });
    }

    // 6. Generate JWT containing userId, email, and role
    const secret = process.env.JWT_SECRET || 'giginsurance_secret_key_2024';
    const token = jwt.sign(
      { id: user._id, userId: user._id, email: user.email, role: user.role },
      secret,
      { expiresIn: '7d' }
    );

    // 7. Return success response with token and user object
    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.aadhaarNumber;
    delete safeUser.enteredAadhaar;
    delete safeUser.ocrAadhaar;

    res.status(200).json({
      success: true,
      token,
      user: safeUser
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -aadhaarNumber -enteredAadhaar -ocrAadhaar');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.password;

    // Recalculate premium if income-related fields changed
    if (updates.weeklyIncome || updates.homeCity || updates.workCity) {
      const current = await User.findById(req.user.id);
      const city        = updates.location?.city || current.location.city;
      const income      = updates.weeklyIncome   || current.weeklyIncome;
      const platform    = updates.platform       || current.platform;
      const { riskLevel, weeklyPremium, riskScore } = await calcPremiumAndRisk(city, income, platform);
      updates.riskLevel     = riskLevel;
      updates.weeklyPremium = weeklyPremium;
      updates.riskScore     = riskScore;
      if (updates.averageDailyIncome === undefined)
        updates.averageDailyIncome = Math.round(income / 6);

      // PHASE 5: save new premium history record
      const ph = await PremiumHistory.create({
        userId: req.user.id, premiumAmount: weeklyPremium, riskScore, riskLevel,
        weeklyIncome: income, homeCity: updates.homeCity || current.homeCity,
        workCity: updates.workCity || current.workCity,
        averageDailyIncome:  updates.averageDailyIncome,
        averageOrdersPerDay: updates.averageOrdersPerDay || current.averageOrdersPerDay,
        onlineHoursPerDay:   updates.onlineHoursPerDay   || current.onlineHoursPerDay
      });
      await User.findByIdAndUpdate(req.user.id, { $push: { premiumHistory: ph._id } });
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/all', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password -aadhaarNumber -enteredAadhaar -ocrAadhaar');
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GPS update ─────────────────────────────────────────────────────────────────
router.post('/update-gps', auth, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const user = await User.findById(req.user.id);
    if (user.currentGps?.lat) {
      const R = 6371, prevLat = user.currentGps.lat, prevLng = user.currentGps.lng;
      const dLat = (lat - prevLat) * Math.PI / 180, dLng = (lng - prevLng) * Math.PI / 180;
      const a    = Math.sin(dLat/2)**2 + Math.cos(prevLat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLng/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      if (dist > 500) {
        await User.findByIdAndUpdate(req.user.id, { $inc: { trustScore: -5 } });
        return res.status(400).json({ error: 'Suspicious GPS jump', distanceKm: dist });
      }
    }
    await User.findByIdAndUpdate(req.user.id, {
      ipAddress: req.ip,
      currentGps: { lat, lng, updatedAt: new Date() },
      $push: { gpsHistory: { $each: [{ lat, lng, recordedAt: new Date() }], $slice: -20 } }
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/simulate-order', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, {
      currentOrder: { status: status || 'active', updatedAt: new Date() }
    }, { new: true }).select('-password');
    res.json({ success: true, currentOrder: user.currentOrder });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/payment-details', auth, async (req, res) => {
  try {
    const { upiId, bankAccount } = req.body;
    const update = {};
    if (upiId)       update.upiId       = upiId;
    if (bankAccount) update.bankAccount = bankAccount;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
