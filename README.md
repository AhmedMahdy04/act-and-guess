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

1. Set up a production MongoDB database and take a backup before upgrading an existing installation. Use a dedicated database account with access to this database.
2. Deploy the backend with the `backend` root, Node.js 24, `npm start`, and the `/health` health check. Run a single backend replica because live Socket.IO rooms and timers are held in that process. In Railway, select Railpack and configure the start command and health check in the service settings. Existing services using `deployment/railway.json` can migrate those settings before Railway retires that format. [Railway monorepo configuration](https://docs.railway.com/deployments/monorepo), [Railway configuration migration](https://docs.railway.com/config-as-code)
3. Set backend environment variables `NODE_ENV=production`, `MONGODB_URI`, and `FRONTEND_URL` to the exact HTTPS origin of the frontend. Use `FRONTEND_URLS` for additional comma-separated origins. Set `TRUST_PROXY_HOPS` only when the deployment has a known number of reverse-proxy hops. The hosting platform can supply `PORT`.
4. Deploy the Next.js app with the `frontend` root and Node.js 24. Set `NEXT_PUBLIC_BACKEND_URL` to the backend's public HTTPS URL before building. [Vercel project root](https://vercel.com/docs/monorepos), [Vercel environment variables](https://vercel.com/docs/environment-variables)
5. Confirm that `/health` returns `ok: true` and `dbConnected: true`. Test creating and joining a room from separate browsers, playing a round, reconnecting, and editing a test prompt from the dashboard. Verify the edit is visible to a connected host and persists through a restart.

## Local checks

```bash
(cd backend && npm audit)
(cd frontend && npm audit && npm run lint && npm run build)
```
