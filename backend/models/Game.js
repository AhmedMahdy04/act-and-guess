const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  username: { type: String, required: true },
  teamId: { type: String, required: true },
  sessionHash: String,
  socketId: String,
  lastSeen: Number,
  isHost: Boolean,
  isActor: Boolean,
  connected: Boolean,
  disconnectedAt: Number
}, { _id: false });

const teamSchema = new mongoose.Schema({
  teamId: { type: String, required: true },
  name: { type: String, required: true },
  score: Number,
  players: [String]
}, { _id: false });

const gameSchema = new mongoose.Schema({
  testOwner: String,
  testExpiresAt: Date,
  gameCode: { type: String, required: true, unique: true },
  revision: Number,
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
  matchId: String,
  matchStartedAt: Number,
  roundId: String,
  roundStartedAt: Number,
  roundEndsAt: Number,
  nextRoundAt: Number,
  currentTeam: String,
  currentActorId: String,
  currentWord: String,
  timeLeft: Number,
  winner: String,
  wordCursor: { type: Number, default: 0 },
  teamActorCursor: { type: Object, default: {} },
  scores: { type: Map, of: Number, default: {} },
  teams: [String],
  players: [String],
  runtimePlayers: { type: [playerSchema], default: undefined },
  runtimeTeams: { type: [teamSchema], default: undefined },
  closedAt: { type: Date, default: null },
  words: [String],
  bannedPlayers: [{
    _id: false,
    playerId: String,
    username: String,
    reason: String,
    bannedAt: Date
  }],
  recentGuesses: [{
    _id: false,
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
    actorName: String,
    score: Number,
    guessingPlayerName: String
  },
  roundHistory: [{
    _id: false,
    matchId: String,
    roundId: String,
    roundNumber: Number,
    teamId: String,
    actorId: String,
    actorName: String,
    reason: String,
    word: String,
    score: Number,
    guessingPlayerName: String,
    startedAt: Number,
    endedAt: Number
  }],
  matchHistory: [{
    _id: false,
    matchId: String,
    startedAt: Number,
    endedAt: Number,
    rounds: Number,
    reason: String,
    winner: String,
    scores: { type: Map, of: Number }
  }]
}, { timestamps: true, bufferCommands: false });

gameSchema.index({ visibility: 1, status: 1, closedAt: 1, updatedAt: -1 });
gameSchema.index({ updatedAt: -1 });
gameSchema.index({ testExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Game', gameSchema);
