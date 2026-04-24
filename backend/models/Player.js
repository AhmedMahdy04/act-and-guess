const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  socketId: { type: String, required: true },
  username: { type: String, required: true },
  gameId: { type: String, required: true },
  teamId: { type: String },
  isHost: { type: Boolean, default: false },
  isActor: { type: Boolean, default: false }
}, { timestamps: true });

playerSchema.index({ gameId: 1, playerId: 1 }, { unique: true });

module.exports = mongoose.model('Player', playerSchema);
