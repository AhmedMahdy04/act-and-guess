const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
  word: { type: String, required: true, trim: true },
  normalizedWord: { type: String, required: true, lowercase: true, trim: true },
  category: { type: String, required: true, trim: true, lowercase: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  active: { type: Boolean, default: true },
  createdBy: { type: String, default: 'system' },
  updatedBy: { type: String, default: null },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: String, default: null }
}, { timestamps: true });

wordSchema.index({ normalizedWord: 1, category: 1, difficulty: 1 }, { unique: true });
wordSchema.index({ category: 1, difficulty: 1, active: 1 });

module.exports = mongoose.model('Word', wordSchema);
