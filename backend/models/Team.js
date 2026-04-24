const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  teamId: { type: String, required: true },
  name: { type: String, required: true },
  score: { type: Number, default: 0 },
  players: [{ type: String }]
}, { timestamps: true });

teamSchema.index({ gameId: 1, teamId: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);
