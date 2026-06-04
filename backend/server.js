require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const cron     = require('node-cron');
const { monitorAndTriggerClaims } = require('./services/weatherService');

const app = express();
app.use(cors());
app.use(express.json());

// ── MongoDB ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('FATAL: MONGO_URI not set'); process.exit(1); }

mongoose.set('strictQuery', false);

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS:         30000,
      socketTimeoutMS:          60000,
      maxPoolSize:              10
    });
    console.log(`MongoDB connected → ${mongoose.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    console.log('Retrying in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
}

mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => console.log('MongoDB reconnected'));
mongoose.connection.on('error',        err => console.error('MongoDB error:', err.message));

// ── Routes (no DB-ready block — mongoose buffers safely) ──────────────────────
app.use('/api/users',     require('./routes/users'));
app.use('/api/policies',  require('./routes/policies'));
app.use('/api/claims',    require('./routes/claims'));
app.use('/api/risk',      require('./routes/risk'));
app.use('/api/alerts',    require('./routes/alerts'));
app.use('/api/chatbot',   require('./routes/chatbot'));
app.use('/api/payments',  require('./routes/payments'));
app.use('/api/payout',    require('./routes/payout'));
app.use('/api/history',   require('./routes/history'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/analytics', require('./routes/analytics'));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state  = mongoose.connection.readyState;
  res.json({ status: state === 1 ? 'ok' : 'connecting', db: states[state], timestamp: new Date() });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  connectDB();
});

// ── Cron ──────────────────────────────────────────────────────────────────────
cron.schedule('*/30 * * * *', async () => {
  if (mongoose.connection.readyState !== 1) return;
  try { await monitorAndTriggerClaims(); }
  catch (err) { console.error('Cron error:', err.message); }
});
