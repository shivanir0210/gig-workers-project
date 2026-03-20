const express = require('express');
const router = express.Router();

const responses = {
  premium: 'Your weekly premium is calculated based on your city\'s weather risk, AQI levels, and your weekly income. Higher risk cities have slightly higher premiums.',
  claim: 'Claims are triggered automatically! When rainfall exceeds 50mm, AQI crosses 200, or temperature goes above 42°C, your claim is instantly processed — no manual request needed.',
  payout: 'Payouts are processed within minutes of claim approval. The amount is 25% of your weekly coverage amount per disruption event.',
  coverage: 'This policy covers income loss due to extreme weather (heavy rain, heat), poor air quality (AQI > 200), and curfews. It does NOT cover health, accidents, or vehicle damage.',
  policy: 'You can choose from 3 plans: Basic Shield (50% coverage), Standard Guard (75% coverage), and Premium Protect (100% coverage). All are weekly subscriptions.',
  fraud: 'Our system verifies your GPS location and delivery activity to ensure fair claims. Your trust score improves with consistent activity.',
  default: 'I can help you with questions about premiums, claims, payouts, coverage, and policies. What would you like to know?'
};

router.post('/chat', (req, res) => {
  const { message } = req.body;
  const msg = message.toLowerCase();
  let reply = responses.default;
  if (msg.includes('premium') || msg.includes('price') || msg.includes('cost')) reply = responses.premium;
  else if (msg.includes('claim') || msg.includes('trigger')) reply = responses.claim;
  else if (msg.includes('payout') || msg.includes('payment') || msg.includes('money')) reply = responses.payout;
  else if (msg.includes('cover') || msg.includes('protect')) reply = responses.coverage;
  else if (msg.includes('plan') || msg.includes('policy')) reply = responses.policy;
  else if (msg.includes('fraud') || msg.includes('trust') || msg.includes('score')) reply = responses.fraud;
  res.json({ reply, timestamp: new Date() });
});

module.exports = router;
