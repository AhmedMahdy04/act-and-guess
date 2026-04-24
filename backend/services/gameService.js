const crypto = require('crypto');

const Game = require('../models/Game');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Word = require('../models/Word');
const DEFAULT_WORDS = require('../defaultWords');

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const DIFFICULTY_FILTERS = ['easy', 'medium', 'hard', 'mixed'];

let memoryWords = DEFAULT_WORDS.map((entry) => normalizeWordInput(entry));

function isDbReady() {
  return Game.db?.readyState === 1;
}

function gameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function parseTeamNumber(teamId) {
  return Number.parseInt(String(teamId || '').replace('team', ''), 10) || 0;
}

function sanitizeWord(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 64);
}

function slugifyCategory(value, fallback = 'general') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);

  return cleaned || fallback;
}

function normalizeDifficulty(value, fallback = 'medium') {
  const cleaned = String(value || '').trim().toLowerCase();
  return DIFFICULTIES.includes(cleaned) ? cleaned : fallback;
}

function normalizeDifficultyFilter(value, fallback = 'mixed') {
  const cleaned = String(value || '').trim().toLowerCase();
  return DIFFICULTY_FILTERS.includes(cleaned) ? cleaned : fallback;
}

function normalizeCategoryFilter(value, fallback = 'random') {
  const cleaned = String(value || '').trim().toLowerCase();
  if (!cleaned || cleaned === 'random') {
    return fallback;
  }

  return slugifyCategory(cleaned);
}

function normalizeWordInput(entry = {}) {
  const word = sanitizeWord(entry.word);
  const category = slugifyCategory(entry.category, 'general');
  const difficulty = normalizeDifficulty(entry.difficulty, 'medium');

  return {
    word,
    normalizedWord: word.toLowerCase(),
    category,
    difficulty,
    active: entry.active !== false,
    createdBy: String(entry.createdBy || 'system').slice(0, 64)
  };
}

function formatCategoryLabel(category) {
  if (category === 'random') {
    return 'Random';
  }

  return String(category || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shuffle(items) {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function dedupeWords(words) {
  const seen = new Set();

  return words.filter((entry) => {
    const key = String(entry.word || '').toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function ensureCatalogSeeded() {
  if (!isDbReady()) {
    return memoryWords;
  }

  const operations = DEFAULT_WORDS
    .map((entry) => normalizeWordInput(entry))
    .filter((entry) => entry.word)
    .map((entry) => ({
      updateOne: {
        filter: {
          normalizedWord: entry.normalizedWord,
          category: entry.category,
          difficulty: entry.difficulty
        },
        update: {
          $setOnInsert: entry
        },
        upsert: true
      }
    }));

  if (operations.length) {
    await Word.bulkWrite(operations, { ordered: false });
  }

  return Word.find({ active: true }).lean();
}

async function getAllWords() {
  if (isDbReady()) {
    return Word.find({ active: true }).sort({ createdAt: -1 }).lean();
  }

  return [...memoryWords].reverse();
}

async function getCatalogSummary() {
  const words = await getAllWords();
  const categories = [...new Set(words.map((entry) => entry.category).filter(Boolean))].sort();
  const categoryCounts = Object.fromEntries(categories.map((category) => [
    category,
    words.filter((entry) => entry.category === category).length
  ]));

  const difficultyCounts = Object.fromEntries(DIFFICULTIES.map((difficulty) => [
    difficulty,
    words.filter((entry) => entry.difficulty === difficulty).length
  ]));

  return {
    totalWords: words.length,
    categories,
    categoryCounts,
    difficultyCounts,
    recentWords: words.slice(0, 12).map((entry) => ({
      word: entry.word,
      category: entry.category,
      difficulty: entry.difficulty
    }))
  };
}

async function buildWordDeck({ category = 'random', difficulty = 'mixed' } = {}) {
  const normalizedCategory = normalizeCategoryFilter(category);
  const normalizedDifficulty = normalizeDifficultyFilter(difficulty);

  const words = await getAllWords();
  const filtered = dedupeWords(words.filter((entry) => {
    const categoryMatches = normalizedCategory === 'random' || entry.category === normalizedCategory;
    const difficultyMatches = normalizedDifficulty === 'mixed' || entry.difficulty === normalizedDifficulty;
    return categoryMatches && difficultyMatches;
  }));

  if (!filtered.length) {
    throw new Error('No words match that category and difficulty yet. Add more words or change the filters.');
  }

  return shuffle(filtered.map((entry) => entry.word));
}

async function addWord(input, createdBy = 'host') {
  const normalized = normalizeWordInput({ ...input, createdBy });
  if (!normalized.word) {
    throw new Error('Word cannot be empty.');
  }

  if (isDbReady()) {
    const word = await Word.findOneAndUpdate(
      {
        normalizedWord: normalized.normalizedWord,
        category: normalized.category,
        difficulty: normalized.difficulty
      },
      {
        $setOnInsert: normalized
      },
      {
        new: true,
        upsert: true
      }
    ).lean();

    return {
      word: word.word,
      category: word.category,
      difficulty: word.difficulty
    };
  }

  const exists = memoryWords.find((entry) => (
    entry.normalizedWord === normalized.normalizedWord &&
    entry.category === normalized.category &&
    entry.difficulty === normalized.difficulty
  ));

  if (!exists) {
    memoryWords = [normalized, ...memoryWords];
  }

  return {
    word: normalized.word,
    category: normalized.category,
    difficulty: normalized.difficulty
  };
}

async function hydrateGame(gameDoc) {
  if (!gameDoc) {
    return null;
  }

  const [teamDocs, players] = await Promise.all([
    Team.find({ gameId: gameDoc.gameCode }).lean(),
    Player.find({ gameId: gameDoc.gameCode }).lean()
  ]);

  const teams = teamDocs.sort((left, right) => parseTeamNumber(left.teamId) - parseTeamNumber(right.teamId));

  return {
    ...gameDoc.toObject(),
    teams,
    players
  };
}

async function createGame(config, hostId, hostSocketId, hostUsername, hostTeamIndex) {
  const code = gameCode();
  const teamCount = config.teamCount || 2;
  const safeTeamIndex = Math.max(0, Math.min(teamCount - 1, Number.isInteger(hostTeamIndex) ? hostTeamIndex : 0));
  const safeTeamId = `team${safeTeamIndex + 1}`;
  const wordDeck = Array.isArray(config.wordDeck) ? config.wordDeck : [];

  const game = new Game({
    gameCode: code,
    hostId,
    hostName: hostUsername,
    status: 'lobby',
    visibility: config.visibility || 'private',
    category: config.category || 'random',
    difficulty: config.difficulty || 'mixed',
    teamCount,
    playersPerTeam: config.playersPerTeam || 3,
    targetScore: config.targetScore || 10,
    roundTime: config.roundTime || 60,
    currentRound: 0,
    timeLeft: config.roundTime || 60,
    wordCursor: 0,
    teams: Array.from({ length: teamCount }, (_, index) => `team${index + 1}`),
    players: [hostId],
    words: wordDeck,
    recentGuesses: [],
    bannedPlayers: []
  });
  await game.save();

  const teams = await Promise.all(
    Array.from({ length: game.teamCount }, (_, index) => Team.create({
      gameId: code,
      teamId: `team${index + 1}`,
      name: `Team ${index + 1}`,
      score: 0,
      players: index === safeTeamIndex ? [hostId] : []
    }))
  );

  await Player.create({
    playerId: hostId,
    socketId: hostSocketId,
    username: hostUsername,
    gameId: code,
    teamId: safeTeamId,
    isHost: true,
    isActor: false
  });

  return {
    ...game.toObject(),
    teams: teams.map((team) => team.toObject()),
    players: [{
      playerId: hostId,
      socketId: hostSocketId,
      username: hostUsername,
      gameId: code,
      teamId: safeTeamId,
      isHost: true,
      isActor: false
    }]
  };
}

async function getGameByCode(gameCodeValue) {
  const game = await Game.findOne({ gameCode: gameCodeValue });
  return hydrateGame(game);
}

async function addPlayerToGame(gameCodeValue, playerId, socketId, username, teamId) {
  const game = await Game.findOne({ gameCode: gameCodeValue });
  if (!game) {
    throw new Error('Game not found');
  }

  await Promise.all([
    Player.create({
      playerId,
      socketId,
      username,
      gameId: gameCodeValue,
      teamId,
      isHost: false,
      isActor: false
    }),
    Game.updateOne({ gameCode: gameCodeValue }, { $addToSet: { players: playerId } }),
    Team.updateOne({ gameId: gameCodeValue, teamId }, { $addToSet: { players: playerId } })
  ]);
}

async function updatePlayerSocket(gameCodeValue, playerId, newSocketId) {
  return Player.findOneAndUpdate(
    { gameId: gameCodeValue, playerId },
    { socketId: newSocketId },
    { new: true }
  );
}

async function startGame(gameCodeValue, nextDeck = []) {
  await Promise.all([
    Game.updateOne(
      { gameCode: gameCodeValue },
      {
        $set: {
          status: 'playing',
          currentRound: 0,
          currentTeam: null,
          currentActorId: null,
          currentWord: null,
          timeLeft: null,
          winner: null,
          wordCursor: 0,
          words: nextDeck,
          recentGuesses: [],
          lastRound: null
        }
      }
    ),
    Team.updateMany({ gameId: gameCodeValue }, { $set: { score: 0 } })
  ]);
}

async function submitGuess(gameCodeValue, playerId, guess, answer) {
  const game = await Game.findOne({ gameCode: gameCodeValue });
  if (!game) {
    throw new Error('Game not found');
  }

  const player = await Player.findOne({ gameId: gameCodeValue, playerId });
  if (!player) {
    throw new Error('Player not found');
  }

  const score = calculateScore(guess, answer);

  if (score > 0) {
    const team = await Team.findOne({ gameId: gameCodeValue, teamId: player.teamId });
    if (team) {
      team.score += score;
      await team.save();

      if (team.score >= game.targetScore) {
        game.status = 'finished';
        game.winner = player.teamId;
      } else {
        game.status = 'round_end';
      }
    }
  }

  await game.save();
  return { game, score };
}

async function removePlayer(gameCodeValue, playerId) {
  const player = await Player.findOne({ gameId: gameCodeValue, playerId });
  if (!player) {
    return;
  }

  await Promise.all([
    Player.deleteOne({ gameId: gameCodeValue, playerId }),
    Game.updateOne({ gameCode: gameCodeValue }, { $pull: { players: playerId } }),
    Team.updateOne({ gameId: gameCodeValue, teamId: player.teamId }, { $pull: { players: playerId } })
  ]);
}

async function cleanup(gameCodeValue) {
  await Promise.all([
    Player.deleteMany({ gameId: gameCodeValue }),
    Team.deleteMany({ gameId: gameCodeValue }),
    Game.deleteOne({ gameCode: gameCodeValue })
  ]);
}

async function listPublicGames() {
  return Game.find({ visibility: 'public', status: 'lobby' })
    .sort({ updatedAt: -1 })
    .lean();
}

async function createTeam(gameCodeValue, teamId, name) {
  return Team.create({
    gameId: gameCodeValue,
    teamId,
    name,
    score: 0,
    players: []
  });
}

async function removeTeam(gameCodeValue, teamId) {
  return Team.deleteOne({ gameId: gameCodeValue, teamId });
}

async function resetTeamScores(gameCodeValue) {
  return Team.updateMany({ gameId: gameCodeValue }, { $set: { score: 0 } });
}

async function updateGameState(gameCodeValue, updates) {
  if (!updates || !Object.keys(updates).length) {
    return;
  }

  await Game.updateOne({ gameCode: gameCodeValue }, { $set: updates });
}

async function movePlayerTeam(gameCodeValue, playerId, newTeamId) {
  const player = await Player.findOne({ gameId: gameCodeValue, playerId });
  if (!player) {
    throw new Error('Player not found.');
  }

  const oldTeamId = player.teamId;

  await Promise.all([
    Player.updateOne(
      { gameId: gameCodeValue, playerId },
      { $set: { teamId: newTeamId } }
    ),
    Team.updateOne(
      { gameId: gameCodeValue, teamId: oldTeamId },
      { $pull: { players: playerId } }
    ),
    Team.updateOne(
      { gameId: gameCodeValue, teamId: newTeamId },
      { $addToSet: { players: playerId } }
    )
  ]);
}

async function transferHost(gameCodeValue, newHostId, newHostName) {
  await Promise.all([
    Player.updateOne(
      { gameId: gameCodeValue, playerId: newHostId },
      { $set: { isHost: true } }
    ),
    Player.updateMany(
      { gameId: gameCodeValue, isHost: true, playerId: { $ne: newHostId } },
      { $set: { isHost: false } }
    ),
    Game.updateOne(
      { gameCode: gameCodeValue },
      { $set: { hostId: newHostId, hostName: newHostName } }
    )
  ]);
}

async function softLeavePlayer(gameCodeValue, playerId) {
  await Player.updateOne(
    { gameId: gameCodeValue, playerId },
    { $set: { connected: false, socketId: null } }
  );
}

function calculateScore(guess, answer) {
  const cleanGuess = String(guess || '').toLowerCase().trim();
  const cleanAnswer = String(answer || '').toLowerCase().trim();
  const distance = levenshteinDistance(cleanGuess, cleanAnswer);
  const maxLen = Math.max(cleanGuess.length, cleanAnswer.length);
  const similarity = maxLen === 0 ? 1 : 1 - (distance / maxLen);

  if (similarity >= 1) return 2;
  if (similarity >= 0.7) return 1;
  return 0;
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i += 1) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

module.exports = {
  DIFFICULTIES,
  addPlayerToGame,
  addWord,
  buildWordDeck,
  cleanup,
  createGame,
  createTeam,
  ensureCatalogSeeded,
  formatCategoryLabel,
  getCatalogSummary,
  getGameByCode,
  listPublicGames,
  movePlayerTeam,
  normalizeCategoryFilter,
  normalizeDifficulty,
  normalizeDifficultyFilter,
  removePlayer,
  removeTeam,
  resetTeamScores,
  softLeavePlayer,
  startGame,
  submitGuess,
  transferHost,
  updateGameState,
  updatePlayerSocket
};
