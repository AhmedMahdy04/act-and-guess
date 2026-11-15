const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: String,
  theme: { type: String, enum: ['midnight', 'christmas', 'winter'], default: 'midnight' },
  teamCount: { type: Number, min: 2, max: 6, default: 2 },
  playersPerTeam: { type: Number, min: 2, max: 8, default: 3 },
  targetScore: { type: Number, min: 1, max: 50, default: 10 },
  roundTime: { type: Number, min: 1, max: 60, default: 30 },
  difficulty: { type: String, enum: ['mixed', 'easy', 'medium', 'hard'], default: 'mixed' }
}, { timestamps: true });

module.exports = mongoose.model('SiteSettings', schema);
