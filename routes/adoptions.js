const express = require('express');
const { protect, admin } = require('../middlewares/auth');
const Adoption = require('../models/Adoption');
const Animal = require('../models/Animal');
const router = express.Router();

// Create a new adoption request
router.post('/', protect, async (req, res, next) => {
  try {
    const { animalId, reason } = req.body;

    if (!animalId || !reason) {
      return res.status(400).json({ message: 'Animal ID and reason are required' });
    }

    // Check if animal exists and is available
    const animal = await Animal.findById(animalId);
    if (!animal || animal.status !== 'available') {
      return res.status(400).json({ message: 'Animal not available for adoption' });
    }

    // Check if user already has a pending adoption for this animal
    const existingAdoption = await Adoption.findOne({
      animalId,
      userId: req.user._id,
      status: 'pending'
    });

    if (existingAdoption) {
      return res.status(400).json({ message: 'You already have a pending adoption request for this animal' });
    }

    const adoption = new Adoption({
      animalId,
      userId: req.user._id,
      reason,
      status: 'pending',
    });

    await adoption.save();
    await adoption.populate(['animalId', 'userId']);
    
    res.status(201).json(adoption);
  } catch (error) {
    console.error('Error creating adoption:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's adoption history
router.get('/my-adoptions', protect, async (req, res, next) => {
  try {
    const adoptions = await Adoption.find({ userId: req.user._id })
      .populate({
        path: 'animalId',
        select: 'name species breed age gender images address'
      })
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    
    res.json(adoptions);
  } catch (error) {
    console.error('Error fetching user adoptions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get pending adoptions only
router.get('/pending', protect, admin, async (req, res, next) => {
  try {
    const adoptions = await Adoption.find({ status: 'pending' })
      .populate({
        path: 'animalId',
        select: 'name species breed age gender images address',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'userId', 
        select: 'name email',
        options: { strictPopulate: false }
      })
      .sort({ createdAt: -1 });
    
    // Filter out adoptions where animal or user is null
    const validAdoptions = adoptions.filter(adoption => 
      adoption.animalId && adoption.userId
    );
    
    res.json(validAdoptions);
  } catch (error) {
    console.error('Error fetching pending adoptions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Get all adoption requests
router.get('/admin/all', protect, admin, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (status) query.status = status;

    const adoptions = await Adoption.find(query)
      .populate({
        path: 'animalId',
        select: 'name species breed age gender images address',
        options: { strictPopulate: false }
      })
      .populate({
        path: 'userId', 
        select: 'name email',
        options: { strictPopulate: false }
      })
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Filter out adoptions where animal or user is null
    const validAdoptions = adoptions.filter(adoption => 
      adoption.animalId && adoption.userId
    );

    const total = await Adoption.countDocuments(query);

    res.json({
      adoptions: validAdoptions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching all adoptions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Approve an adoption
router.put('/approve/:id', protect, admin, async (req, res, next) => {
  try {
    const { adminNotes } = req.body;
    
    const adoption = await Adoption.findById(req.params.id);
    if (!adoption) {
      return res.status(404).json({ message: 'Adoption request not found' });
    }

    if (adoption.status !== 'pending') {
      return res.status(400).json({ message: 'Adoption request is not pending' });
    }

    // Update adoption status
    adoption.status = 'approved';
    adoption.adminNotes = adminNotes;
    adoption.reviewedBy = req.user._id;
    adoption.reviewedAt = new Date();
    await adoption.save();

    // Update animal status to adopted
    await Animal.findByIdAndUpdate(adoption.animalId, { status: 'adopted' });

    // Reject all other pending adoptions for this animal
    await Adoption.updateMany(
      { 
        animalId: adoption.animalId, 
        _id: { $ne: adoption._id },
        status: 'pending'
      },
      { 
        status: 'rejected',
        adminNotes: 'Animal has been adopted by another user',
        reviewedBy: req.user._id,
        reviewedAt: new Date()
      }
    );

    await adoption.populate(['animalId', 'userId', 'reviewedBy']);
    
    res.json(adoption);
  } catch (error) {
    console.error('Error approving adoption:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Reject an adoption
router.put('/reject/:id', protect, admin, async (req, res, next) => {
  try {
    const { adminNotes } = req.body;
    
    const adoption = await Adoption.findById(req.params.id);
    if (!adoption) {
      return res.status(404).json({ message: 'Adoption request not found' });
    }

    if (adoption.status !== 'pending') {
      return res.status(400).json({ message: 'Adoption request is not pending' });
    }

    adoption.status = 'rejected';
    adoption.adminNotes = adminNotes || 'Adoption request rejected';
    adoption.reviewedBy = req.user._id;
    adoption.reviewedAt = new Date();
    await adoption.save();

    await adoption.populate(['animalId', 'userId', 'reviewedBy']);
    
    res.json(adoption);
  } catch (error) {
    console.error('Error rejecting adoption:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Get adoption statistics
router.get('/admin/stats', protect, admin, async (req, res, next) => {
  try {
    const stats = await Adoption.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalAnimals = await Animal.countDocuments();
    const availableAnimals = await Animal.countDocuments({ status: 'available' });
    const adoptedAnimals = await Animal.countDocuments({ status: 'adopted' });

    const formattedStats = {
      adoptions: {
        pending: 0,
        approved: 0,
        rejected: 0
      },
      animals: {
        total: totalAnimals,
        available: availableAnimals,
        adopted: adoptedAnimals
      }
    };

    stats.forEach(stat => {
      formattedStats.adoptions[stat._id] = stat.count;
    });

    res.json(formattedStats);
  } catch (error) {
    console.error('Error fetching adoption stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get adoption by animal and user (for checking existing adoptions)
router.get('/check/:animalId', protect, async (req, res, next) => {
  try {
    const adoption = await Adoption.findOne({
      animalId: req.params.animalId,
      userId: req.user._id
    })
    .populate({
      path: 'animalId',
      select: 'name species breed age gender images address'
    })
    .populate('reviewedBy', 'name');
    
    if (adoption) {
      res.json(adoption);
    } else {
      res.status(404).json({ message: 'No adoption found' });
    }
  } catch (error) {
    console.error('Error checking adoption:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
