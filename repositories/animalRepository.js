const Animal = require('../models/Animal');

class AnimalRepository {
  async createAnimal(animalData) {
    return await Animal.create(animalData);
  }

  async findAnimals(query, options) {
    return await Animal.find(query)
      .populate('postedBy', 'name email')
      .skip(options.skip)
      .limit(options.limit);
  }

  async findAnimalById(id) {
    return await Animal.findById(id).populate('postedBy', 'name email');
  }

  async updateAnimal(id, updateData) {
    return await Animal.findByIdAndUpdate(id, updateData, { new: true });
  }

  async findNearbyAnimals(coordinates, maxDistance) {
    return await Animal.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: maxDistance,
        },
      },
      status: 'available',
    }).populate('postedBy', 'name email');
  }
}

module.exports = new AnimalRepository();