const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { RateLimiterMemory } = require('rate-limiter-flexible');
require('dotenv').config();

const { connectDB } = require('./db');
const gameService = require('./services/gameService');
const DEFAULT_WORDS = require('./defaultWords').map((entry) => entry.word);

const DISCONNECT_GRACE_MS = 20000;
const games = {};
let dbConnected = false;

const gameActionLimiter = new RateLimiterMemory({
  points: 40,
  duration: 60
});

const app = express();
const server = http.createServer(app);

(async () => {
  dbConnected = await connectDB();
  if (dbConnected) {
    await gameService.ensureCatalogSeeded();
  }
  console.log('MongoDB:', dbConnected ? 'Connected ✅' : 'Fallback ⚠️');
})();

const configuredOrigins = [
  ...(process.env.FRONTEND_URLS || '').split(','),
  process.env.FRONTEND_URL || ''
].map((origin) => origin.trim()).filter(Boolean);

const allowLocalOrigin = (origin, callback, label) => {
  if (!origin) {
    callback(null, true);
    return;
  }

  const isLocalhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (isLocalhostOrigin || configuredOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin ${origin} not allowed by ${label}`));
};

const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => allowLocalOrigin(origin, callback, 'Socket.IO'),
    methods: ['GET', 'POST']
  }
});

app.set('trust proxy', true);
app.use(cors({
  origin: (origin, callback) => allowLocalOrigin(origin, callback, 'CORS')
}));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'Act & Guess Game Backend', dbConnected });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    dbConnected,
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.get('/api/word-catalog', async (req, res) => {
  try {
    const catalog = await gameService.getCatalogSummary();
    res.json({
      ...catalog,
      categoryOptions: ['random', ...catalog.categories]
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not load the word catalog.' });
  }
});

app.get('/api/public-games', async (req, res) => {
  try {
    const liveGames = Object.values(games).filter((game) => (
      game.visibility === 'public' && game.status === 'lobby'
    ));

    if (liveGames.length) {
      res.json({ games: liveGames.map((game) => serializePublicGame(game)) });
      return;
    }

    if (dbConnected) {
      const publicGames = await gameService.listPublicGames();
      res.json({
        games: publicGames.map((game) => ({
          id: game.gameCode,
          gameId: game.gameCode,
          hostName: game.hostName || 'Host',
          category: game.category || 'random',
          categoryLabel: formatCategoryLabel(game.category || 'random'),
          difficulty: game.difficulty || 'mixed',
          visibility: game.visibility || 'private',
          teamCount: game.teamCount || 2,
          playersPerTeam: game.playersPerTeam || 3,
          roundTime: game.roundTime || 60,
          targetScore: game.targetScore || 10,
          currentPlayerCount: game.players?.length || 0,
          maxPlayers: (game.teamCount || 2) * (game.playersPerTeam || 3)
        }))
      });
      return;
    }

    res.json({ games: [] });
  } catch (err) {
    res.status(500).json({ error: 'Could not load public games.' });
  }
});

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeName(value, fallback) {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  return cleaned || fallback;
}

function sanitizePlayerId(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);

  return cleaned || fallback;
}

function sanitizeTeamId(teamId, teamCount) {
  const match = String(teamId || '').match(/^team(\d+)$/);
  const index = match ? Number.parseInt(match[1], 10) : 1;
  const safeIndex = clampNumber(index, 1, teamCount, 1);
  return `team${safeIndex}`;
}

function sanitizeVisibility(value) {
  return String(value || '').toLowerCase() === 'public' ? 'public' : 'private';
}

function formatCategoryLabel(category) {
  return gameService.formatCategoryLabel(category);
}

async function consumeAction(socket, actionKey, points = 1) {
  try {
    await gameActionLimiter.consume(`${actionKey}:${socket.handshake.address || socket.id}`, points);
    return null;
  } catch (err) {
    return 'Too many requests. Please slow down for a moment.';
  }
}

function buildTeams(teamCount) {
  return Object.fromEntries(
    Array.from({ length: teamCount }, (_, index) => {
      const teamId = `team${index + 1}`;
      return [teamId, {
        id: teamId,
        name: `Team ${index + 1}`,
        players: [],
        score: 0
      }];
    })
  );
}

function buildScores(teams) {
  return Object.fromEntries(
    Object.entries(teams).map(([teamId, team]) => [teamId, team.score || 0])
  );
}

function clearGameTimers(gameId) {
  const intervalId = gameTimers.get(gameId);
  if (intervalId) {
    clearInterval(intervalId);
    gameTimers.delete(gameId);
  }

  const timeoutId = nextRoundTimers.get(gameId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    nextRoundTimers.delete(gameId);
  }
}

const gameTimers = new Map();
const nextRoundTimers = new Map();
const disconnectCleanupTimers = new Map();

function disconnectTimerKey(gameId, playerId) {
  return `${gameId}:${playerId}`;
}

function clearDisconnectCleanup(gameId, playerId) {
  const key = disconnectTimerKey(gameId, playerId);
  const timerId = disconnectCleanupTimers.get(key);
  if (timerId) {
    clearTimeout(timerId);
    disconnectCleanupTimers.delete(key);
  }
}

function removePlayerFromTeam(team, playerId) {
  team.players = team.players.filter((id) => id !== playerId);
}

function addPlayerToGame(game, playerId, socketId, username, teamId, isHost = false) {
  const player = {
    id: playerId,
    socketId,
    username,
    teamId,
    isActor: false,
    isHost,
    connected: true,
    disconnectedAt: null
  };

  game.players[playerId] = player;
  game.teams[teamId].players.push(playerId);
  return player;
}

function serializeGame(game, viewerId) {
  const viewer = game.players[viewerId] || null;
  const scores = buildScores(game.teams);
  const currentActor = game.currentActorId ? game.players[game.currentActorId] : null;

  return {
    id: game.id,
    gameId: game.id,
    hostId: game.hostId,
    hostName: game.hostName,
    status: game.status,
    visibility: game.visibility,
    category: game.category,
    difficulty: game.difficulty,
    teamCount: game.teamCount,
    playersPerTeam: game.playersPerTeam,
    targetScore: game.targetScore,
    roundTime: game.roundTime,
    currentRound: game.currentRound,
    currentTeam: game.currentTeam,
    currentActorId: game.currentActorId,
    currentActorName: currentActor?.username || null,
    currentWord: viewerId === game.currentActorId ? game.currentWord : null,
    timeLeft: game.timeLeft,
    players: game.players,
    teams: game.teams,
    scores,
    recentGuesses: game.recentGuesses,
    lastRound: game.lastRound,
    winner: game.winner,
    bannedPlayers: game.bannedPlayers || [],
    selfId: viewerId,
    viewerTeamId: viewer?.teamId || null,
    isHost: viewerId === game.hostId,
    isActor: viewerId === game.currentActorId,
    canGuess: Boolean(
      viewer &&
      game.status === 'playing' &&
      viewer.teamId === game.currentTeam &&
      viewerId !== game.currentActorId
    )
  };
}

function serializePreview(game) {
  return {
    id: game.id,
    gameId: game.id,
    hostName: game.hostName,
    status: game.status,
    visibility: game.visibility,
    category: game.category,
    difficulty: game.difficulty,
    teamCount: game.teamCount,
    playersPerTeam: game.playersPerTeam,
    roundTime: game.roundTime,
    targetScore: game.targetScore,
    currentPlayerCount: Object.keys(game.players).length,
    teams: Object.fromEntries(
      Object.entries(game.teams).map(([teamId, team]) => [teamId, {
        id: teamId,
        name: team.name,
        playerCount: team.players.length,
        isFull: team.players.length >= game.playersPerTeam
      }])
    )
  };
}

function serializePublicGame(game) {
  return {
    id: game.id,
    gameId: game.id,
    hostName: game.hostName || 'Host',
    category: game.category,
    categoryLabel: formatCategoryLabel(game.category),
    difficulty: game.difficulty,
    visibility: game.visibility,
    teamCount: game.teamCount,
    playersPerTeam: game.playersPerTeam,
    roundTime: game.roundTime,
    targetScore: game.targetScore,
    currentPlayerCount: Object.keys(game.players).length,
    maxPlayers: game.teamCount * game.playersPerTeam
  };
}

function convertDbGameToMemory(dbGame) {
  const teams = {};
  const players = {};

  dbGame.teams?.forEach((team, index) => {
    const teamId = team.teamId || `team${index + 1}`;
    teams[teamId] = {
      id: teamId,
      name: team.name || `Team ${index + 1}`,
      players: Array.isArray(team.players) ? team.players.filter(Boolean) : [],
      score: team.score || 0
    };
  });

  dbGame.players?.forEach((player) => {
    const playerId = player.playerId || player._id?.toString();
    if (!playerId) {
      return;
    }

    const fallbackTeamId = dbGame.teams?.find(
      (team) => Array.isArray(team.players) && team.players.includes(playerId)
    )?.teamId;

    players[playerId] = {
      id: playerId,
      socketId: player.socketId,
      username: player.username,
      teamId: player.teamId || fallbackTeamId || 'team1',
      isHost: player.isHost,
      isActor: player.isActor,
      connected: player.connected !== false,
      disconnectedAt: player.disconnectedAt || null
    };
  });

  return {
    id: dbGame.gameCode,
    _id: dbGame._id,
    gameCode: dbGame.gameCode,
    hostId: dbGame.hostId,
    hostName: dbGame.hostName || 'Host',
    visibility: dbGame.visibility || 'private',
    category: dbGame.category || 'random',
    difficulty: dbGame.difficulty || 'mixed',
    teamCount: dbGame.teamCount || dbGame.teams?.length || 2,
    playersPerTeam: dbGame.playersPerTeam || 3,
    targetScore: dbGame.targetScore || 10,
    roundTime: dbGame.roundTime || 60,
    status: dbGame.status || 'lobby',
    currentRound: dbGame.currentRound ?? 0,
    currentTeam: dbGame.currentTeam,
    currentActorId: dbGame.currentActorId,
    currentWord: dbGame.currentWord,
    timeLeft: dbGame.timeLeft ?? dbGame.roundTime ?? 60,
    winner: dbGame.winner || null,
    wordCursor: dbGame.wordCursor ?? 0,
    words: dbGame.words?.length ? dbGame.words : [...DEFAULT_WORDS],
    players,
    teams,
    bannedPlayers: dbGame.bannedPlayers || [],
    recentGuesses: dbGame.recentGuesses || [],
    lastRound: dbGame.lastRound || null
  };
}

function emitGameState(gameId) {
  const game = games[gameId];
  if (!game) return;

  Object.values(game.players).forEach((player) => {
    if (!player.connected || !player.socketId) {
      return;
    }

    io.to(player.socketId).emit('gameState', serializeGame(game, player.id));
  });
}

function emitGameError(target, message) {
  io.to(target).emit('gameError', { message });
}

function emitGameErrorToPlayer(gameId, playerId, message) {
  const targetSocketId = games[gameId]?.players?.[playerId]?.socketId;
  if (!targetSocketId) {
    return;
  }

  emitGameError(targetSocketId, message);
}

function getConnectedTeamPlayers(game, teamId) {
  const team = game?.teams?.[teamId];
  if (!team) {
    return [];
  }

  return team.players.filter((playerId) => game.players[playerId]?.connected);
}

function teamHasConnectedPlayers(game, teamId, minimum = 1) {
  return getConnectedTeamPlayers(game, teamId).length >= minimum;
}

function persistRuntimeState(game) {
  if (!dbConnected || !game?.id) {
    return;
  }

  gameService.updateGameState(game.id, {
    hostId: game.hostId,
    hostName: game.hostName,
    status: game.status,
    visibility: game.visibility,
    category: game.category,
    difficulty: game.difficulty,
    teamCount: game.teamCount,
    playersPerTeam: game.playersPerTeam,
    targetScore: game.targetScore,
    roundTime: game.roundTime,
    currentRound: game.currentRound,
    currentTeam: game.currentTeam,
    currentActorId: game.currentActorId,
    currentWord: game.currentWord,
    timeLeft: game.timeLeft,
    winner: game.winner,
    wordCursor: game.wordCursor,
    words: game.words,
    bannedPlayers: game.bannedPlayers || [],
    recentGuesses: game.recentGuesses,
    lastRound: game.lastRound
  }).catch((err) => {
    console.error('Failed to persist game state:', err.message);
  });
}

function normalizeConfig(data = {}) {
  return {
    teamCount: clampNumber(data.teamCount, 2, 6, 2),
    playersPerTeam: clampNumber(data.playersPerTeam, 2, 8, 3),
    targetScore: clampNumber(data.targetScore, 1, 50, 10),
    roundTime: clampNumber(data.roundTime, 1, 60, 60),
    visibility: sanitizeVisibility(data.visibility),
    category: gameService.normalizeCategoryFilter(data.category, 'random'),
    difficulty: gameService.normalizeDifficultyFilter(data.difficulty, 'mixed')
  };
}

function createGameState(config, hostPlayerId, hostSocketId, hostName, hostTeamId) {
  const gameId = Math.random().toString(36).substring(2,8).toUpperCase();
  const teams = buildTeams(config.teamCount);
  const game = {
    id: gameId,
    hostId: hostPlayerId,
    hostName,
    visibility: config.visibility,
    category: config.category,
    difficulty: config.difficulty,
    teamCount: config.teamCount,
    playersPerTeam: config.playersPerTeam,
    targetScore: config.targetScore,
    roundTime: config.roundTime,
    status: 'lobby',
    currentRound: 0,
    currentTeam: null,
    currentActorId: null,
    currentWord: null,
    timeLeft: config.roundTime,
    winner: null,
    wordCursor: 0,
    words: [...(config.wordDeck || DEFAULT_WORDS)],
    players: {},
    teams,
    bannedPlayers: [],
    recentGuesses: [],
    lastRound: null
  };

  addPlayerToGame(game, hostPlayerId, hostSocketId, hostName, hostTeamId, true);
  games[gameId] = game;
  return game;
}

async function buildDeckFromConfig(config) {
  return gameService.buildWordDeck({
    category: config.category,
    difficulty: config.difficulty
  });
}

function highestOccupiedTeamIndex(game) {
  return Object.keys(game.teams).reduce((highest, teamId) => {
    const nextIndex = Number.parseInt(teamId.replace('team', ''), 10) || 0;
    return game.teams[teamId].players.length ? Math.max(highest, nextIndex) : highest;
  }, 0);
}

function teamPlayerCount(game, teamId) {
  return game.teams[teamId]?.players?.length || 0;
}

function applyLobbySettings(game, nextConfig) {
  const currentHighestOccupied = highestOccupiedTeamIndex(game);
  if (nextConfig.teamCount < currentHighestOccupied) {
    throw new Error('You cannot remove a team that already has players in it.');
  }

  const maxTeamSize = Object.keys(game.teams).reduce(
    (highest, teamId) => Math.max(highest, teamPlayerCount(game, teamId)),
    0
  );

  if (nextConfig.playersPerTeam < maxTeamSize) {
    throw new Error('Players per team cannot be smaller than the biggest team right now.');
  }

  const createdTeams = [];
  const removedTeams = [];

  if (nextConfig.teamCount > game.teamCount) {
    for (let index = game.teamCount + 1; index <= nextConfig.teamCount; index += 1) {
      const teamId = `team${index}`;
      game.teams[teamId] = {
        id: teamId,
        name: `Team ${index}`,
        players: [],
        score: 0
      };
      createdTeams.push(teamId);
    }
  }

  if (nextConfig.teamCount < game.teamCount) {
    for (let index = game.teamCount; index > nextConfig.teamCount; index -= 1) {
      const teamId = `team${index}`;
      if (teamPlayerCount(game, teamId) > 0) {
        throw new Error('Only empty teams can be removed.');
      }

      delete game.teams[teamId];
      removedTeams.push(teamId);
    }
  }

  game.teamCount = nextConfig.teamCount;
  game.playersPerTeam = nextConfig.playersPerTeam;
  game.targetScore = nextConfig.targetScore;
  game.roundTime = nextConfig.roundTime;
  game.visibility = nextConfig.visibility;
  game.category = nextConfig.category;
  game.difficulty = nextConfig.difficulty;
  game.words = [...(nextConfig.wordDeck || game.words)];
  game.wordCursor = 0;
  game.timeLeft = nextConfig.roundTime;

  return { createdTeams, removedTeams };
}

async function syncLobbySettings(game, nextConfig) {
  const teamChanges = applyLobbySettings(game, nextConfig);

  if (dbConnected) {
    await gameService.updateGameState(game.id, {
      teamCount: game.teamCount,
      playersPerTeam: game.playersPerTeam,
      targetScore: game.targetScore,
      roundTime: game.roundTime,
      visibility: game.visibility,
      category: game.category,
      difficulty: game.difficulty,
      words: game.words,
      wordCursor: game.wordCursor,
      teams: Object.keys(game.teams)
    });

    await Promise.all([
      ...teamChanges.createdTeams.map((teamId) => gameService.createTeam(game.id, teamId, game.teams[teamId].name)),
      ...teamChanges.removedTeams.map((teamId) => gameService.removeTeam(game.id, teamId))
    ]);
    await gameService.resetTeamScores(game.id);
  }
}

function markPlayerBanned(game, player) {
  const nextEntry = {
    playerId: player.id,
    username: player.username.toLowerCase(),
    reason: 'host_ban',
    bannedAt: new Date().toISOString()
  };

  const alreadyBanned = (game.bannedPlayers || []).some((entry) => (
    entry.playerId === nextEntry.playerId || entry.username === nextEntry.username
  ));

  if (!alreadyBanned) {
    game.bannedPlayers = [...(game.bannedPlayers || []), nextEntry];
  }
}

function removePlayerCompletely(gameId, playerId, options = {}) {
  const { ban = false, reason = 'removed' } = options;
  const game = games[gameId];
  if (!game) {
    return;
  }

  const player = game.players[playerId];
  if (!player) {
    return;
  }

  clearDisconnectCleanup(gameId, playerId);

  if (ban) {
    markPlayerBanned(game, player);
  }

  if (player.socketId) {
    emitGameError(player.socketId, ban ? 'You were banned from this lobby.' : 'You were removed from this lobby.');
    io.to(player.socketId).emit('sessionRemoved', { reason });
  }

  if (game.teams[player.teamId]) {
    removePlayerFromTeam(game.teams[player.teamId], playerId);
  }

  delete game.players[playerId];

  if (dbConnected) {
    gameService.removePlayer(game.id, playerId).catch((err) => {
      console.error('Failed to remove player:', err.message);
    });
  }

  if (playerId === game.hostId) {
    const nextHostId = Object.keys(game.players)[0] || null;
    game.hostId = nextHostId;
    game.hostName = nextHostId ? game.players[nextHostId]?.username || 'Host' : 'Host';

    Object.values(game.players).forEach((gamePlayer) => {
      gamePlayer.isHost = gamePlayer.id === nextHostId;
    });
  }

  if (!Object.keys(game.players).length) {
    clearGameTimers(game.id);
    if (dbConnected) {
      gameService.cleanup(game.id).catch((err) => {
        console.error('Failed to cleanup empty game:', err.message);
      });
    }
    delete games[game.id];
    return;
  }

  const activeTeam = game.currentTeam ? game.teams[game.currentTeam] : null;
  if (playerId === game.currentActorId || (activeTeam && !teamHasConnectedPlayers(game, game.currentTeam, 2))) {
    persistRuntimeState(game);
    endRound(game.id, reason);
    return;
  }

  persistRuntimeState(game);
  emitGameState(game.id);
}

function findPlayerBySocketId(game, socketId) {
  return Object.values(game.players).find((player) => player.socketId === socketId) || null;
}

function findHostRequester(game, socketId) {
  const requester = game ? findPlayerBySocketId(game, socketId) : null;
  if (!game || !requester || requester.id !== game.hostId) {
    return null;
  }

  return requester;
}

function findNextTeam(game) {
  const playableTeams = Object.keys(game.teams).filter(
    (teamId) => teamHasConnectedPlayers(game, teamId, 2)
  );

  if (!playableTeams.length) {
    return null;
  }

  if (!game.currentTeam) {
    return playableTeams[0];
  }

  const currentIndex = playableTeams.indexOf(game.currentTeam);
  if (currentIndex === -1) {
    return playableTeams[0];
  }

  return playableTeams[(currentIndex + 1) % playableTeams.length];
}

function scheduleNextRound(gameId) {
  clearGameTimers(gameId);
  const timeoutId = setTimeout(() => {
    startRound(gameId).catch((err) => {
      console.error('Error starting next round:', err);
    });
  }, 2500);
  nextRoundTimers.set(gameId, timeoutId);
}

function finishGame(gameId, winnerTeamId) {
  const game = games[gameId];
  if (!game) return;

  clearGameTimers(gameId);
  game.status = 'finished';
  game.winner = winnerTeamId;
  game.currentActorId = null;
  game.currentWord = null;
  game.timeLeft = 0;

  Object.values(game.players).forEach((player) => {
    player.isActor = false;
  });

  persistRuntimeState(game);
  emitGameState(gameId);
}

function endRound(gameId, reason = 'timeout') {
  const game = games[gameId];
  if (!game || game.status === 'finished') return;

  clearGameTimers(gameId);
  game.status = 'round_end';
  game.lastRound = {
    reason,
    word: game.currentWord,
    actorId: game.currentActorId,
    actorName: game.currentActorId ? game.players[game.currentActorId]?.username || null : null
  };
  game.timeLeft = 0;

  Object.values(game.players).forEach((player) => {
    player.isActor = false;
  });

  persistRuntimeState(game);
  emitGameState(gameId);
  scheduleNextRound(gameId);
}

async function startRound(gameId) {
  const game = games[gameId];
  if (!game) return;

  clearGameTimers(gameId);

  const nextTeamId = findNextTeam(game);
  if (!nextTeamId) {
    game.status = 'lobby';
    game.currentTeam = null;
    game.currentActorId = null;
    game.currentWord = null;
    game.timeLeft = game.roundTime;
    persistRuntimeState(game);
    emitGameErrorToPlayer(gameId, game.hostId, 'No playable teams are available.');
    emitGameState(gameId);
    return;
  }

  const teamPlayers = getConnectedTeamPlayers(game, nextTeamId);
  if (!teamPlayers.length) {
    game.status = 'lobby';
    game.currentTeam = null;
    game.currentActorId = null;
    game.currentWord = null;
    game.timeLeft = game.roundTime;
    persistRuntimeState(game);
    emitGameErrorToPlayer(gameId, game.hostId, 'The next team has no active players.');
    emitGameState(gameId);
    return;
  }

  if (!game.words?.length || game.wordCursor >= game.words.length) {
    game.words = await buildDeckFromConfig(game);
    game.wordCursor = 0;
  }

  const actorId = teamPlayers[Math.floor(Math.random() * teamPlayers.length)];
  const word = game.words[game.wordCursor];

  game.currentRound += 1;
  game.status = 'playing';
  game.currentTeam = nextTeamId;
  game.currentActorId = actorId;
  game.currentWord = word;
  game.wordCursor += 1;
  game.timeLeft = game.roundTime;
  game.recentGuesses = [];
  game.lastRound = null;
  game.winner = null;

  Object.values(game.players).forEach((player) => {
    player.isActor = player.id === actorId;
  });

  persistRuntimeState(game);
  emitGameState(gameId);

  const timerId = setInterval(() => {
    const activeGame = games[gameId];
    if (!activeGame || activeGame.status !== 'playing') {
      clearGameTimers(gameId);
      return;
    }

    activeGame.timeLeft -= 1;
    if (activeGame.timeLeft <= 0) {
      endRound(gameId, 'timeout');
      return;
    }

    emitGameState(gameId);
  }, 1000);

  gameTimers.set(gameId, timerId);
}

function finalizeDisconnectedPlayer(gameId, playerId) {
  const game = games[gameId];
  if (!game) {
    return;
  }

  const player = game.players[playerId];
  if (!player || player.connected) {
    clearDisconnectCleanup(gameId, playerId);
    return;
  }

  removePlayerCompletely(gameId, playerId, { reason: 'player_left' });
}

function handleDisconnect(socketId) {
  Object.values(games).forEach((game) => {
    const player = findPlayerBySocketId(game, socketId);
    if (!player) {
      return;
    }

    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = Date.now();

    clearDisconnectCleanup(game.id, player.id);
    const timerId = setTimeout(() => finalizeDisconnectedPlayer(game.id, player.id), DISCONNECT_GRACE_MS);
    disconnectCleanupTimers.set(disconnectTimerKey(game.id, player.id), timerId);

    emitGameState(game.id);
  });
}

function validateJoin(game, username, teamId, playerId) {
  if (!game) {
    return 'Game not found.';
  }

  if (game.status !== 'lobby') {
    return 'This game has already started.';
  }

  if (!game.teams[teamId]) {
    return 'That team does not exist.';
  }

  if (game.teams[teamId].players.length >= game.playersPerTeam) {
    return `${game.teams[teamId].name} is full.`;
  }

  const isBanned = (game.bannedPlayers || []).some((entry) => (
    entry.playerId === playerId || entry.username === username.toLowerCase()
  ));

  if (isBanned) {
    return 'You were banned from this lobby.';
  }

  const usernameTaken = Object.values(game.players).some(
    (player) => player.id !== playerId && player.username.toLowerCase() === username.toLowerCase()
  );

  if (usernameTaken) {
    return 'That player name is already taken.';
  }

  return null;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createGame', async (data, callback) => {
    try {
      const limitError = await consumeAction(socket, 'create-game', 2);
      if (limitError) {
        callback?.({ error: limitError });
        return;
      }

      const config = normalizeConfig(data);
      config.wordDeck = await buildDeckFromConfig(config);
      const username = sanitizeName(data.username, 'Host');
      const teamIndex = Math.max(
        0,
        Number.parseInt(data.teamId?.match(/\d+/)?.[0] || '1', 10) - 1
      );
      const playerId = sanitizePlayerId(data.playerId, socket.id);

      let game;
      if (dbConnected) {
        game = await gameService.createGame(config, playerId, socket.id, username, teamIndex);
        game = convertDbGameToMemory(game);
      } else {
        game = createGameState(config, playerId, socket.id, username, `team${teamIndex + 1}`);
      }

      games[game.id] = game;
      socket.join(game.id);

      const payload = serializeGame(game, playerId);
      emitGameState(game.id);
      if (callback) callback(payload);
    } catch (err) {
      console.error('Error creating game:', err);
      if (callback) callback({ error: err.message });
    }
  });

  socket.on('listPublicGames', async (_payload, callback) => {
    try {
      const liveGames = Object.values(games).filter((game) => (
        game.visibility === 'public' && game.status === 'lobby'
      ));

      if (liveGames.length) {
        callback?.({
          games: liveGames
            .sort((left, right) => Object.keys(right.players).length - Object.keys(left.players).length)
            .map((game) => serializePublicGame(game))
        });
        return;
      }

      if (dbConnected) {
        const publicGames = await gameService.listPublicGames();
        callback?.({
          games: publicGames.map((game) => ({
            id: game.gameCode,
            gameId: game.gameCode,
            hostName: game.hostName || 'Host',
            category: game.category || 'random',
            categoryLabel: formatCategoryLabel(game.category || 'random'),
            difficulty: game.difficulty || 'mixed',
            visibility: game.visibility || 'private',
            teamCount: game.teamCount || 2,
            playersPerTeam: game.playersPerTeam || 3,
            roundTime: game.roundTime || 60,
            targetScore: game.targetScore || 10,
            currentPlayerCount: game.players?.length || 0,
            maxPlayers: (game.teamCount || 2) * (game.playersPerTeam || 3)
          }))
        });
        return;
      }

      callback?.({ games: [] });
    } catch (err) {
      console.error('Error listing public games:', err);
      callback?.({ error: 'Could not load public games right now.' });
    }
  });

  socket.on('getWordCatalog', async (_payload, callback) => {
    try {
      const catalog = await gameService.getCatalogSummary();
      callback?.({
        ...catalog,
        categoryOptions: ['random', ...catalog.categories]
      });
    } catch (err) {
      console.error('Error loading word catalog:', err);
      callback?.({ error: 'Could not load the word catalog.' });
    }
  });

  socket.on('getGameInfo', async ({ gameId }, callback) => {
    if (!games[gameId] && dbConnected) {
      const dbGame = await gameService.getGameByCode(gameId);
      if (dbGame) {
        const game = convertDbGameToMemory(dbGame);
        games[gameId] = game;
      }
    }
    const game = games[gameId];
    if (!game) {
      callback({ error: 'Game not found.' });
      return;
    }

    callback(serializePreview(game));
  });

  socket.on('joinGame', async ({ gameId, username, teamId, playerId }, callback) => {
    try {
      const limitError = await consumeAction(socket, 'join-game', 1);
      if (limitError) {
        callback?.({ error: limitError });
        return;
      }

      let game = games[gameId];
      if (!game && dbConnected) {
        const dbGame = await gameService.getGameByCode(gameId);
        if (dbGame) {
          game = convertDbGameToMemory(dbGame);
          games[gameId] = game;
        }
      }
      const safeName = sanitizeName(username, '');
      const safeTeamId = sanitizeTeamId(teamId, game?.teamCount || 2);
      const safePlayerId = sanitizePlayerId(playerId, socket.id);

      if (!safeName) {
        callback({ error: 'Please enter a player name.' });
        return;
      }

      const joinError = validateJoin(game, safeName, safeTeamId, safePlayerId);
      if (joinError) {
        callback({ error: joinError });
        return;
      }

      if (dbConnected) {
        await gameService.addPlayerToGame(gameId, safePlayerId, socket.id, safeName, safeTeamId);
      }

      addPlayerToGame(game, safePlayerId, socket.id, safeName, safeTeamId, false);
      socket.join(game.id);
      emitGameState(game.id);
      callback(serializeGame(game, safePlayerId));
    } catch (err) {
      console.error('Error joining game:', err);
      callback({ error: err.message });
    }
  });

  socket.on('addWord', async ({ gameId, word, category, difficulty }, callback) => {
    try {
      const limitError = await consumeAction(socket, 'add-word', 2);
      if (limitError) {
        callback?.({ error: limitError });
        return;
      }

      const game = gameId ? games[gameId] : null;
      if (gameId && !findHostRequester(game, socket.id)) {
        callback?.({ error: 'Only the host can add words for this lobby.' });
        return;
      }

      const createdBy = game ? game.hostName || 'host' : 'host';
      const addedWord = await gameService.addWord({ word, category, difficulty }, createdBy);
      const catalog = await gameService.getCatalogSummary();
      callback?.({
        ok: true,
        word: addedWord,
        catalog: {
          ...catalog,
          categoryOptions: ['random', ...catalog.categories]
        }
      });
    } catch (err) {
      console.error('Error adding word:', err);
      callback?.({ error: err.message });
    }
  });

  socket.on('updateGameSettings', async ({ gameId, settings }, callback) => {
    try {
      const limitError = await consumeAction(socket, 'update-settings', 1);
      if (limitError) {
        callback?.({ error: limitError });
        return;
      }

      const game = games[gameId];
      if (!findHostRequester(game, socket.id)) {
        callback?.({ error: 'Only the host can edit the game settings.' });
        return;
      }

      if (game.status === 'playing' || game.status === 'round_end') {
        callback?.({ error: 'You can only edit settings between sessions.' });
        return;
      }

      const nextConfig = normalizeConfig(settings);
      nextConfig.wordDeck = await buildDeckFromConfig(nextConfig);
      game.status = 'lobby';
      game.currentRound = 0;
      game.currentTeam = null;
      game.currentActorId = null;
      game.currentWord = null;
      game.timeLeft = nextConfig.roundTime;
      game.winner = null;
      game.lastRound = null;
      game.recentGuesses = [];

      Object.values(game.teams).forEach((team) => {
        team.score = 0;
      });

      await syncLobbySettings(game, nextConfig);
      persistRuntimeState(game);
      emitGameState(game.id);
      callback?.({ ok: true, snapshot: serializeGame(game, game.hostId) });
    } catch (err) {
      console.error('Error updating game settings:', err);
      callback?.({ error: err.message });
    }
  });

  socket.on('returnToLobby', async ({ gameId }, callback) => {
    try {
      const game = games[gameId];
      if (!findHostRequester(game, socket.id)) {
        callback?.({ error: 'Only the host can return the game to the lobby.' });
        return;
      }

      clearGameTimers(game.id);
      game.status = 'lobby';
      game.currentRound = 0;
      game.currentTeam = null;
      game.currentActorId = null;
      game.currentWord = null;
      game.timeLeft = game.roundTime;
      game.winner = null;
      game.lastRound = null;
      game.recentGuesses = [];
      game.wordCursor = 0;
      game.words = await buildDeckFromConfig(game);

      Object.values(game.players).forEach((player) => {
        player.isActor = false;
      });
      Object.values(game.teams).forEach((team) => {
        team.score = 0;
      });

      if (dbConnected) {
        await gameService.resetTeamScores(game.id);
      }

      persistRuntimeState(game);
      emitGameState(game.id);
      callback?.({ ok: true });
    } catch (err) {
      console.error('Error returning to lobby:', err);
      callback?.({ error: err.message });
    }
  });

  socket.on('kickPlayer', async ({ gameId, playerId, ban }, callback) => {
    try {
      const game = games[gameId];
      if (!findHostRequester(game, socket.id)) {
        callback?.({ error: 'Only the host can moderate players.' });
        return;
      }

      if (!playerId || playerId === game.hostId) {
        callback?.({ error: 'The host cannot remove this player.' });
        return;
      }

      const target = game.players[playerId];
      if (!target) {
        callback?.({ error: 'Player not found.' });
        return;
      }

      removePlayerCompletely(gameId, playerId, {
        ban: Boolean(ban),
        reason: ban ? 'banned' : 'kicked'
      });
      callback?.({ ok: true });
    } catch (err) {
      console.error('Error moderating player:', err);
      callback?.({ error: err.message });
    }
  });

  socket.on('endGameConfirm', async ({ gameId }) => {
    clearGameTimers(gameId);
    if (dbConnected) {
      await gameService.cleanup(gameId);
    }
    delete games[gameId];
  });

  socket.on('resumeSession', async ({ gameId, playerId }, callback) => {
    try {
      let game = games[gameId];
      if (!game && dbConnected) {
        const dbGame = await gameService.getGameByCode(gameId);
        if (dbGame) {
          game = convertDbGameToMemory(dbGame);
          games[gameId] = game;
        }
      }

      const safePlayerId = sanitizePlayerId(playerId, '');
      const player = game?.players?.[safePlayerId];

      if (!game || !player) {
        callback?.({ error: 'Game session not found.' });
        return;
      }

      clearDisconnectCleanup(gameId, safePlayerId);
      player.connected = true;
      player.socketId = socket.id;
      player.disconnectedAt = null;
      socket.join(game.id);

      if (dbConnected) {
        await gameService.updatePlayerSocket(game.id, safePlayerId, socket.id);
      }

      const snapshot = serializeGame(game, safePlayerId);
      persistRuntimeState(game);
      emitGameState(game.id);
      callback?.(snapshot);
    } catch (err) {
      console.error('Error resuming session:', err);
      callback?.({ error: 'Unable to resume your session right now.' });
    }
  });

  socket.on('startGame', async ({ gameId }, callback) => {
    try {
      const game = games[gameId];
      if (!findHostRequester(game, socket.id)) {
        callback?.({ error: 'Only the host can start the game.' });
        return;
      }

      const everyTeamReady = Object.values(game.teams).every((team) => (
        teamHasConnectedPlayers(game, team.id, 2)
      ));
      if (!everyTeamReady) {
        const message = 'Each team needs at least two players before the game can start.';
        emitGameError(socket.id, message);
        callback?.({ error: message });
        return;
      }

      game.currentRound = 0;
      game.currentTeam = null;
      game.currentActorId = null;
      game.currentWord = null;
      game.timeLeft = game.roundTime;
      game.winner = null;
      game.lastRound = null;
      game.recentGuesses = [];
      game.wordCursor = 0;
      game.words = await buildDeckFromConfig(game);

      Object.values(game.teams).forEach((team) => {
        team.score = 0;
      });

      if (dbConnected) {
        await gameService.startGame(game.id, game.words);
      }

      await startRound(gameId);
      callback?.({ ok: true });
    } catch (err) {
      console.error('Error starting game:', err);
      callback?.({ error: err.message });
    }
  });

  socket.on('submitGuess', async ({ gameId, guess }, callback) => {
    try {
      const game = games[gameId];
      if (!game || game.status !== 'playing') {
        callback?.({ error: 'No round is currently active.' });
        return;
      }

      const player = findPlayerBySocketId(game, socket.id);
      const cleanGuess = String(guess || '').trim();

      if (!cleanGuess) {
        callback?.({ error: 'Guess cannot be empty.' });
        return;
      }

      if (!player) {
        callback?.({ error: 'You are not part of this game.' });
        return;
      }

      if (player.teamId !== game.currentTeam || player.id === game.currentActorId) {
        callback?.({ error: 'Only the acting team can submit guesses.' });
        return;
      }

      if (!game.currentWord) {
        callback?.({ error: 'No word is currently being acted.' });
        return;
      }

      const score = calculateScore(cleanGuess, game.currentWord);
      game.recentGuesses = [{
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        guess: cleanGuess,
        playerId: player.id,
        username: player.username,
        teamId: player.teamId,
        score
      }, ...game.recentGuesses].slice(0, 8);

      if (score > 0) {
        game.teams[player.teamId].score += score;
        
        if (dbConnected) {
          await gameService.submitGuess(
            game.gameCode,
            player.id,
            cleanGuess,
            game.currentWord
          );
        }

        persistRuntimeState(game);
        emitGameState(gameId);

        if (game.teams[player.teamId].score >= game.targetScore) {
          finishGame(gameId, player.teamId);
        } else {
          endRound(gameId, 'guessed');
        }

        callback?.({ ok: true, score });
        return;
      }

      persistRuntimeState(game);
      emitGameState(gameId);
      callback?.({ ok: true, score: 0 });
    } catch (err) {
      console.error('Error submitting guess:', err);
      callback?.({ error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    handleDisconnect(socket.id);
  });
});

function calculateScore(guess, answer) {
  if (!guess || !answer) return 0;

  const cleanGuess = String(guess).toLowerCase().trim();
  const cleanAnswer = String(answer).toLowerCase().trim();

  if (!cleanGuess || !cleanAnswer) return 0;

  const distance = levenshteinDistance(cleanGuess, cleanAnswer);
  const maxLen = Math.max(cleanGuess.length, cleanAnswer.length);
  const similarity = maxLen === 0 ? 1 : 1 - (distance / maxLen);

  if (similarity >= 1) return 2;
  if (similarity >= 0.7) return 1;
  return 0;
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
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

const PORT = process.env.PORT || process.env.BACKEND_PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
