const mongoose = require('mongoose');

const adoptionSchema = new mongoose.Schema({
  animalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNotes: { type: String }, // Admin can add notes when approving/rejecting
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin who reviewed
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Adoption', adoptionSchema);
