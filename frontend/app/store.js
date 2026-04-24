'use client';

import { create } from 'zustand';
import { io } from 'socket.io-client';

const PLAYER_ID_KEY = 'guess_game_player_id';
const GAME_ID_KEY = 'guess_game_game_id';
// Backend URL for Socket.IO connection
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001';

const socket = io(BACKEND_URL, {
  reconnection: true
});

function emitWithAck(socketInstance, event, payload, timeout = 5000) {
  return new Promise((resolve, reject) => {
    socketInstance.timeout(timeout).emit(event, payload, (err, response) => {
      if (err) {
        reject(new Error(`${event} request timed out or failed`));
        return;
      }

      resolve(response);
    });
  });
}

function normalizeSnapshot(snapshot, state, overrides = {}) {
  const selfId = snapshot?.selfId ?? overrides.currentPlayerId ?? state.currentPlayerId ?? null;
  const selfPlayer = selfId ? snapshot?.players?.[selfId] : null;

  return {
    game: snapshot,
    players: snapshot?.players || {},
    teams: snapshot?.teams || {},
    status: snapshot?.status || 'home',
    gameId: snapshot?.id || snapshot?.gameId || null,
    currentPlayerId: selfId,
    username: overrides.username ?? selfPlayer?.username ?? state.username,
    teamId: overrides.teamId ?? selfPlayer?.teamId ?? state.teamId,
    isHost: overrides.isHost ?? Boolean(selfId && snapshot?.hostId === selfId),
    winner: snapshot?.winner || null,
    timeLeft: snapshot?.timeLeft ?? 0,
    lastError: overrides.lastError ?? null
  };
}

function readStoredValue(key) {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(key);
}

function writeStoredValue(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  if (value) {
    window.sessionStorage.setItem(key, value);
  } else {
    window.sessionStorage.removeItem(key);
  }
}

function ensurePlayerId() {
  const existing = readStoredValue(PLAYER_ID_KEY);
  if (existing) {
    return existing;
  }

  const nextId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `player_${Math.random().toString(36).slice(2)}${Date.now()}`;

  writeStoredValue(PLAYER_ID_KEY, nextId);
  return nextId;
}

function persistSession(gameId, playerId) {
  writeStoredValue(GAME_ID_KEY, gameId);
  writeStoredValue(PLAYER_ID_KEY, playerId);
}

function clearStoredSession() {
  writeStoredValue(GAME_ID_KEY, null);
  writeStoredValue(PLAYER_ID_KEY, null);
}

function emptyState() {
  return {
    game: null,
    players: {},
    teams: {},
    status: 'home',
    gameId: null,
    currentPlayerId: null,
    username: '',
    teamId: '',
    isHost: false,
    winner: null,
    timeLeft: 0,
    lastError: null,
    gamePreview: null,
    wordCatalog: null,
    publicGames: []
  };
}

export const useGameStore = create((set, get) => ({
  ...emptyState(),

  socket,

  createGame: async (config, username, teamId) => {
    const { socket: currentSocket } = get();
    const playerId = ensurePlayerId();
    try {
      const snapshot = await emitWithAck(currentSocket, 'createGame', {
        ...config,
        username,
        teamId,
        playerId
      });

      if (snapshot?.error) {
        throw new Error(snapshot.error);
      }

      persistSession(snapshot.id || snapshot.gameId, snapshot.selfId || playerId);
      set((state) => ({
        ...normalizeSnapshot(snapshot, state, { username, teamId }),
        gamePreview: null,
        lastError: null
      }));

      return snapshot;
    } catch (error) {
      set({ lastError: error.message });
      throw error;
    }
  },

  fetchGamePreview: async (gameId) => {
    const { socket: currentSocket } = get();
    try {
      const response = await emitWithAck(currentSocket, 'getGameInfo', { gameId });
      if (response?.error) {
        throw new Error(response.error);
      }

      set({ gamePreview: response, lastError: null });
      return response;
    } catch (error) {
      set({ gamePreview: null, lastError: error.message });
      throw error;
    }
  },

  fetchPublicGames: async () => {
    const { socket: currentSocket } = get();
    try {
      const response = await emitWithAck(currentSocket, 'listPublicGames', {});
      if (response?.error) {
        throw new Error(response.error);
      }

      set({ publicGames: response?.games || [], lastError: null });
      return response?.games || [];
    } catch (error) {
      set({ publicGames: [], lastError: error.message });
      throw error;
    }
  },

  fetchWordCatalog: async () => {
    const { socket: currentSocket } = get();
    try {
      const response = await emitWithAck(currentSocket, 'getWordCatalog', {});
      if (response?.error) {
        throw new Error(response.error);
      }

      set({ wordCatalog: response, lastError: null });
      return response;
    } catch (error) {
      set({ wordCatalog: null, lastError: error.message });
      throw error;
    }
  },

  joinGame: async (gameId, username, teamId) => {
    const { socket: currentSocket } = get();
    const playerId = ensurePlayerId();
    try {
      const response = await emitWithAck(currentSocket, 'joinGame', { gameId, username, teamId, playerId });
      if (response?.error) {
        throw new Error(response.error);
      }

      persistSession(response.id || response.gameId, response.selfId || playerId);
      set((state) => ({
        ...normalizeSnapshot(response, state, { username, teamId }),
        gamePreview: null,
        lastError: null
      }));

      return response;
    } catch (error) {
      set({ lastError: error.message });
      throw error;
    }
  },

  startGame: async (gameId) => {
    const { socket: currentSocket } = get();
    try {
      const response = await emitWithAck(currentSocket, 'startGame', { gameId });
      if (response?.error) {
        throw new Error(response.error);
      }

      set({ lastError: null });
      return response;
    } catch (error) {
      set({ lastError: error.message });
      throw error;
    }
  },

  submitGuess: async (gameId, guess) => {
    const { socket: currentSocket } = get();
    try {
      const response = await emitWithAck(currentSocket, 'submitGuess', { gameId, guess });
      if (response?.error) {
        throw new Error(response.error);
      }

      set({ lastError: null });
      return response;
    } catch (error) {
      set({ lastError: error.message });
      throw error;
    }
  },

  updateGameSettings: async (gameId, settings) => {
    const { socket: currentSocket } = get();
    try {
      const response = await emitWithAck(currentSocket, 'updateGameSettings', { gameId, settings });
      if (response?.error) {
        throw new Error(response.error);
      }

      set({ lastError: null });
      return response;
    } catch (error) {
      set({ lastError: error.message });
      throw error;
    }
  },

  addWord: async (payload) => {
    const { socket: currentSocket } = get();
    try {
      const response = await emitWithAck(currentSocket, 'addWord', payload);
      if (response?.error) {
        throw new Error(response.error);
      }

      set({ wordCatalog: response.catalog || get().wordCatalog, lastError: null });
      return response;
    } catch (error) {
      set({ lastError: error.message });
      throw error;
    }
  },

  kickPlayer: async (gameId, playerId, ban = false) => {
    const { socket: currentSocket } = get();
    try {
      const response = await emitWithAck(currentSocket, 'kickPlayer', { gameId, playerId, ban });
      if (response?.error) {
        throw new Error(response.error);
      }

      set({ lastError: null });
      return response;
    } catch (error) {
      set({ lastError: error.message });
      throw error;
    }
  },

  returnToLobby: async (gameId) => {
    const { socket: currentSocket } = get();
    try {
      const response = await emitWithAck(currentSocket, 'returnToLobby', { gameId });
      if (response?.error) {
        throw new Error(response.error);
      }

      set({ lastError: null });
      return response;
    } catch (error) {
      set({ lastError: error.message });
      throw error;
    }
  },

  clearError: () => set({ lastError: null }),

  resetGame: ({ cleanupRemote = false } = {}) => {
    const { socket: currentSocket, gameId, isHost } = get();
    if (cleanupRemote && gameId && isHost) {
      currentSocket.emit('endGameConfirm', { gameId });
    }

    clearStoredSession();
    set(emptyState());
  },

  initListeners: () => {
    const { socket: currentSocket } = get();

    currentSocket.off('gameState');
    currentSocket.off('gameError');
    currentSocket.off('connect');
    currentSocket.off('sessionRemoved');

    currentSocket.on('gameState', (snapshot) => {
      persistSession(snapshot.id || snapshot.gameId, snapshot.selfId || get().currentPlayerId);
      set((state) => normalizeSnapshot(snapshot, state));
    });

    currentSocket.on('gameError', (payload) => {
      set({ lastError: payload?.message || 'Something went wrong.' });
    });

    currentSocket.on('sessionRemoved', (payload) => {
      clearStoredSession();
      set({
        ...emptyState(),
        lastError: payload?.reason === 'banned'
          ? 'You were banned from that lobby.'
          : 'You were removed from that lobby.'
      });
    });

    const attemptResume = async () => {
      const gameId = readStoredValue(GAME_ID_KEY);
      const playerId = readStoredValue(PLAYER_ID_KEY);

      if (!gameId || !playerId) {
        return;
      }

      try {
        const snapshot = await emitWithAck(currentSocket, 'resumeSession', { gameId, playerId }, 4000);
        if (snapshot?.error) {
          if (snapshot.error === 'Game session not found.') {
            clearStoredSession();
            set(emptyState());
          } else {
            set({ lastError: snapshot.error });
          }
          return;
        }

        persistSession(snapshot.id || snapshot.gameId, snapshot.selfId || playerId);
        set((state) => ({
          ...normalizeSnapshot(snapshot, state),
          lastError: null
        }));
      } catch (error) {
        set({ lastError: error.message });
      }
    };

    // If already connected (e.g. page refresh), resume immediately
    if (currentSocket.connected) {
      attemptResume();
    }

    // Also handle future reconnections
    currentSocket.on('connect', attemptResume);
  }
}));

