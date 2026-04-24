const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
  word: { type: String, required: true, trim: true },
  normalizedWord: { type: String, required: true, lowercase: true, trim: true },
  category: { type: String, required: true, trim: true, lowercase: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  active: { type: Boolean, default: true },
  createdBy: { type: String, default: 'system' }
}, { timestamps: true });

wordSchema.index({ normalizedWord: 1, category: 1, difficulty: 1 }, { unique: true });

module.exports = mongoose.model('Word', wordSchema);
