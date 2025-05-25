const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    console.error('No token provided in headers:', req.headers);
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded:', decoded); // Debug
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) {
      console.error('User not found for ID:', decoded.id);
      return res.status(401).json({ message: 'User not found' });
    }
    console.log('User authenticated:', req.user.email); // Debug
    next();
  } catch (error) {
    console.error('Auth error:', error.message, 'Token:', token);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};