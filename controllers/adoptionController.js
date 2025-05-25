const { check, validationResult } = require('express-validator');
const AdoptionRepository = require('../repositories/adoptionRepository');
const AnimalRepository = require('../repositories/animalRepository');

class AdoptionController {
  async createAdoption(req, res, next) {
    try {
      await check('animalId', 'Animal ID is required').notEmpty().run(req);
      await check('reason', 'Reason is required').notEmpty().run(req);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const animal = await AnimalRepository.findAnimalById(req.body.animalId);
      if (!animal || animal.status !== 'available') {
        return res.status(400).json({ message: 'Animal not available for adoption' });
      }

      const adoptionData = {
        userId: req.user._id,
        animalId: req.body.animalId,
        reason: req.body.reason,
      };
      const adoption = await AdoptionRepository.createAdoption(adoptionData);
      res.status(201).json(adoption);
    } catch (error) {
      next(error);
    }
  }

  async getUserAdoptions(req, res, next) {
    try {
      const adoptions = await AdoptionRepository.findAdoptionsByUser(req.user._id);
      res.json(adoptions);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdoptionController();