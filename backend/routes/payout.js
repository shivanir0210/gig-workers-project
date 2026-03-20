const express = require('express');
const PayoutSetup = require('../models/PayoutSetup');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/save', auth, async (req, res) => {
  try {
    const { fullName, upiId, paymentMode } = req.body;
    console.log("Saving payout for:", req.body);

    if (!fullName || !upiId || !paymentMode) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const validModes = ['UPI', 'CARD', 'WALLET'];
    if (!validModes.includes(paymentMode.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid payment mode' });
    }

    // Update user UPI id generally as well to support legacy flows
    await User.findByIdAndUpdate(req.user.id, { upiId });

    // In a real application we would check if this specific pending setup already exists 
    // but building an append-only log allows historical tracking.
    const setup = new PayoutSetup({
      userId: req.user.id,
      fullName,
      upiId,
      paymentMode: paymentMode.toUpperCase(),
      status: 'PENDING'
    });

    await setup.save();

    res.status(200).json({
      message: 'Payout details saved successfully',
      setup
    });

  } catch (error) {
    console.error('Save Payout Error:', error);
    res.status(500).json({ error: 'Failed to save payout details' });
  }
});

module.exports = router;
