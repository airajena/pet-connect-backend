const express = require('express');
const { protect } = require('../middlewares/auth');
const Adoption = require('../models/Adoption');
const router = express.Router();

// Create a new adoption request
router.post('/', protect, async (req, res, next) => {
  try {
    console.log('POST /api/adoptions received:', req.body); // Debug
    const { animalId, reason } = req.body;

    // Validate required fields
    if (!animalId || !reason) {
      return res.status(400).json({ message: 'Animal ID and reason are required' });
    }

    // Create adoption request
    const adoption = new Adoption({
      animalId,
      userId: req.user._id,
      reason,
      status: 'pending',
    });

    await adoption.save();
    console.log('Adoption saved:', adoption); // Debug
    res.status(201).json(adoption);
  } catch (error) {
    console.error('Error creating adoption:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's adoption history
router.get('/my-adoptions', protect, async (req, res, next) => {
  try {
    const adoptions = await Adoption.find({ userId: req.user._id }).populate('animalId', 'name species');
    res.json(adoptions);
  } catch (error) {
    console.error('Error fetching adoptions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;