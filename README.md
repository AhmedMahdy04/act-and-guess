# Act & Guess

A real-time multiplayer party game. One player acts out a prompt and their teammates guess. Hosts can create public or private rooms and invite friends with a room code, link, or QR code.

## Run locally

Use Node.js 24 and npm. Start MongoDB locally to persist games, use the admin dashboard, and edit the catalog.

```bash
cd backend
npm ci
MONGODB_URI=mongodb://127.0.0.1:27017/guessgame NODE_ENV=development npm start
```

In a second terminal, from the repository root:

```bash
cd frontend
npm ci
NEXT_PUBLIC_BACKEND_URL=http://localhost:4001 npm run dev
```

Open [the game](http://localhost:3000) or [admin sign-in](http://localhost:3000/admin/login). The backend defaults to port 4001. Development can fall back to a bundled catalog and in-memory matches. Set `REQUIRE_DATABASE=true` to require MongoDB in development as well.

## Prompt catalog

A fresh database starts with **732 English prompts across 15 categories**, with at least 15 in each of the 45 category and difficulty combinations. The difficulty levels reflect familiarity and how easy a prompt is to act out. `Mixed` draws from all three levels. The launch import adds up to 675 prompts to existing databases while preserving existing edits.

The bundled packs include food, actors, football players, animals, objects, actions, movies, places, countries, sports, jobs, landmarks, instruments, transport, and fictional characters. The packs use English names and labels sourced and cross-checked against CC0 Wikidata structured data, alongside curated aliases and activity prompts. Category assignments and difficulty ratings are editorial. The server loads the bundled data locally. [Wikidata Query Service](https://query.wikidata.org/), [Wikidata licensing](https://www.wikidata.org/wiki/Wikidata:Licensing)

MongoDB is the source of truth when connected. A versioned seed runs once per database. Renamed and archived entries remain edited on restart. Catalog edits made through the dashboard notify connected clients after the database write. Each new round draws from the current catalog and leaves the active round's prompt stable. Players can select active categories with available prompts.

## Admin and game data

Set `HEAD_ADMIN_EMAIL` and `HEAD_ADMIN_PASSWORD` in the backend environment to provision the first head admin. The password must have at least 12 characters and fit within 72 UTF-8 bytes. On an existing installation, use the legacy head account's email and a new password to migrate it. Remove the bootstrap password from the environment after signing in successfully. Rotate passwords through the dashboard. The upgrade replaces legacy admin sessions and game reconnect credentials, so ask existing users to sign in again or start a fresh room.

Admins can search, add, edit, archive, and restore prompts and categories. MongoDB records authorship and edit metadata for catalog changes. The head admin can manage accounts and inspect saved match summaries. Game snapshots store settings, roster, scores, round state, and the latest 500 completed rounds and 50 match summaries per room. The eight latest guesses in the current round support reconnects. Closed rooms remain in the database until removed by an operator.

## Prepare a production deployment

1. Use the existing MongoDB Atlas database or provision a dedicated database. Back up an existing installation before its first upgrade.
2. Create a Vercel project for the `backend` directory. Use Node.js 24 and keep Fluid compute enabled. Set the production variables `MONGODB_URI` and `FRONTEND_URL` to the Atlas connection string and the exact public frontend origin. Use `FRONTEND_URLS` for additional exact origins. The backend's `/health` should report `ok: true` and `dbConnected: true`.
3. Deploy the frontend from `frontend`. Set its production `NEXT_PUBLIC_BACKEND_URL` to the Vercel backend URL before building.
4. Test a private four-player match through a connection recycle. Vercel Hobby WebSockets have a five-minute limit. Players reconnect automatically using their room session tokens. MongoDB holds the score, round deadline, and presence state for the next function instance. Connected clients drive round progression.
5. Set the head admin bootstrap variables when ready to provision or migrate the dashboard. See the admin setup above.

The Vercel backend uses the WebSocket transport directly and checks MongoDB for changes while players are in a room. Leave room pages when finished to reduce database traffic. The admin dashboard also refreshes periodically if a change occurred on another instance. [Vercel WebSockets](https://vercel.com/docs/functions/websockets)

## Local checks

```bash
(cd backend && npm audit)
(cd frontend && npm audit && npm run lint && npm run build)
```
