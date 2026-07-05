require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  const exists = await User.findOne({ email: 'admin@gigshield.com' });
  if (exists) {
    console.log('Admin already exists');
    process.exit(0);
  }
  const password = await bcrypt.hash('Admin@123', 10);
  await User.create({
    name: 'Admin',
    email: 'admin@gigshield.com',
    password,
    phone: '0000000000',
    role: 'admin',
    platform: 'Other',
    weeklyIncome: 0,
    location: { city: 'Mumbai', lat: 19.076, lng: 72.877 },
    verificationStatus: 'approved'
  });
  console.log('✅ Admin created: admin@gigshield.com / Admin@123');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
