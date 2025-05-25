const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  species: { type: String, required: true },
  breed: { type: String },
  age: { type: Number },
  gender: { type: String, enum: ['male', 'female', 'unknown'], default: 'unknown' },
  healthStatus: { type: String },
  description: { type: String },
  images: [{ type: String }],
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['available', 'adopted'], default: 'available' },
  createdAt: { type: Date, default: Date.now },
});

animalSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Animal', animalSchema);