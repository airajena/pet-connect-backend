const Adoption = require('../models/Adoption');
const Animal = require('../models/Animal');

class AdoptionRepository {
  async createAdoption(adoptionData) {
    const session = await Adoption.startSession();
    session.startTransaction();
    try {
      const adoption = await Adoption.create([adoptionData], { session });
      await Animal.findByIdAndUpdate(adoptionData.animalId, { status: 'adopted' }, { session });
      await session.commitTransaction();
      return adoption[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async findAdoptionsByUser(userId) {
    return await Adoption.find({ userId }).populate('animalId');
  }
}

module.exports = new AdoptionRepository();