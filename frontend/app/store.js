'use client';

import { create } from 'zustand';
import { io } from 'socket.io-client';

const PLAYER_ID_KEY = 'guess_game_player_id';
const GAME_ID_KEY = 'guess_game_game_id';
const SESSION_TOKEN_KEY = 'guess_game_session_token';
const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001').replace(/\/$/, '');
const socket = io(BACKEND_URL, { autoConnect: false });
const memoryStorage = new Map();

export const ROOM_CODE_LENGTH = 6;

export function normalizeRoomCode(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}

function emitWithAck(event, payload, timeout = 8000) {
  if (!socket.connected) {
    return Promise.reject(new Error('The game server is reconnecting. Try again in a moment.'));
  }

  return new Promise((resolve, reject) => {
    socket.timeout(timeout).emit(event, payload, (error, response) => {
      if (error) {
        reject(new Error('The game server did not respond. Try again in a moment.'));
      } else if (!response || typeof response !== 'object') {
        reject(new Error('The game server returned an invalid response.'));
      } else if (response.error) {
        reject(Object.assign(new Error(response.error), { code: response.code }));
      } else {
        resolve(response);
      }
    });
  });
}

async function fetchApi(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('The game server is unavailable.');
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function readStoredValue(key) {
  if (typeof window === 'undefined') return null;
  if (memoryStorage.has(key)) return memoryStorage.get(key);
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key, value) {
  if (typeof window === 'undefined') return;

  memoryStorage.set(key, value || null);

  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Gameplay can continue for this page when session storage is blocked.
  }
}

function readSession() {
  return {
    gameId: readStoredValue(GAME_ID_KEY),
    playerId: readStoredValue(PLAYER_ID_KEY),
    sessionToken: readStoredValue(SESSION_TOKEN_KEY)
  };
}

function ensurePlayerId() {
  const existing = readStoredValue(PLAYER_ID_KEY);
  if (existing) return existing;

  const nextId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `player_${Math.random().toString(36).slice(2)}${Date.now()}`;
  writeStoredValue(PLAYER_ID_KEY, nextId);
  return nextId;
}

function clearStoredSession() {
  writeStoredValue(GAME_ID_KEY, null);
  writeStoredValue(PLAYER_ID_KEY, null);
  writeStoredValue(SESSION_TOKEN_KEY, null);
}

const emptyGame = {
  game: null,
  players: {},
  teams: {},
  status: 'home',
  gameId: null,
  currentPlayerId: null,
  isHost: false,
  winner: null,
  lastError: null
};

function gameState({ sessionToken, ...game }) {
  return {
    game,
    players: game.players || {},
    teams: game.teams || {},
    status: game.status,
    gameId: game.id || game.gameId,
    currentPlayerId: game.selfId,
    isHost: game.isHost ?? (game.hostId === game.selfId),
    winner: game.winner || null
  };
}

export const useGameStore = create((set, get) => {
  let catalogRequest;
  let catalogInvalidated = false;
  let lobbyRequest = 0;
  let initialized = false;

  function acceptSession(snapshot, playerId) {
    const next = gameState(snapshot);
    writeStoredValue(GAME_ID_KEY, next.gameId);
    writeStoredValue(PLAYER_ID_KEY, next.currentPlayerId || playerId);
    if (snapshot.sessionToken) writeStoredValue(SESSION_TOKEN_KEY, snapshot.sessionToken);
    set({ ...next, lastError: null, sessionStatus: 'ready' });
  }

  async function command(event, payload) {
    try {
      if (get().sessionStatus !== 'ready') throw new Error('Please wait while we restore your game session.');
      set({ lastError: null });
      const response = await emitWithAck(event, payload);
      set({ lastError: null });
      return response;
    } catch (error) {
      set({ lastError: error.message });
      throw error;
    }
  }

  async function resumeSession() {
    const session = readSession();
    if (!session.gameId || !session.playerId) {
      set({ sessionStatus: 'ready' });
      return;
    }

    set({ sessionStatus: 'restoring' });
    const socketId = socket.id;
    const isCurrent = () => {
      const current = readSession();
      return socket.id === socketId && current.gameId === session.gameId && current.playerId === session.playerId;
    };

    try {
      const snapshot = await emitWithAck('resumeSession', session);
      if (isCurrent()) acceptSession(snapshot, session.playerId);
    } catch (error) {
      if (!isCurrent()) return;
      if (error.code === 'SESSION_NOT_FOUND' || error.message === 'Game session not found.') {
        clearStoredSession();
        set({ ...emptyGame, sessionStatus: 'ready', lastError: 'Your previous game session has ended.' });
        return;
      }
      set({ sessionStatus: 'failed', lastError: error.message });
    }
  }

  function fetchWordCatalog({ invalidate = false } = {}) {
    if (catalogRequest) {
      catalogInvalidated ||= invalidate;
      return catalogRequest;
    }

    catalogRequest = (async () => {
      try {
        do {
          catalogInvalidated = false;
          if (!get().wordCatalog) set({ catalogStatus: 'loading' });
          try {
            const wordCatalog = await fetchApi('/api/word-catalog');
            if (!catalogInvalidated) set({ wordCatalog, catalogStatus: 'ready' });
          } catch {
            if (!catalogInvalidated) set({ catalogStatus: 'error' });
          }
        } while (catalogInvalidated);
      } finally {
        catalogRequest = undefined;
      }
    })();

    return catalogRequest;
  }

  return {
    ...emptyGame,
    connectionStatus: 'connecting',
    sessionStatus: 'checking',
    wordCatalog: null,
    catalogStatus: 'idle',
    publicGames: [],
    publicGamesStatus: 'idle',

    createGame: async (config, username, teamId) => {
      const playerId = ensurePlayerId();
      const snapshot = await command('createGame', { ...config, username, teamId, playerId });
      acceptSession(snapshot, playerId);
      return snapshot;
    },

    joinGame: async (gameId, username, teamId) => {
      const playerId = ensurePlayerId();
      const snapshot = await command('joinGame', { gameId, username, teamId, playerId });
      acceptSession(snapshot, playerId);
      return snapshot;
    },

    fetchGamePreview: (gameId) => emitWithAck('getGameInfo', { gameId }),

    fetchPublicGames: async () => {
      const request = ++lobbyRequest;
      set({ publicGamesStatus: 'loading' });
      try {
        const response = await fetchApi('/api/public-games');
        if (request === lobbyRequest) set({ publicGames: response.games || [], publicGamesStatus: 'ready' });
      } catch {
        if (request === lobbyRequest) set({ publicGamesStatus: 'error' });
      }
    },

    fetchWordCatalog,

    startGame: (gameId) => command('startGame', { gameId }),
    submitGuess: (gameId, guess, roundId) => command('submitGuess', { gameId, guess, roundId }),
    updateGameSettings: (gameId, settings) => command('updateGameSettings', { gameId, settings }),
    movePlayer: (gameId, playerId, teamId) => command('movePlayer', { gameId, playerId, teamId }),
    transferHost: (gameId, playerId) => command('transferHost', { gameId, playerId }),
    kickPlayer: (gameId, playerId, ban = false) => command('kickPlayer', { gameId, playerId, ban }),
    returnToLobby: (gameId) => command('returnToLobby', { gameId }),

    leaveGame: async (gameId) => {
      await command('leaveGame', { gameId });
      clearStoredSession();
      set(emptyGame);
    },

    closeGame: async (gameId) => {
      await command('endGameConfirm', { gameId });
      clearStoredSession();
      set(emptyGame);
    },

    clearError: () => set({ lastError: null }),
    resumeSession,

    initListeners: () => {
      if (initialized) return;
      initialized = true;

      const saved = readSession();
      if (saved.gameId && (!saved.playerId || !saved.sessionToken)) {
        clearStoredSession();
        set({ sessionStatus: 'ready', lastError: 'Your previous session has expired. You can rejoin the room if it is open.' });
      } else {
        set({ sessionStatus: saved.gameId ? 'restoring' : 'ready' });
      }

      socket.on('connect', () => {
        set({ connectionStatus: 'online' });
        resumeSession();
        if (get().catalogStatus !== 'idle') fetchWordCatalog({ invalidate: true });
      });
      const onDisconnected = () => {
        set({
          connectionStatus: 'reconnecting',
          sessionStatus: readSession().gameId ? 'restoring' : 'ready'
        });
      };
      socket.on('disconnect', onDisconnected);
      socket.on('connect_error', onDisconnected);

      socket.on('gameState', (snapshot) => {
        const session = readSession();
        if ((snapshot?.id || snapshot?.gameId) !== session.gameId || snapshot?.selfId !== session.playerId) return;
        set(gameState(snapshot));
      });
      socket.on('gameError', (payload) => {
        set({ lastError: payload?.message || 'Something went wrong.' });
      });
      socket.on('sessionRemoved', (payload) => {
        if (!readSession().gameId || (payload?.gameId && payload.gameId !== readSession().gameId)) return;
        clearStoredSession();
        set({
          ...emptyGame,
          sessionStatus: 'ready',
          lastError: {
            banned: 'You were banned from that lobby.',
            closed: 'The host closed the game.',
            replaced: 'Your room was opened in another tab.'
          }[payload?.reason] || 'You were removed from that lobby.'
        });
      });
      socket.on('wordCatalogChanged', () => {
        if (get().catalogStatus !== 'idle') fetchWordCatalog({ invalidate: true });
      });
      socket.connect();
    }
  };
});
