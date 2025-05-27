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
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  address: { type: String, required: true }, // Human readable address like "Delhi, India"
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['available', 'adopted', 'pending'], default: 'available' },
  createdAt: { type: Date, default: Date.now },
});

animalSchema.index({ location: '2dsphere' });
animalSchema.index({ species: 1 });
animalSchema.index({ status: 1 });
animalSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Animal', animalSchema);
