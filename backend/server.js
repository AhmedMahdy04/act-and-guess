const crypto = require('node:crypto');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const { RateLimiterMemory } = require('rate-limiter-flexible');
require('dotenv').config();

const { connectDB, disconnectDB } = require('./db');
const gameService = require('./services/gameService');
const wordService = require('./services/wordService');
const adminService = require('./services/adminService');
const { registerAdminEvents, notifyMatchChanged } = require('./services/adminEvents');
const adminRoutes = require('./routes/admin');
const { adminAuth } = require('./middleware/adminAuth');
const siteSettings = require('./services/siteSettings');

const hosted = Boolean(process.env.VERCEL);
const PRESENCE_INTERVAL_MS = 12000;
const PRESENCE_TIMEOUT_MS = 45000;
const SYNC_INTERVAL_MS = 1200;
const TEST_ROOM_DURATION_MS = 2 * 60 * 60 * 1000;
const DISCONNECT_GRACE_MS = 20000;
const ROUND_BREAK_MS = 2500;
const ROUND_HISTORY_LIMIT = 500;
const MATCH_HISTORY_LIMIT = 50;
const MATCH_LIST_FIELDS = ['status', 'currentRound', 'visibility', 'category', 'difficulty', 'teamCount'];
const GAME_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const isProduction = process.env.NODE_ENV === 'production';
const requireDatabase = isProduction || process.env.REQUIRE_DATABASE === 'true';
const proxyHops = Math.max(0, Number.parseInt(process.env.TRUST_PROXY_HOPS, 10) || 0);
const games = new Map();
const gameActions = new Map();
const roundTimers = new Map();
const disconnectTimers = new Map();
const identityLimiter = new RateLimiterMemory({ points: 120, duration: 60 });
const actionLimiter = new RateLimiterMemory({ points: 45, duration: 30 });
let dbConnected = false;
let shuttingDown = false;

const app = express();
const server = http.createServer(app);
const configuredOrigins = new Set([
  ...(process.env.FRONTEND_URLS || '').split(','),
  process.env.FRONTEND_URL || ''
].map((origin) => origin.trim()).filter(Boolean));

function isAllowedOrigin(origin) {
  return !origin || configuredOrigins.has(origin) || (
    !isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );
}

const corsOptions = { origin: (origin, callback) => callback(null, isAllowedOrigin(origin)) };
const io = new Server(server, {
  cors: corsOptions,
  allowRequest: (request, callback) => callback(null, isAllowedOrigin(request.headers.origin)),
  ...(hosted ? { transports: ['websocket'] } : {}),
  maxHttpBufferSize: 16 * 1024
});

registerAdminEvents(io);
wordService.onCatalogChanged(() => io.emit('wordCatalogChanged'));

app.set('trust proxy', proxyHops);
app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.delete('/api/admin/test-rooms/:id', adminAuth, async (req, res) => {
  try {
    const id = normalizeGameId(req.params.id);
    await queueGameAction(id, async () => {
      for (let attempt = 0; ; attempt += 1) {
        const game = await loadGame(id);
        if (!game || game.testOwner !== req.admin.id) return;
        const next = structuredClone(game);
        closeGame(next, 'closed');
        try {
          await commitGame(next);
          for (const player of Object.values(game.players)) {
            clearDisconnect(id, player.id);
            releaseSession(player.socketId, id, 'closed');
          }
          return;
        } catch (error) {
          if (error.code !== 'GAME_CONFLICT' || attempt >= 4) throw error;
        }
      }
    });
    res.status(204).end();
  } catch (error) {
    if (error instanceof RequestError) return res.status(400).json({ error: error.message });
    console.error('Could not close test room:', error.name);
    res.status(503).json({ error: 'Could not close this test room. Try again.' });
  }
});

app.use('/api/admin', adminRoutes);

app.get('/', (_req, res) => {
  res.json({ message: 'Act & Guess Game Backend', dbConnected: gameService.isDbReady() });
});

app.get('/api/site-settings', async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15');
    res.json(await siteSettings.getSettings());
  } catch (error) {
    next(error);
  }
});

app.get('/health', (_req, res) => {
  const ready = gameService.isDbReady();
  const ok = !(requireDatabase || dbConnected) || ready;
  res.status(ok ? 200 : 503).json({
    ok,
    dbConnected: ready,
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.get('/api/word-catalog', async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getCatalogSummary());
  } catch (err) {
    console.error('Failed to load the word catalog:', err.message);
    res.status(503).json({ error: 'Could not load the word catalog.' });
  }
});

app.get('/api/public-games', async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ games: await listPublicGames() });
  } catch (err) {
    console.error('Failed to list public games:', err.message);
    res.status(503).json({ error: 'Could not load public games right now.' });
  }
});

class RequestError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function normalizeGameId(value) {
  const id = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{1,6}$/.test(id)) {
    throw new RequestError('Enter a valid game code.');
  }
  return id;
}

function cleanPlayerId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) && !Object.hasOwn(Object.prototype, id) ? id : '';
}

function cleanName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 24) : '';
}

function cleanTeamId(value, teamCount) {
  if (typeof value !== 'string' || !/^team[1-6]$/.test(value) || Number(value.slice(4)) > teamCount) {
    throw new RequestError('Select an available team.');
  }
  return value;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(typeof value === 'number' || typeof value === 'string' ? value : '', 10);
  return Number.isNaN(parsed) ? fallback : Math.min(max, Math.max(min, parsed));
}

function normalizeConfig(data) {
  return {
    teamCount: clampNumber(data.teamCount, 2, 6, 2),
    playersPerTeam: clampNumber(data.playersPerTeam, 2, 8, 3),
    targetScore: clampNumber(data.targetScore, 1, 50, 10),
    roundTime: clampNumber(data.roundTime, 1, 60, 60),
    visibility: data.visibility === 'public' ? 'public' : 'private',
    category: wordService.normalizeCategoryFilter(data.category, 'random'),
    difficulty: wordService.normalizeDifficultyFilter(data.difficulty, 'mixed')
  };
}

function createCode() {
  return Array.from(crypto.randomBytes(6), (byte) => GAME_CODE_ALPHABET[byte % GAME_CODE_ALPHABET.length]).join('');
}

function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canResume(player, token) {
  if (!player?.sessionHash || typeof token !== 'string' || !/^[\da-f]{64}$/.test(token)) return false;
  const savedHash = Buffer.from(player.sessionHash, 'hex');
  const suppliedHash = Buffer.from(hashToken(token), 'hex');
  return savedHash.length === suppliedHash.length && crypto.timingSafeEqual(savedHash, suppliedHash);
}

function requireCatalogConnection() {
  if (dbConnected && !gameService.isDbReady()) {
    throw new RequestError('The word catalog is temporarily unavailable. Please try again.');
  }
}

function getCatalogSummary() {
  requireCatalogConnection();
  return wordService.getCatalogSummary();
}

function buildTeam(teamId) {
  return { id: teamId, name: `Team ${teamId.slice(4)}`, players: [], score: 0 };
}

function buildTeams(teamCount) {
  return Object.fromEntries(Array.from({ length: teamCount }, (_, index) => {
    const id = `team${index + 1}`;
    return [id, buildTeam(id)];
  }));
}

function addPlayer(game, { playerId, username, teamId }, socket, isHost = false) {
  const id = cleanPlayerId(playerId) || crypto.randomUUID();
  if (Object.hasOwn(game.players, id)) {
    throw new RequestError('This player already belongs to the lobby. Reconnect to resume.');
  }

  const sessionToken = crypto.randomBytes(32).toString('hex');
  game.players[id] = {
    id,
    username,
    teamId,
    socketId: socket.id,
    lastSeen: Date.now(),
    sessionHash: hashToken(sessionToken),
    isHost,
    isActor: false,
    connected: true,
    disconnectedAt: null
  };
  game.teams[teamId].players.push(id);
  if (isHost) {
    game.hostId = id;
    game.hostName = username;
  }

  return { id, sessionToken };
}

function getTimeLeft(game) {
  if (game.status === 'playing' && game.roundEndsAt) {
    return Math.max(0, Math.ceil((game.roundEndsAt - Date.now()) / 1000));
  }
  return game.timeLeft;
}

function serializeGame(game, viewerId) {
  const viewer = game.players[viewerId];
  const actor = game.status === 'playing' && viewerId === game.currentActorId;
  return {
    id: game.id,
    gameId: game.id,
    testRoom: Boolean(game.testOwner),
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
    roundId: game.roundId,
    currentTeam: game.currentTeam,
    currentActorId: game.currentActorId,
    currentActorName: game.players[game.currentActorId]?.username || null,
    currentWord: actor ? game.currentWord : null,
    timeLeft: getTimeLeft(game),
    players: Object.fromEntries(Object.values(game.players).map(({
      id, username, teamId, isHost, isActor, connected
    }) => [id, { id, username, teamId, isHost, isActor, connected }])),
    teams: game.teams,
    scores: getScores(game),
    recentGuesses: game.recentGuesses,
    lastRound: game.lastRound,
    winner: game.winner,
    bannedPlayers: viewerId === game.hostId ? game.bannedPlayers : [],
    selfId: viewerId,
    viewerTeamId: viewer?.teamId || null,
    isHost: viewerId === game.hostId,
    isActor: actor,
    canGuess: Boolean(viewer?.connected && game.status === 'playing' && !game.recoveryUntil && viewer.teamId === game.currentTeam && !actor)
  };
}

async function serializePreview(game) {
  const categoryLabels = await wordService.getCategoryLabels([game.category]);
  return {
    id: game.id,
    gameId: game.id,
    hostName: game.hostName,
    status: game.status,
    visibility: game.visibility,
    category: game.category,
    categoryLabel: categoryLabels[game.category],
    difficulty: game.difficulty,
    teamCount: game.teamCount,
    playersPerTeam: game.playersPerTeam,
    roundTime: game.roundTime,
    targetScore: game.targetScore,
    currentPlayerCount: Object.keys(game.players).length,
    teams: Object.fromEntries(Object.values(game.teams).map((team) => [team.id, {
      id: team.id,
      name: team.name,
      playerCount: team.players.length,
      isFull: team.players.length >= game.playersPerTeam
    }]))
  };
}

function serializePublicGame(game, categoryLabels) {
  const id = game.id || game.gameCode;
  const category = game.category || 'random';
  return {
    id,
    gameId: id,
    hostName: game.hostName || 'Host',
    category,
    categoryLabel: categoryLabels[category],
    difficulty: game.difficulty || 'mixed',
    visibility: 'public',
    teamCount: game.teamCount || 2,
    playersPerTeam: game.playersPerTeam || 3,
    roundTime: game.roundTime || 60,
    targetScore: game.targetScore || 10,
    currentPlayerCount: Object.values(game.players || {}).length,
    maxPlayers: (game.teamCount || 2) * (game.playersPerTeam || 3)
  };
}

async function listPublicGames() {
  const persisted = dbConnected ? await gameService.listPublicGames() : [];
  const live = (hosted ? [] : [...games.values()]).filter((game) => game.visibility === 'public' && game.status === 'lobby');
  const publicGames = [...live, ...persisted.filter((game) => !games.has(game.gameCode))];
  const categoryLabels = await wordService.getCategoryLabels(publicGames.map((game) => game.category || 'random'));
  return publicGames
    .map((game) => serializePublicGame(game, categoryLabels))
    .sort((left, right) => right.currentPlayerCount - left.currentPlayerCount)
    .slice(0, 50);
}

function queueGameAction(gameId, action) {
  const previous = gameActions.get(gameId) || Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  gameActions.set(gameId, next);
  const clear = () => {
    if (gameActions.get(gameId) === next) gameActions.delete(gameId);
  };
  next.then(clear, clear);
  return next;
}

async function loadGame(id) {
  if (!hosted && games.has(id)) {
    const game = games.get(id);
    return game.testExpiresAt && Number(game.testExpiresAt) <= Date.now() ? null : game;
  }
  if (!dbConnected) return null;

  const saved = await gameService.getGameByCode(id);
  if (!saved || (saved.testExpiresAt && Number(saved.testExpiresAt) <= Date.now())) return null;

  const now = Date.now();
  const config = normalizeConfig(saved);
  const teams = buildTeams(config.teamCount);
  for (const team of saved.runtimeTeams) {
    if (!Object.hasOwn(teams, team.teamId)) continue;
    teams[team.teamId].name = team.name || teams[team.teamId].name;
    teams[team.teamId].score = Number(saved.scores?.[team.teamId] ?? team.score) || 0;
  }

  const players = {};
  for (const player of saved.runtimePlayers) {
    const id = cleanPlayerId(player.playerId);
    if (!id) continue;
    const oldTeam = saved.runtimeTeams.find((team) => team.players?.includes(id));
    const requestedTeam = player.teamId || oldTeam?.teamId;
    const teamId = Object.hasOwn(teams, requestedTeam) ? requestedTeam : 'team1';
    players[id] = {
      id,
      teamId,
      username: cleanName(player.username) || 'Player',
      socketId: hosted ? player.socketId : null,
      lastSeen: player.lastSeen,
      sessionHash: player.sessionHash || null,
      isHost: id === saved.hostId,
      isActor: saved.status === 'playing' && id === saved.currentActorId,
      connected: hosted && Boolean(player.connected),
      disconnectedAt: hosted ? player.disconnectedAt : now
    };
    teams[teamId].players.push(id);
  }

  const recovering = saved.status === 'playing' || saved.status === 'round_end';
  const game = {
    ...config,
    id,
    revision: saved.revision,
    testOwner: saved.testOwner,
    testExpiresAt: saved.testExpiresAt,
    players,
    teams,
    status: saved.status || 'lobby',
    hostId: saved.hostId || null,
    hostName: saved.hostName || 'Host',
    currentRound: saved.currentRound || 0,
    matchId: saved.matchId || (recovering ? crypto.randomUUID() : null),
    matchStartedAt: saved.matchStartedAt || (recovering ? Number(saved.createdAt) || now : null),
    roundId: saved.roundId || (recovering ? crypto.randomUUID() : null),
    roundStartedAt: saved.roundStartedAt || (saved.status === 'playing' ? Number(saved.updatedAt) || now : null),
    roundEndsAt: saved.roundEndsAt || (saved.status === 'playing' ? now + (saved.timeLeft || config.roundTime) * 1000 : null),
    nextRoundAt: saved.nextRoundAt || (saved.status === 'round_end' ? now + ROUND_BREAK_MS : null),
    currentTeam: saved.currentTeam || null,
    currentActorId: saved.currentActorId || null,
    currentWord: saved.currentWord || null,
    timeLeft: saved.timeLeft ?? config.roundTime,
    winner: saved.winner || null,
    wordCursor: saved.wordCursor || 0,
    teamActorCursor: saved.teamActorCursor || {},
    words: saved.words || [],
    bannedPlayers: (saved.bannedPlayers || []).map(({ _id, ...entry }) => entry),
    recentGuesses: (saved.recentGuesses || []).map(({ _id, ...entry }) => entry),
    lastRound: saved.lastRound?.reason ? saved.lastRound : null,
    roundHistory: saved.roundHistory || [],
    matchHistory: saved.matchHistory || [],
    closedAt: null,
    recoveryUntil: recovering && !hosted ? now + DISCONNECT_GRACE_MS : null
  };

  if (hosted) return game;
  games.set(id, game);
  for (const player of Object.values(players)) scheduleDisconnect(game.id, player);
  scheduleRound(game);
  return game;
}

function emitGameState(game) {
  for (const player of Object.values(game.players)) {
    if (player.connected && player.socketId) {
      io.to(player.socketId).emit('gameState', serializeGame(game, player.id));
    }
  }
}

async function commitGame(game, { create = false } = {}) {
  game.timeLeft = getTimeLeft(game);
  if (dbConnected) {
    const previous = games.get(game.id);
    await gameService.saveGame(game, { create, previous });
    if (!game.testOwner && (!previous || game.closedAt || MATCH_LIST_FIELDS.some((field) => game[field] !== previous[field]) ||
        Object.keys(game.players).length !== Object.keys(previous.players).length)) {
      notifyMatchChanged();
    }
  }

  if (game.closedAt) {
    games.delete(game.id);
  } else {
    if (!hosted) games.set(game.id, game);
    emitGameState(game);
  }
  scheduleRound(game);
}

function resetMatch(game) {
  Object.assign(game, {
    status: 'lobby',
    currentRound: 0,
    matchId: null,
    matchStartedAt: null,
    roundId: null,
    roundStartedAt: null,
    roundEndsAt: null,
    nextRoundAt: null,
    currentTeam: null,
    currentActorId: null,
    currentWord: null,
    timeLeft: game.roundTime,
    winner: null,
    words: [],
    wordCursor: 0,
    teamActorCursor: {},
    recentGuesses: [],
    lastRound: null,
    recoveryUntil: null
  });
  for (const player of Object.values(game.players)) player.isActor = false;
  for (const team of Object.values(game.teams)) team.score = 0;
}

function getScores(game) {
  return Object.fromEntries(Object.values(game.teams).map((team) => [team.id, team.score]));
}

function archiveMatch(game, reason) {
  if (!game.matchId || game.matchHistory.some((entry) => entry.matchId === game.matchId)) return;

  game.matchHistory = [...game.matchHistory, {
    matchId: game.matchId,
    startedAt: game.matchStartedAt,
    endedAt: Date.now(),
    rounds: game.currentRound,
    reason,
    winner: game.winner,
    scores: getScores(game)
  }].slice(-MATCH_HISTORY_LIMIT);
}

function getPlayablePlayers(game, teamId) {
  return game.teams[teamId]?.players.filter((id) => game.players[id]?.connected) || [];
}

function playableTeamIds(game) {
  return Object.keys(game.teams).filter((teamId) => getPlayablePlayers(game, teamId).length >= 2);
}

function nextTeamId(game) {
  const teamIds = Object.keys(game.teams);
  const current = teamIds.indexOf(game.currentTeam);
  const playable = new Set(playableTeamIds(game));
  const inTurnOrder = [...teamIds.slice(current + 1), ...teamIds.slice(0, current + 1)];
  return inTurnOrder.find((teamId) => playable.has(teamId));
}

async function freshDeck(game) {
  try {
    requireCatalogConnection();
    return await wordService.buildWordDeck(game);
  } catch (err) {
    if (err.message.startsWith('No words match') || err.message.startsWith('No prompts match')) {
      throw new RequestError(err.message, 'EMPTY_WORD_DECK');
    }
    throw err;
  }
}

async function advanceRound(game) {
  const teamId = nextTeamId(game);
  if (!teamId) {
    archiveMatch(game, 'not_enough_players');
    resetMatch(game);
    return 'At least one team needs two connected players to continue.';
  }

  let deck;
  try {
    deck = await freshDeck(game);
  } catch (err) {
    if (err.code !== 'EMPTY_WORD_DECK') throw err;
    archiveMatch(game, 'catalog_unavailable');
    resetMatch(game);
    return err.message;
  }

  const used = game.words.slice(0, game.wordCursor);
  const usedWords = new Set(used.map((word) => word.toLowerCase()));
  const unused = deck.find((word) => !usedWords.has(word.toLowerCase()));
  const word = unused || deck[0];
  game.words = unused ? [...used, word] : [word];

  const players = getPlayablePlayers(game, teamId);
  const cursor = game.teamActorCursor[teamId] || 0;
  const actorId = players[cursor % players.length];
  game.teamActorCursor[teamId] = (cursor + 1) % players.length;
  const now = Date.now();
  Object.assign(game, {
    status: 'playing',
    currentRound: game.currentRound + 1,
    roundId: crypto.randomUUID(),
    roundStartedAt: now,
    roundEndsAt: now + game.roundTime * 1000,
    nextRoundAt: null,
    currentTeam: teamId,
    currentActorId: actorId,
    currentWord: word,
    timeLeft: game.roundTime,
    winner: null,
    wordCursor: game.words.length,
    recentGuesses: [],
    lastRound: null,
    recoveryUntil: null
  });
  for (const player of Object.values(game.players)) player.isActor = player.id === actorId;
  return null;
}

function endRound(game, reason, guess) {
  const now = Date.now();
  const winner = guess && game.teams[game.currentTeam].score >= game.targetScore ? game.currentTeam : null;
  game.lastRound = {
    reason,
    word: game.currentWord,
    actorId: game.currentActorId,
    actorName: game.players[game.currentActorId]?.username || null,
    score: guess?.score || 0,
    guessingPlayerName: guess?.username || null
  };
  game.roundHistory = [...game.roundHistory, {
    ...game.lastRound,
    matchId: game.matchId,
    roundId: game.roundId,
    roundNumber: game.currentRound,
    teamId: game.currentTeam,
    startedAt: game.roundStartedAt,
    endedAt: now
  }].slice(-ROUND_HISTORY_LIMIT);
  Object.assign(game, {
    status: winner ? 'finished' : 'round_end',
    roundEndsAt: null,
    nextRoundAt: winner ? null : now + ROUND_BREAK_MS,
    currentActorId: null,
    currentWord: null,
    timeLeft: 0,
    winner,
    recoveryUntil: null
  });
  for (const player of Object.values(game.players)) player.isActor = false;
  if (winner) archiveMatch(game, 'completed');
}

function readyToRecover(game) {
  if (game.status === 'playing') {
    return game.players[game.currentActorId]?.connected && getPlayablePlayers(game, game.currentTeam).length >= 2;
  }
  return playableTeamIds(game).length > 0;
}

function scheduleRound(game, minDelay = 0) {
  clearTimeout(roundTimers.get(game.id));
  roundTimers.delete(game.id);
  if (hosted || shuttingDown || game.closedAt || (game.status !== 'playing' && game.status !== 'round_end')) return;

  const now = Date.now();
  let delay;
  if (game.recoveryUntil && !readyToRecover(game)) {
    delay = game.recoveryUntil - now;
  } else if (game.status === 'playing') {
    const remaining = game.roundEndsAt - now;
    delay = remaining <= 0 ? 0 : remaining % 1000 || 1000;
  } else {
    delay = game.nextRoundAt - now;
  }

  const timer = setTimeout(() => {
    if (roundTimers.get(game.id) !== timer) return;
    roundTimers.delete(game.id);
    queueGameAction(game.id, async () => {
      if (games.get(game.id) !== game) return;
      const now = Date.now();
      const recovering = game.recoveryUntil && !readyToRecover(game);
      if (recovering && game.recoveryUntil > now) {
        scheduleRound(game);
        return;
      }
      if (game.status === 'playing' && !recovering && game.roundEndsAt > now) {
        emitGameState(game);
        scheduleRound(game);
        return;
      }

      const next = structuredClone(game);
      if (next.status === 'playing') {
        endRound(next, recovering ? 'player_left' : 'timeout');
        await commitGame(next);
        return;
      }

      const message = await advanceRound(next);
      await commitGame(next);
      if (message) emitToHost(next, 'gameError', { message });
    }).catch((err) => {
      console.error('Could not advance the game:', err.message);
      if (games.get(game.id) === game) scheduleRound(game, 1000);
    });
  }, Math.max(minDelay, delay));
  roundTimers.set(game.id, timer);
}

function emitToHost(game, event, payload) {
  const socketId = game.players[game.hostId]?.socketId;
  if (socketId) io.to(socketId).emit(event, payload);
}

function assignHost(game, player) {
  game.hostId = player?.id || null;
  game.hostName = player?.username || 'Host';
  for (const candidate of Object.values(game.players)) candidate.isHost = candidate.id === game.hostId;
}

function closeGame(game, reason) {
  if (game.status === 'playing') endRound(game, reason);
  if (game.status === 'round_end') game.status = 'finished';
  archiveMatch(game, reason);
  game.nextRoundAt = null;
  game.closedAt = new Date();
  for (const player of Object.values(game.players)) {
    player.connected = false;
    player.socketId = null;
  }
}

function removePlayer(game, playerId, reason) {
  const player = game.players[playerId];
  player.connected = false;
  if (Object.keys(game.players).length === 1) {
    // Keep the archived room, including the outcome, when its last player leaves.
    closeGame(game, reason);
    return;
  }

  const actingTeamCanPlay = getPlayablePlayers(game, game.currentTeam).length >= 2;
  if (game.status === 'playing' && !game.recoveryUntil && (playerId === game.currentActorId || !actingTeamCanPlay)) {
    endRound(game, reason);
  }

  const team = game.teams[player.teamId];
  team.players = team.players.filter((id) => id !== playerId);
  delete game.players[playerId];

  if (game.hostId === playerId) {
    const remaining = Object.values(game.players);
    assignHost(game, remaining.find((candidate) => candidate.connected) || remaining[0]);
  }
}

function disconnectKey(gameId, playerId) {
  return `${gameId}:${playerId}`;
}

function clearDisconnect(gameId, playerId) {
  const key = disconnectKey(gameId, playerId);
  clearTimeout(disconnectTimers.get(key));
  disconnectTimers.delete(key);
}

function scheduleDisconnect(gameId, player, minDelay = 0) {
  clearDisconnect(gameId, player.id);
  if (hosted || shuttingDown) return;
  const key = disconnectKey(gameId, player.id);
  const timer = setTimeout(() => {
    if (disconnectTimers.get(key) !== timer) return;
    disconnectTimers.delete(key);
    queueGameAction(gameId, async () => {
      const game = games.get(gameId);
      const savedPlayer = game?.players[player.id];
      if (!savedPlayer || savedPlayer.connected || savedPlayer.disconnectedAt !== player.disconnectedAt) return;

      const next = structuredClone(game);
      removePlayer(next, player.id, 'player_left');
      await commitGame(next);
    }).catch((err) => {
      console.error('Could not remove disconnected player:', err.message);
      const current = games.get(gameId)?.players[player.id];
      if (current && !current.connected) scheduleDisconnect(gameId, current, 1000);
    });
  }, Math.max(minDelay, player.disconnectedAt + DISCONNECT_GRACE_MS - Date.now()));
  disconnectTimers.set(key, timer);
}

function findPlayer(game, socket) {
  return Object.values(game.players).find((player) => player.connected && player.socketId === socket.id);
}

function requireHost(game, socket, message) {
  if (!game.hostId || findPlayer(game, socket)?.id !== game.hostId) throw new RequestError(message);
}

function applySettings(game, config) {
  for (const team of Object.values(game.teams)) {
    if (team.players.length && Number(team.id.slice(4)) > config.teamCount) {
      throw new RequestError('You cannot remove a team that already has players in it.');
    }
    if (team.players.length > config.playersPerTeam) {
      throw new RequestError('The maximum team size cannot be smaller than the biggest team.');
    }
  }

  game.teams = Object.fromEntries(Object.entries(buildTeams(config.teamCount)).map(
    ([id, team]) => [id, game.teams[id] || team]
  ));
  Object.assign(game, config);
}

function assignSession(socket, gameId) {
  socket.data.gameId = gameId;
  if (!socket.connected) disconnectPlayer(socket);
}

function releaseSession(socketId, gameId, reason) {
  const socket = io.sockets.sockets.get(socketId);
  if (!socket || socket.data.gameId !== gameId) return;

  delete socket.data.gameId;
  if (reason) socket.emit('sessionRemoved', { gameId, reason });
}

function verifySessionTarget(socket, gameId) {
  if (socket.data.gameId && socket.data.gameId !== gameId) {
    throw new RequestError('Leave your current game before joining another.');
  }
}

async function openSession(socket, operation) {
  if (socket.data.openingSession) throw new RequestError('Wait for your current request to finish.');
  socket.data.openingSession = true;
  try {
    return await operation();
  } finally {
    delete socket.data.openingSession;
  }
}

function disconnectPlayer(socket) {
  const gameId = socket.data.gameId;
  if (!gameId || shuttingDown) return;

  queueGameAction(gameId, async () => {
    const game = hosted ? await loadGame(gameId) : games.get(gameId);
    const player = game && findPlayer(game, socket);
    if (!player) return;

    const next = structuredClone(game);
    Object.assign(next.players[player.id], { connected: false, socketId: null, disconnectedAt: Date.now() });
    await commitGame(next);
    scheduleDisconnect(gameId, next.players[player.id]);
  }).catch((err) => {
    console.error('Could not record disconnect:', err.message);
    if (!hosted) setTimeout(() => disconnectPlayer(socket), 1000).unref();
  });
}

function getIdentityKey(socket) {
  const forwarded = String(socket.handshake.headers['x-forwarded-for'] || '').split(',');
  const clientIp = proxyHops ? forwarded.at(-proxyHops)?.trim() : null;
  return clientIp || socket.handshake.address || socket.id;
}

function onRequest(socket, event, action, { identity = false, points = 1 } = {}) {
  socket.on(event, async (payload, callback) => {
    const reply = typeof callback === 'function' ? callback : () => {};
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      reply({ error: 'Invalid request.' });
      return;
    }

    const receivedAt = Date.now();
    const limiter = identity ? identityLimiter : actionLimiter;
    try {
      await limiter.consume(`${event}:${identity ? getIdentityKey(socket) : socket.id}`, points);
    } catch {
      reply({ error: 'Too many requests. Please slow down for a moment.', code: 'RATE_LIMITED' });
      return;
    }

    try {
      for (let attempt = 0; ; attempt += 1) {
        try {
          reply(await action(payload, receivedAt));
          break;
        } catch (err) {
          if (!hosted || err.code !== 'GAME_CONFLICT' || attempt >= 4) throw err;
        }
      }
    } catch (err) {
      if (err instanceof RequestError || err.code === 'GAME_CONFLICT') {
        reply({ error: err.message, code: err.code });
        return;
      }
      console.error(`Could not handle ${event}:`, err.message);
      reply({ error: 'The request could not be completed. Please try again.' });
    }
  });
}

async function testAdmin(data) {
  const session = typeof data.testAdminToken === 'string'
    ? await adminService.authenticate(data.testAdminToken)
    : null;
  if (!session) throw new RequestError('Sign in as an admin to use the test room.', 'TEST_AUTH_REQUIRED');
  return session.admin.id;
}

async function authorizeRoom(game, data) {
  if (game.testOwner) {
    if (data.testRoom !== true || await testAdmin(data) !== game.testOwner) throw new RequestError('Game not found.');
  } else if (data.testRoom) {
    throw new RequestError('Open a room from the admin testing workspace.');
  }
}

function onGameRequest(socket, event, action, { restore = false, ...options } = {}) {
  onRequest(socket, event, (payload, receivedAt) => {
    const gameId = normalizeGameId(payload.gameId);
    return queueGameAction(gameId, async () => {
      const game = (hosted || restore) ? await loadGame(gameId) : games.get(gameId);
      if (!game || (game.testExpiresAt && Number(game.testExpiresAt) <= Date.now())) throw new RequestError('Game not found.');
      await authorizeRoom(game, payload);
      return action(game, payload, receivedAt);
    });
  }, options);
}

io.on('connection', (socket) => {
  onRequest(socket, 'createGame', (data) => openSession(socket, async () => {
    verifySessionTarget(socket, null);
    const config = normalizeConfig(data);
    const testOwner = data.testRoom === true ? await testAdmin(data) : undefined;
    if (testOwner) config.visibility = 'private';
    const teamId = cleanTeamId(data.teamId || 'team1', config.teamCount);
    await freshDeck(config);

    const game = {
      ...config,
      ...(testOwner ? { testOwner, testExpiresAt: new Date(Date.now() + TEST_ROOM_DURATION_MS) } : {}),
      id: null,
      hostId: null,
      hostName: 'Host',
      players: {},
      teams: buildTeams(config.teamCount),
      bannedPlayers: [],
      closedAt: null,
      roundHistory: [],
      matchHistory: []
    };
    resetMatch(game);

    const { id, sessionToken } = addPlayer(game, {
      playerId: data.playerId,
      username: cleanName(data.username) || 'Host',
      teamId
    }, socket, true);

    for (let attempts = 0; attempts < 4; attempts += 1) {
      game.id = createCode();
      if (games.has(game.id)) continue;
      try {
        await commitGame(game, { create: true });
        assignSession(socket, game.id);
        return { ...serializeGame(game, id), sessionToken };
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
    throw new RequestError('Could not create a game code. Please try again.');
  }), { identity: true, points: 5 });

  onRequest(socket, 'listPublicGames', async () => ({ games: await listPublicGames() }));
  onRequest(socket, 'getWordCatalog', () => getCatalogSummary());
  onGameRequest(socket, 'getGameInfo', (game) => serializePreview(game), { identity: true, restore: true });

  onGameRequest(socket, 'joinGame', (game, data) => openSession(socket, async () => {
    verifySessionTarget(socket, game.id);
    if (findPlayer(game, socket)) throw new RequestError('You already belong to this game.');
    if (game.status !== 'lobby') throw new RequestError('This game has already started.');

    const username = cleanName(data.username);
    if (!username) throw new RequestError('Please enter a player name.');

    const teamId = cleanTeamId(data.teamId || 'team1', game.teamCount);
    if (game.teams[teamId].players.length >= game.playersPerTeam) {
      throw new RequestError(`${game.teams[teamId].name} is full.`);
    }

    const playerId = cleanPlayerId(data.playerId);
    const lowerName = username.toLowerCase();
    if (game.bannedPlayers.some((entry) => entry.playerId === playerId || entry.username === lowerName)) {
      throw new RequestError('You were banned from this lobby.');
    }
    if (Object.values(game.players).some((player) => player.username.toLowerCase() === lowerName)) {
      throw new RequestError('That player name is already taken.');
    }

    const next = structuredClone(game);
    const { id, sessionToken } = addPlayer(next, { username, playerId, teamId }, socket, !game.hostId);
    await commitGame(next);
    assignSession(socket, game.id);
    return { ...serializeGame(next, id), sessionToken };
  }), { identity: true, restore: true });

  onRequest(socket, 'resumeSession', (data) => openSession(socket, async () => {
    const invalid = () => new RequestError('Game session not found.', 'SESSION_NOT_FOUND');
    const id = cleanPlayerId(data.playerId);
    if (!id || typeof data.sessionToken !== 'string' || !/^[\da-f]{64}$/.test(data.sessionToken)) throw invalid();
    const gameId = normalizeGameId(data.gameId);
    verifySessionTarget(socket, gameId);

    return queueGameAction(gameId, async () => {
      const game = await loadGame(gameId);
      const player = game?.players[id];
      if (!canResume(player, data.sessionToken)) throw invalid();
      await authorizeRoom(game, data);
      const boundPlayer = findPlayer(game, socket);
      if (boundPlayer && boundPlayer.id !== id) throw invalid();

      const previousSocketId = player.socketId;
      const next = structuredClone(game);
      Object.assign(next.players[id], { connected: true, socketId: socket.id, lastSeen: Date.now(), disconnectedAt: null });
      if (next.recoveryUntil && readyToRecover(next)) next.recoveryUntil = null;
      await commitGame(next);
      clearDisconnect(gameId, id);
      if (previousSocketId !== socket.id) releaseSession(previousSocketId, gameId, 'replaced');
      assignSession(socket, gameId);
      return { ...serializeGame(next, id), sessionToken: data.sessionToken };
    });
  }), { identity: true });

  onGameRequest(socket, 'movePlayer', async (game, data) => {
    requireHost(game, socket, 'Only the host can move players.');
    if (game.status !== 'lobby') throw new RequestError('Players can only change teams in the lobby.');

    const playerId = cleanPlayerId(data.playerId);
    const player = game.players[playerId];
    if (!player) throw new RequestError('Player not found.');

    const teamId = cleanTeamId(data.teamId, game.teamCount);
    if (player.teamId === teamId) return { ok: true };
    if (game.teams[teamId].players.length >= game.playersPerTeam) throw new RequestError('That team is full.');

    const next = structuredClone(game);
    const oldTeam = next.teams[player.teamId];
    oldTeam.players = oldTeam.players.filter((id) => id !== playerId);
    next.teams[teamId].players.push(playerId);
    next.players[playerId].teamId = teamId;
    await commitGame(next);
    return { ok: true };
  });

  onGameRequest(socket, 'transferHost', async (game, data) => {
    requireHost(game, socket, 'Only the host can transfer ownership.');
    const player = game.players[cleanPlayerId(data.playerId)];
    if (!player?.connected) throw new RequestError('Select a connected player.');
    if (player.id === game.hostId) return { ok: true };

    const next = structuredClone(game);
    assignHost(next, next.players[player.id]);
    await commitGame(next);
    return { ok: true };
  });

  onGameRequest(socket, 'leaveGame', async (game) => {
    const player = findPlayer(game, socket);
    if (!player) throw new RequestError('You are not in this game.');

    const next = structuredClone(game);
    removePlayer(next, player.id, 'player_left');
    await commitGame(next);
    clearDisconnect(game.id, player.id);
    releaseSession(socket.id, game.id);
    return { ok: true };
  });

  onGameRequest(socket, 'updateGameSettings', async (game, { settings }) => {
    requireHost(game, socket, 'Only the host can edit the game settings.');
    if (game.status !== 'lobby' && game.status !== 'finished') {
      throw new RequestError('You can only edit settings between sessions.');
    }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new RequestError('Enter valid game settings.');
    }

    const next = structuredClone(game);
    applySettings(next, normalizeConfig({ ...game, ...settings, ...(game.testOwner ? { visibility: 'private' } : {}) }));
    await freshDeck(next);
    resetMatch(next);
    await commitGame(next);
    return { ok: true, snapshot: serializeGame(next, next.hostId) };
  });

  onGameRequest(socket, 'returnToLobby', async (game) => {
    requireHost(game, socket, 'Only the host can return the game to the lobby.');
    const next = structuredClone(game);
    if (next.status === 'playing') endRound(next, 'returned_to_lobby');
    archiveMatch(next, 'returned_to_lobby');
    resetMatch(next);
    await commitGame(next);
    return { ok: true };
  });

  onGameRequest(socket, 'kickPlayer', async (game, data) => {
    requireHost(game, socket, 'Only the host can moderate players.');
    const target = game.players[cleanPlayerId(data.playerId)];
    if (!target || target.id === game.hostId) throw new RequestError('The host cannot remove this player.');

    const next = structuredClone(game);
    const ban = data.ban === true;
    if (ban) {
      next.bannedPlayers.push({
        playerId: target.id,
        username: target.username.toLowerCase(),
        reason: 'host_ban',
        bannedAt: new Date()
      });
    }
    removePlayer(next, target.id, 'player_left');
    await commitGame(next);
    clearDisconnect(game.id, target.id);
    releaseSession(target.socketId, game.id, ban ? 'banned' : 'kicked');
    return { ok: true };
  });

  onGameRequest(socket, 'endGameConfirm', async (game) => {
    requireHost(game, socket, 'Only the host can close the game.');
    const next = structuredClone(game);
    closeGame(next, 'closed');
    await commitGame(next);
    for (const player of Object.values(game.players)) {
      clearDisconnect(game.id, player.id);
      releaseSession(player.socketId, game.id, player.socketId === socket.id ? null : 'closed');
    }
    return { ok: true };
  });

  onGameRequest(socket, 'startGame', async (game) => {
    requireHost(game, socket, 'Only the host can start the game.');
    if (game.status !== 'lobby' && game.status !== 'finished') throw new RequestError('A game is already in progress.');
    if (playableTeamIds(game).length < 2) {
      throw new RequestError('At least two teams need two or more players before the game can start.');
    }

    const next = structuredClone(game);
    resetMatch(next);
    next.matchId = crypto.randomUUID();
    next.matchStartedAt = Date.now();
    const message = await advanceRound(next);
    if (message) throw new RequestError(message);
    await commitGame(next);
    return { ok: true };
  });

  onGameRequest(socket, 'submitGuess', async (game, data, receivedAt) => {
    if (game.status !== 'playing' || receivedAt >= game.roundEndsAt || (data.roundId && data.roundId !== game.roundId)) {
      throw new RequestError('That round has ended.', 'ROUND_ENDED');
    }
    if (game.recoveryUntil) throw new RequestError('Waiting for the acting team to reconnect.');

    const player = findPlayer(game, socket);
    if (!player) throw new RequestError('You are not part of this game.');
    if (player.teamId !== game.currentTeam || player.id === game.currentActorId) {
      throw new RequestError('Only the guessing players on the acting team can submit guesses.');
    }

    const guess = typeof data.guess === 'string' ? data.guess.trim() : '';
    if (!guess || guess.length > 120) throw new RequestError('Enter a guess of 1 to 120 characters.');

    const next = structuredClone(game);
    const score = gameService.calculateScore(guess, next.currentWord);
    const entry = { id: crypto.randomUUID(), guess, playerId: player.id, username: player.username, teamId: player.teamId, score };
    next.recentGuesses = [entry, ...next.recentGuesses].slice(0, 8);

    if (score > 0) {
      next.teams[player.teamId].score += score;
      endRound(next, 'guessed', entry);
    }
    await commitGame(next);
    return { ok: true, score };
  });

  if (hosted) {
    const interval = setInterval(() => syncSocket(socket), SYNC_INTERVAL_MS);
    socket.once('disconnect', () => clearInterval(interval));
  }
  socket.on('disconnect', () => disconnectPlayer(socket));
});

async function syncSocket(socket) {
  const gameId = socket.data.gameId;
  if (!gameId || socket.data.syncing) return;
  socket.data.syncing = true;
  try {
    await queueGameAction(gameId, async () => {
      if (!socket.connected || socket.data.gameId !== gameId) return;
      const game = await loadGame(gameId);
      if (!socket.connected || socket.data.gameId !== gameId) return;
      const player = game && findPlayer(game, socket);
      if (!player) {
        releaseSession(socket.id, gameId, game ? 'removed' : 'closed');
        return;
      }

      const now = Date.now();
      const next = structuredClone(game);
      let changed = false;
      if (now - (player.lastSeen || 0) >= PRESENCE_INTERVAL_MS) {
        next.players[player.id].lastSeen = now;
        changed = true;
      }
      for (const entry of Object.values(next.players)) {
        if (entry.id === player.id) continue;
        const expired = entry.connected
          ? now - (entry.lastSeen || 0) > PRESENCE_TIMEOUT_MS
          : now - (entry.disconnectedAt || 0) > DISCONNECT_GRACE_MS;
        if (expired) {
          removePlayer(next, entry.id, 'player_left');
          changed = true;
        }
      }

      if (next.status === 'playing' && next.roundEndsAt <= now) {
        endRound(next, 'timeout');
        changed = true;
      } else if (next.status === 'round_end' && next.nextRoundAt <= now) {
        const message = await advanceRound(next);
        if (message) emitToHost(next, 'gameError', { message });
        changed = true;
      }

      if (changed) await commitGame(next);
      else socket.emit('gameState', serializeGame(game, player.id));
    });
  } catch (err) {
    if (err.code !== 'GAME_CONFLICT') console.error('Could not sync game:', err.name);
  } finally {
    delete socket.data.syncing;
  }
}

async function initialize() {
  dbConnected = await connectDB();
  if (!dbConnected && requireDatabase) throw new Error('MongoDB is required for this environment.');
  if (!dbConnected) return;
  await gameService.init();
  await wordService.ensureCatalogSeeded();
  await adminService.seedHeadAdmin();
}

async function start() {
  const port = Number(process.env.PORT || process.env.BACKEND_PORT || 4001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('The game server port is invalid.');

  await initialize();

  server.listen(port, () => {
    console.log(`Game server listening on port ${port}`);
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const timer of [...roundTimers.values(), ...disconnectTimers.values()]) clearTimeout(timer);
  setTimeout(() => process.exit(0), 5000).unref();
  io.close(async () => {
    await Promise.allSettled(gameActions.values());
    if (dbConnected) await disconnectDB();
    process.exit(0);
  });
}

if (hosted) {
  module.exports = { server, initialize };
} else {
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  start().catch((err) => {
    console.error('Game server could not start:', err.message);
    process.exit(1);
  });
}
