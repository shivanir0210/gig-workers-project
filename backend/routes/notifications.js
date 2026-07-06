const express      = require('express');
const Notification = require('../models/Notification');
const User         = require('../models/User');
const auth         = require('../middleware/auth');
const router       = express.Router();

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const { type, priority, unread } = req.query;
    const filter = { userId: req.user.id };
    if (type)     filter.type     = type;
    if (priority) filter.priority = priority;
    if (unread === 'true') filter.isRead = false;
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 }).limit(200);
    res.json(notifications);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/notifications/unread-count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    res.json({ count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notifications/read-all
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// legacy path kept for Layout.jsx compatibility
router.put('/read-all/status', auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true }, { new: true }
    );
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json(n);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/notifications/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/notifications  (clear all)
router.delete('/', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/notifications  (manual create — internal use)
router.post('/', auth, async (req, res) => {
  try {
    const { title, message, type, priority, city, alertType } = req.body;
    const n = await Notification.create({
      userId: req.user.id, title, message,
      type: type || 'weather', priority: priority || 'medium',
      city: city || '', alertType: alertType || type || 'weather'
    });
    res.status(201).json(n);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Push subscription
router.post('/subscribe-push', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { pushSubscription: req.body.subscription });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUZGWDwE27gduOhIG91BroJ5F78KQt7gJH6M7d1fOa-YlZ48zP_XzXg2u_GfUoFUXx_E8L9f8X9f8X9f8X' });
});

module.exports = router;
