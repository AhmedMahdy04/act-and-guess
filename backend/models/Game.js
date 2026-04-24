const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  gameCode: { type: String, required: true, unique: true, index: true },
  hostId: String,
  hostName: String,
  status: { type: String, enum: ['lobby', 'playing', 'round_end', 'finished'], default: 'lobby' },
  visibility: { type: String, enum: ['public', 'private'], default: 'private' },
  category: { type: String, default: 'random' },
  difficulty: { type: String, default: 'mixed' },
  teamCount: { type: Number, default: 2 },
  playersPerTeam: { type: Number, default: 3 },
  targetScore: { type: Number, default: 10 },
  roundTime: { type: Number, default: 60 },
  currentRound: { type: Number, default: 0 },
  currentTeam: String,
  currentActorId: String,
  currentWord: String,
  timeLeft: Number,
  winner: String,
  wordCursor: { type: Number, default: 0 },
  scores: { type: Map, of: Number, default: {} },
  teams: [{ type: String }], // UUID strings
  players: [{ type: String }], // UUID strings
  words: [String],
  bannedPlayers: [{
    playerId: String,
    username: String,
    reason: String,
    bannedAt: Date
  }],
  recentGuesses: [{
    id: String,
    guess: String,
    playerId: String,
    username: String,
    teamId: String,
    score: Number
  }],
  lastRound: {
    reason: String,
    word: String,
    actorId: String,
    actorName: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Game', gameSchema);
