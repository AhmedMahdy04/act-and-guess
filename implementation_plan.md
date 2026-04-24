# Implementation Plan

## Overview
The project is an existing MVP implementation of the \"Real-Time Multiplayer Web Party Game (Act & Guess with Typed Answers)\" using Next.js (frontend), Node.js/Express/Socket.IO (backend), Tailwind CSS, and Zustand for state management. The codebase is well-structured with all core pages (home, create, join, lobby, game, results), components, and backend logic including fuzzy matching, timers, teams, and real-time updates. MongoDB is imported but commented out (in-memory storage used). It's responsive, production-ready UI, but lacks full MongoDB integration, ads, PWA, rate-limiting, and some polish from TODO.md. The task is to read existing files, diagnose why it might not be running (likely missing dependencies/server start), improve overall project per spec (MongoDB, ads, security, production deploy), and complete remaining features while ensuring scalability.

High-level approach: 
1. Fix immediate run issues (install deps, env vars, uncomment Mongo).
2. Complete MongoDB schemas/integration for persistence.
3. Add missing spec features (rate-limiting, ads, QR generation, more words/categories).
4. Polish UI/UX, error handling, PWA.
5. Prepare deployment configs.
6. Test end-to-end.

This fits as MVP upgrade to production-ready app matching the 14-point spec.

## Types
Enhanced TypeScript types (convert JS to TS gradually), MongoDB schemas with validation.

New interfaces/enums:
- Game: { id: string; hostId: string; status: 'lobby' | 'in_progress' | 'finished'; targetScore: number; roundTime: number; currentRound: number; currentTeamId: string; currentActorId: string; scores: Record<string, number>; teams: Record<string, Team>; players: Record<string, Player>; createdAt: Date; }
- Team: { id: string; gameId: string; name: string; score: number; players: string[]; }
- Player: { id: string; gameId: string; username: string; teamId: string; isHost: boolean; isActor: boolean; }
- Guess: { playerId: string; guess: string; score: number; timestamp: Date; }
- Word: { id: string; word: string; category: 'animal' | 'object' | 'food' | 'action'; difficulty: 'easy' | 'medium' | 'hard'; }

Validation: Mongoose schemas with required fields, enums, timestamps. Fuzzy match threshold ≤2 Levenshtein or similarity ≥0.7.

Relationships: Game 1:M Teams, Game 1:M Players, Team M:Players.

## Files
Minor new files, targeted mods to existing, no deletions.

New files:
- backend/models/Game.js, Team.js, Player.js, Word.js, Round.js (Mongoose schemas)
- backend/controllers/gameController.js (business logic separation)
- backend/middleware/rateLimit.js, auth.js
- backend/routes/api/games.js (REST endpoints alongside sockets)
- backend/.env (populate with MONGODB_URI, etc.)
- frontend/public/sw.js, manifest.json (PWA)
- frontend/app/ads/AdBanner.js (ads placeholder)
- frontend/types/game.ts (shared types)
- deployment/vercel.json, railway.json (deploy configs)

Modified existing:
- backend/server.js (uncomment Mongo, add models import, controllers, rate-limit)
- frontend/app/store.js (add error handling, reconnect logic)
- frontend/app/layout.js (add PWA meta)
- frontend/app/globals.css (add ad styles)
- backend/package.json (fix deps: remove fuzzywuzzy→string-similarity, add rate-limiter-flexible)
- frontend/package.json (add react-helmet for meta/PWA)
- README.md, TODO.md (update with completed status, deploy instructions)
- All pages/components (minor: error boundaries, loading states, ad slots)

Config updates: tailwind.config.js (add ad classes), next.config.js (PWA support).

## Functions
Backend-focused mods for persistence/security, frontend socket enhancements.

New functions:
- models/Game.js: createGame(), findById(), updateStatus(), addPlayer(), etc.
- controllers/gameController.js: nextRound(gameId), calculateScore(guess, answer), validateGuess(guess)
- middleware/rateLimit.js: limitGuesses(socketId, max=5/min)
- store.js: reconnectSocket(), handleError(msg), fetchWords()

Modified functions:
- server.js: createGame (→ use Game.create()), joinGame (validate team capacity), submitGuess (rate-limit + Mongo log)
- nextRound(gameId) (persist Round doc)
- calculateScore (use string-similarity lib)
- store.js: initListeners (add 'error' handler), joinGame (team validation)

Removed: None, migrate in-memory to Mongo.

## Classes
No class-based changes (functional code). New Mongoose Schema classes in models/.

New: GameSchema, TeamSchema, etc. (extends mongoose.Schema).

## Dependencies
Backend: Add rate-limiter-flexible@^2.4, string-similarity@^4.0; upgrade mongoose. Remove fuzzywuzzy (Python lib, invalid).
Frontend: Add next-pwa@^5.6 for PWA; google-adsense-loader for ads.

Install: npm i in both dirs.

## Testing
Add e2e tests with Playwright/Cypress. Manual validation: create/join/start rounds, fuzzy guesses, win condition.
Unit: Jest for calculateScore, socket handlers.
New test file: backend/tests/game.test.js (mock sockets/Mongo).

## Implementation Order
1. Install deps, create .env, run servers to fix 'not running'.
2. Create MongoDB models/schemas.
3. Refactor backend/server.js to use models + controllers.
4. Add rate-limiting, error handling.
5. Frontend polish: PWA, ads, more words.
6. Update README/TODO, test full flow.
7. attempt_completion with deploy cmds.

