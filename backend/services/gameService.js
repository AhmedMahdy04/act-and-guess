const Game = require('../models/Game');
const Player = require('../models/Player');
const Team = require('../models/Team');
const wordService = require('./wordService');

function isDbReady() {
  return Game.db.readyState === 1;
}

async function getGameByCode(gameCode) {
  const game = await Game.findOne({ gameCode, closedAt: null }).lean();
  if (!game) return null;

  // Existing rooms recorded players and teams in separate collections. The
  // first successful write migrates them into the atomic game snapshot.
  if (!Array.isArray(game.runtimePlayers) || !Array.isArray(game.runtimeTeams)) {
    [game.runtimePlayers, game.runtimeTeams] = await Promise.all([
      Player.find({ gameId: gameCode }).lean(),
      Team.find({ gameId: gameCode }).lean()
    ]);
  }

  return game;
}

async function saveGame(game, { create = false, previous } = {}) {
  const { id, players, teams, recoveryUntil, revision, ...state } = game;
  const runtimePlayers = Object.values(players).map(({ id: playerId, ...player }) => ({ playerId, ...player }));
  const runtimeTeams = Object.values(teams).map(({ id: teamId, ...team }) => ({ teamId, ...team }));
  const data = {
    ...state,
    runtimePlayers,
    runtimeTeams,
    players: runtimePlayers.map((player) => player.playerId),
    teams: runtimeTeams.map((team) => team.teamId),
    scores: Object.fromEntries(runtimeTeams.map((team) => [team.teamId, team.score]))
  };

  if (create) {
    if (process.env.VERCEL) data.revision = game.revision = 1;
    await Game.create({ gameCode: id, ...data });
    return;
  }

  if (previous?.roundHistory.at(-1)?.roundId === game.roundHistory.at(-1)?.roundId) delete data.roundHistory;
  if (previous?.matchHistory.at(-1)?.matchId === game.matchHistory.at(-1)?.matchId) delete data.matchHistory;

  const filter = { gameCode: id, closedAt: null };
  if (process.env.VERCEL) {
    filter.revision = revision ?? { $exists: false };
    data.revision = (revision ?? 0) + 1;
  }
  const result = await Game.updateOne(filter, { $set: data }, { runValidators: true });
  if (result.matchedCount !== 1) {
    throw Object.assign(new Error('The game changed. Try again.'), { code: 'GAME_CONFLICT' });
  }
  game.revision = data.revision;
}

async function listPublicGames() {
  return Game.find({
    visibility: 'public',
    status: 'lobby',
    closedAt: null,
    updatedAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
  })
    .sort({ updatedAt: -1 })
    .limit(50)
    .select('gameCode hostName category difficulty teamCount playersPerTeam roundTime targetScore players')
    .lean();
}

function normalizeAnswer(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{Mark}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

function calculateScore(guess, answer) {
  const cleanGuess = normalizeAnswer(guess);
  const cleanAnswer = normalizeAnswer(answer);
  if (!cleanGuess || !cleanAnswer) return 0;
  if (cleanGuess === cleanAnswer) return 2;

  let previous = Array.from({ length: cleanAnswer.length + 1 }, (_, index) => index);
  for (let row = 1; row <= cleanGuess.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= cleanAnswer.length; column += 1) {
      const substitution = cleanGuess[row - 1] === cleanAnswer[column - 1] ? 0 : 1;
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + substitution);
    }
    previous = current;
  }

  const maximumLength = Math.max(cleanGuess.length, cleanAnswer.length);
  return 1 - previous[cleanAnswer.length] / maximumLength >= 0.7 ? 1 : 0;
}

module.exports = {
  ...wordService,
  calculateScore,
  getGameByCode,
  init: () => Game.init(),
  isDbReady,
  listPublicGames,
  saveGame
};
