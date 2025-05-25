const express = require('express');
const { protect } = require('../middlewares/auth');
const Animal = require('../models/Animal');
const cloudinary = require('cloudinary').v2;
const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Get all animals or search by filters
router.get('/', async (req, res, next) => {
  try {
    const { species, age, gender, lat, lng, maxDistance, limit } = req.query;
    let query = { status: 'available' };

    if (species) query.species = species;
    if (age) query.age = { $lte: parseInt(age) };
    if (gender) query.gender = gender;

    let animals;
    if (lat && lng) {
      animals = await Animal.find({
        ...query,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: parseInt(maxDistance) || 10000,
          },
        },
      })
        .populate('postedBy', 'name email')
        .limit(parseInt(limit) || 10);
    } else {
      animals = await Animal.find(query)
        .populate('postedBy', 'name email')
        .limit(parseInt(limit) || 10);
    }

    res.json(animals);
  } catch (error) {
    console.error('Error fetching animals:', error);
    next(error);
  }
});

// Get animal by ID
router.get('/:id', async (req, res, next) => {
  try {
    const animal = await Animal.findById(req.params.id).populate('postedBy', 'name email');
    if (!animal) return res.status(404).json({ message: 'Animal not found' });
    res.json(animal);
  } catch (error) {
    console.error('Error fetching animal by ID:', error);
    next(error);
  }
});

// Create a new animal
router.post('/', protect, async (req, res, next) => {
  try {
    console.log('POST /api/animals received:', req.body, req.files); // Debug
    const { name, species, breed, age, gender, healthStatus, description, location } = req.body;

    // Validate required fields
    if (!name || !species || !location) {
      return res.status(400).json({ message: 'Name, species, and location are required' });
    }

    // Validate authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Parse location
    let parsedLocation;
    try {
      parsedLocation = JSON.parse(location);
      if (!parsedLocation.lat || !parsedLocation.lng) {
        throw new Error('Invalid location format');
      }
    } catch (error) {
      console.error('Location parsing error:', error);
      return res.status(400).json({ message: 'Invalid location format' });
    }

    // Handle image uploads
    let images = [];
    if (req.files && req.files.images) {
      console.log('Processing images:', req.files.images); // Debug
      const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      images = await Promise.all(
        files.map(async (file) => {
          if (!file.tempFilePath) {
            console.error('No tempFilePath for file:', file);
            throw new Error('Invalid file upload');
          }
          try {
            const result = await cloudinary.uploader.upload(file.tempFilePath, {
              folder: 'pet-connect',
              resource_type: 'image',
            });
            return result.secure_url;
          } catch (uploadError) {
            console.error('Cloudinary upload error:', uploadError);
            throw new Error(`Failed to upload image: ${uploadError.message}`);
          }
        })
      );
    }

    const animal = new Animal({
      name,
      species,
      breed,
      age: age ? parseInt(age) : undefined,
      gender: gender || 'unknown',
      healthStatus,
      description,
      images,
      location: {
        type: 'Point',
        coordinates: [parseFloat(parsedLocation.lng), parseFloat(parsedLocation.lat)],
      },
      postedBy: req.user._id,
    });

    await animal.save();
    console.log('Animal saved:', animal); // Debug
    res.status(201).json(animal);
  } catch (error) {
    console.error('Error creating animal:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;