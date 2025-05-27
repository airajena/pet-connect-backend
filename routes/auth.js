const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const LocationService = require('../services/locationService');
const { protect } = require('../middlewares/auth');
const router = express.Router();

// Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, location, address } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const userData = { name, email, password };

    // Handle location if provided
    if (location && location.lat && location.lng) {
      // Validate coordinates
      const lat = parseFloat(location.lat);
      const lng = parseFloat(location.lng);
      
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ message: 'Invalid coordinates provided' });
      }

      userData.location = {
        type: 'Point',
        coordinates: [lng, lat] // [longitude, latitude]
      };
      
      // Get address from coordinates if not provided
      if (!address) {
        try {
          userData.address = await LocationService.reverseGeocode(lat, lng);
        } catch (error) {
          console.error('Reverse geocoding failed:', error);
          userData.address = 'Unknown location';
        }
      } else {
        userData.address = address;
      }
    } else if (address) {
      // Get coordinates from address
      try {
        const geoData = await LocationService.geocode(address);
        if (geoData) {
          userData.location = {
            type: 'Point',
            coordinates: [geoData.lng, geoData.lat]
          };
          userData.address = geoData.address;
        } else {
          userData.address = address; // Keep the provided address even if geocoding fails
        }
      } catch (error) {
        console.error('Geocoding failed:', error);
        userData.address = address;
      }
    }
    // If no location data provided, don't set location field at all

    const user = new User(userData);
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        address: user.address || null
      } 
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login a user
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        address: user.address || null
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user profile
router.get('/me', protect, async (req, res) => {
  res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    address: req.user.address || null,
    location: req.user.location || null
  });
});

// Update user location
router.put('/location', protect, async (req, res, next) => {
  try {
    const { lat, lng, address } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: 'Invalid coordinates provided' });
    }

    const updateData = {
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      }
    };

    // Get address if not provided
    if (address) {
      updateData.address = address;
    } else {
      try {
        updateData.address = await LocationService.reverseGeocode(latitude, longitude);
      } catch (error) {
        console.error('Reverse geocoding failed:', error);
        updateData.address = 'Unknown location';
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
