const { check, validationResult } = require('express-validator');
const AnimalRepository = require('../repositories/animalRepository');

class AnimalController {
  async createAnimal(req, res, next) {
    try {
      await check('name', 'Name is required').notEmpty().run(req);
      await check('species', 'Species is required').isIn(['dog', 'cat', 'other']).run(req);
      await check('location', 'Location is required').notEmpty().run(req);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const animalData = {
        ...req.body,
        postedBy: req.user._id,
        location: {
          type: 'Point',
          coordinates: [req.body.location.lng, req.body.location.lat],
        },
      };
      const animal = await AnimalRepository.createAnimal(animalData);
      res.status(201).json(animal);
    } catch (error) {
      next(error);
    }
  }

  async getAnimals(req, res, next) {
    try {
      const { species, age, gender, lat, lng, maxDistance, page = 1, limit = 10 } = req.query;
      const query = { status: 'available' };
      if (species) query.species = species;
      if (age) query.age = { $lte: parseInt(age) };
      if (gender) query.gender = gender;

      const options = {
        skip: (parseInt(page) - 1) * parseInt(limit),
        limit: parseInt(limit),
      };

      let animals;
      if (lat && lng && maxDistance) {
        animals = await AnimalRepository.findNearbyAnimals(
          [parseFloat(lng), parseFloat(lat)],
          parseFloat(maxDistance)
        );
      } else {
        animals = await AnimalRepository.findAnimals(query, options);
      }

      res.json(animals);
    } catch (error) {
      next(error);
    }
  }

  async getAnimalById(req, res, next) {
    try {
      const animal = await AnimalRepository.findAnimalById(req.params.id);
      if (!animal) {
        return res.status(404).json({ message: 'Animal not found' });
      }
      res.json(animal);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnimalController();