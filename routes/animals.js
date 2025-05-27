const express = require('express');
const { protect, admin } = require('../middlewares/auth');
const Animal = require('../models/Animal');
const LocationService = require('../services/locationService');
const cloudinary = require('cloudinary').v2;
const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Get all available animals with advanced filtering
router.get('/', async (req, res, next) => {
  try {
    const { 
      species, 
      age, 
      gender, 
      breed,
      healthStatus,
      lat, 
      lng, 
      maxDistance = 10000, // 10km default
      limit = 20,
      page = 1,
      sort = '-createdAt',
      search
    } = req.query;

    let query = { status: 'available' };
    let sortOption = {};

    // Text search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { breed: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filters
    if (species) query.species = { $regex: species, $options: 'i' };
    if (age) query.age = { $lte: parseInt(age) };
    if (gender) query.gender = gender;
    if (breed) query.breed = { $regex: breed, $options: 'i' };
    if (healthStatus) query.healthStatus = { $regex: healthStatus, $options: 'i' };

    // Sorting
    switch (sort) {
      case 'name':
        sortOption = { name: 1 };
        break;
      case '-name':
        sortOption = { name: -1 };
        break;
      case 'age':
        sortOption = { age: 1 };
        break;
      case '-age':
        sortOption = { age: -1 };
        break;
      case 'createdAt':
        sortOption = { createdAt: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    let animals;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Location-based search
    if (lat && lng) {
      animals = await Animal.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            distanceField: 'distance',
            maxDistance: parseInt(maxDistance),
            query: query,
            spherical: true
          }
        },
        { $sort: sortOption },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $lookup: {
            from: 'users',
            localField: 'postedBy',
            foreignField: '_id',
            as: 'postedBy',
            pipeline: [{ $project: { name: 1, email: 1 } }]
          }
        },
        {
          $unwind: '$postedBy'
        }
      ]);
    } else {
      animals = await Animal.find(query)
        .populate('postedBy', 'name email')
        .sort(sortOption)
        .limit(parseInt(limit))
        .skip(skip);
    }

    // Get total count for pagination
    const total = await Animal.countDocuments(query);

    res.json({
      animals,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching animals:', error);
    next(error);
  }
});

// Get nearby animals based on user location
router.get('/nearby', async (req, res, next) => {
  try {
    const { lat, lng, maxDistance = 5000 } = req.query; // 5km default

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const animals = await Animal.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          distanceField: 'distance',
          maxDistance: parseInt(maxDistance),
          query: { status: 'available' },
          spherical: true
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'postedBy',
          foreignField: '_id',
          as: 'postedBy',
          pipeline: [{ $project: { name: 1, email: 1 } }]
        }
      },
      {
        $unwind: '$postedBy'
      },
      {
        $addFields: {
          distanceInKm: { $round: [{ $divide: ['$distance', 1000] }, 2] }
        }
      }
    ]);

    res.json(animals);
  } catch (error) {
    console.error('Error fetching nearby animals:', error);
    next(error);
  }
});

// Get animal by ID
router.get('/:id', async (req, res, next) => {
  try {
    const animal = await Animal.findOne({ 
      _id: req.params.id, 
      status: { $in: ['available', 'pending'] }
    }).populate('postedBy', 'name email');
    
    if (!animal) {
      return res.status(404).json({ message: 'Animal not found or not available' });
    }
    
    res.json(animal);
  } catch (error) {
    console.error('Error fetching animal by ID:', error);
    next(error);
  }
});

// Create a new animal
router.post('/', protect, async (req, res, next) => {
  try {
    const { name, species, breed, age, gender, healthStatus, description, location } = req.body;

    if (!name || !species || !location) {
      return res.status(400).json({ message: 'Name, species, and location are required' });
    }

    let parsedLocation;
    try {
      parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
      if (!parsedLocation.lat || !parsedLocation.lng) {
        throw new Error('Invalid location format');
      }
    } catch (error) {
      return res.status(400).json({ message: 'Invalid location format' });
    }

    // Get human readable address
    const address = await LocationService.reverseGeocode(
      parsedLocation.lat, 
      parsedLocation.lng
    );

    let images = [];
    if (req.files && req.files.images) {
      const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
      images = await Promise.all(
        files.map(async (file) => {
          const result = await cloudinary.uploader.upload(file.tempFilePath, {
            folder: 'pet-connect',
            resource_type: 'image',
          });
          return result.secure_url;
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
      address,
      postedBy: req.user._id,
      status: 'available',
    });

    await animal.save();
    await animal.populate('postedBy', 'name email');
    
    res.status(201).json(animal);
  } catch (error) {
    console.error('Error creating animal:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Get all animals (including adopted)
router.get('/admin/all', protect, admin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, species } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (species) query.species = species;

    const animals = await Animal.find(query)
      .populate('postedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Animal.countDocuments(query);

    res.json({
      animals,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching all animals:', error);
    next(error);
  }
});

// Admin: Update animal status
router.put('/:id/status', protect, admin, async (req, res, next) => {
  try {
    const { status } = req.body;
    
    if (!['available', 'adopted', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const animal = await Animal.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('postedBy', 'name email');

    if (!animal) {
      return res.status(404).json({ message: 'Animal not found' });
    }

    res.json(animal);
  } catch (error) {
    console.error('Error updating animal status:', error);
    next(error);
  }
});

module.exports = router;
