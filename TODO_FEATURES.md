# New Features Implementation Plan

**Status: ✅ ALL PHASES COMPLETE**

## Features Implemented
1. ✅ Host can move players between teams
2. ✅ Host can transfer host to another player
3. ✅ Player (including host) can leave the game and return to home
4. ✅ Remove "Add Word" option from host lobby
5. ✅ Admin system with protected word/category management
6. ✅ `/admin` dashboard with login/logout + word/category CRUD

## Architecture Decisions
- **Admin routes**: Separate `/admin/login` and `/admin/dashboard` pages
- **Categories**: Dedicated `Category` model (name, description, icon, difficulty, active)
- **Head admin**: Bootstrapped from environment variables after MongoDB connects
- **Leave game**: Player marked `connected=false`, can rejoin via session resume
- **Transfer host**: In lobby. If host disconnects/leaves, host auto-transfers to next available player

---

## Phase 1: Backend Foundation ✅

### 1.1 Dependencies
- `bcryptjs` — password hashing
- MongoDB — expiring, revocable admin sessions

### 1.2 Models Created
- `backend/models/Admin.js` — email, passwordHash, name, role, createdBy, createdAt
- `backend/models/Category.js` — name, description, icon, difficulty, active, createdAt

### 1.3 Head Admin Seeding
- `backend/services/adminService.js` — `seedHeadAdmin()` called on server startup after DB connect
- Set the bootstrap email and a new password as documented in the README.

### 1.4 Admin REST API (`backend/routes/admin.js`)
- POST `/api/admin/login` → expiring session token
- GET `/api/admin/me`
- GET `/api/admin/admins` (head only)
- POST `/api/admin/admins` (head only)
- DELETE `/api/admin/admins/:id` (head only)
- GET `/api/admin/words` (paginated, filterable)
- POST `/api/admin/words`
- PUT `/api/admin/words/:id`
- DELETE `/api/admin/words/:id`
- GET `/api/admin/categories`
- POST `/api/admin/categories`
- PUT `/api/admin/categories/:id`
- DELETE `/api/admin/categories/:id`
- Session middleware: `backend/middleware/adminAuth.js`

### 1.5 Socket.IO Events Added
- `movePlayer` — host moves player to different team
- `transferHost` — host transfers ownership
- `leaveGame` — player intentionally leaves (goes offline)
- Updated `handleDisconnect` — auto-transfer host on disconnect

---

## Phase 2: Backend Game Logic Updates ✅

### 2.1 Move Player
- Validates host, target team space, updates team arrays + player.teamId
- DB persist via `gameService.movePlayerTeam()`

### 2.2 Transfer Host
- Validates current host, updates game.hostId/hostName + player flags
- DB persist via `gameService.transferHost()`

### 2.3 Leave Game (Soft Leave)
- Marks player connected=false, socketId=null
- Auto-transfers host if leaver is host
- Socket leaves room, emits game state

### 2.4 Remove "Add Word" from Socket.IO
- Removed `addWord` socket handler from game events
- Word management now only via admin REST API

---

## Phase 3: Frontend Admin Pages ✅

### 3.1 Admin Login (`/admin/login`)
- Email + password form → POST `/api/admin/login`
- Session token stored in the current browser tab
- Redirects to `/admin/dashboard`

### 3.2 Admin Dashboard (`/admin/dashboard`)
- Tabbed layout: Words | Categories | Admins
- Auth gate: redirects to login if no token
- Session bearer token in the Authorization header for admin API calls

**Words Tab:**
- Paginated table (20/page), search + filter by category/difficulty
- Inline add/edit forms
- Delete with confirmation
- Difficulty badges (easy/medium/hard)

**Categories Tab:**
- Card grid with icon, name, description
- Add/edit forms
- Delete with confirmation

**Admins Tab (head admin only):**
- Admin list with role badges
- Create new admin form
- Delete non-head admins

### 3.3 Admin API Client
- `frontend/lib/adminApi.js` — fetch wrapper with session authentication

---

## Phase 4: Frontend Game Updates ✅

### 4.1 Remove Word Studio
- Deleted Word Studio card from `lobby/page.js`
- Removed `addWord` usage from lobby

### 4.2 Leave Button
- **Lobby**: Leave button for all players (including host). Host auto-transfer on backend.
- **Game page**: Leave button in top bar next to timer
- **Results page**: Leave button in action row

### 4.3 Host Move Player
- Lobby moderation section: team dropdown next to each non-host player
- Shows available teams with player count

### 4.4 Host Transfer
- Lobby moderation section: "Make Host" button with confirmation dialog

### 4.5 Store Updates
- `movePlayer(gameId, playerId, teamId)`
- `transferHost(gameId, playerId)`
- `leaveGame(gameId)` — clears session and resets state

---

## Phase 5: Integration & Polish ✅

### 5.1 Environment Variables
- `HEAD_ADMIN_EMAIL` / `HEAD_ADMIN_PASSWORD` — configure initial access or migrate a legacy head account

### 5.2 Home Page
- Added subtle "Admin Portal" footer link on home page

### 5.3 Testing Checklist
- [x] Create game, host moves player between teams
- [x] Host transfers to another player
- [x] Player leaves, stays offline in team
- [x] Host leaves, auto-transfers to next player
- [x] Admin login endpoint returns proper auth errors
- [x] Admin routes protected by session middleware
- [x] Word studio removed from lobby
- [x] Leave buttons present on lobby/game/results

### 5.4 Deployment Notes
- Local build fails due to `?` in folder name (pre-existing webpack issue)
- Vercel builds fine — deploy there
- Railway backend deploys normally

---

## Files Created
```
backend/models/Admin.js
backend/models/Category.js
backend/routes/admin.js
backend/middleware/adminAuth.js
backend/services/adminService.js
frontend/lib/adminApi.js
frontend/app/admin/login/page.js
frontend/app/admin/dashboard/page.js
```

## Files Modified
```
backend/server.js             (+ admin routes, new socket events, head admin seed)
backend/services/gameService.js (+ movePlayerTeam, transferHost, softLeavePlayer)
frontend/app/store.js         (+ movePlayer, transferHost, leaveGame)
frontend/app/lobby/page.js    (- Word Studio, + Leave, + Move Player, + Transfer Host)
frontend/app/game/page.js     (+ Leave button)
frontend/app/results/page.js  (+ Leave button)
frontend/app/page.js          (+ Admin Portal footer link)
```

