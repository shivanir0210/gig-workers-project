require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const { monitorAndTriggerClaims } = require('./services/weatherService');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

app.use('/api/users', require('./routes/users'));
app.use('/api/policies', require('./routes/policies'));
app.use('/api/claims', require('./routes/claims'));
app.use('/api/risk', require('./routes/risk'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/payout', require('./routes/payout'));

// Run monitoring every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('Running disruption monitor...');
  await monitorAndTriggerClaims();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
