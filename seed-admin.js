const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');

const seedAdmin = async () => {
  await connectDB();
  const email = 'admin@petconnect.com';
  const password = 'admin123';
  const name = 'Admin User';

  try {
    await User.deleteOne({ email });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = new User({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
    });

    await admin.save();
    console.log('Admin user created:', { email, password, role: 'admin' });
  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedAdmin();