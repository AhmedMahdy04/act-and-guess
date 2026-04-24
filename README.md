# Real-Time Multiplayer Act & Guess Game

## Quick Start (Local)

1. **Backend:**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env and set MONGODB_URI (or leave blank for in-memory mode)
   npm start
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   npm run dev
   ```

Open http://localhost:3000

## Tech Stack
- **Frontend:** Next.js 14, Tailwind CSS, Framer Motion, Socket.IO-client, Zustand
- **Backend:** Node.js, Express, Socket.IO, MongoDB (Mongoose), rate-limiter-flexible
- **Deployment:** Vercel (Frontend), Railway (Backend), MongoDB Atlas (Database)

## Features
- Real-time multiplayer with WebSockets
- QR code joining & shareable links
- Team-based acting/guessing with rotation
- Fuzzy word matching (Levenshtein similarity)
- Public & private lobbies
- Word catalog with categories & difficulties
- Host moderation (kick/ban players)
- Session persistence across reconnects
- Responsive design

## Deploy to Production

### 1. MongoDB Atlas (Free)
1. Create account at https://www.mongodb.com/atlas
2. Create a free M0 cluster
3. Database Access → Add Database User
4. Network Access → Allow from anywhere (`0.0.0.0/0`)
5. Copy your connection string (replace `<password>`)

### 2. Backend → Railway (Free)
1. Push your code to GitHub
2. Go to https://railway.app → New Project → Deploy from GitHub repo
3. Select your backend folder (or use monorepo with `backend` as root)
4. Add environment variables:
   ```
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/guessgame
   FRONTEND_URL=https://your-frontend.vercel.app
   FRONTEND_URLS=https://your-frontend.vercel.app
   ```
5. Railway auto-detects Node.js and runs `npm start`
6. Copy your Railway domain (e.g., `https://guess-game.up.railway.app`)

### 3. Frontend → Vercel (Free)
1. Go to https://vercel.com → Add New Project
2. Import your GitHub repo
3. Set **Framework Preset** to Next.js
4. Set **Root Directory** to `frontend/`
5. Add environment variable:
   ```
   NEXT_PUBLIC_BACKEND_URL=https://your-backend.up.railway.app
   ```
6. Deploy

### Environment Variables

**Backend (`backend/.env`):**
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (Railway auto-sets this) |
| `MONGODB_URI` | MongoDB connection string |
| `FRONTEND_URL` | Primary frontend URL for CORS |
| `FRONTEND_URLS` | Comma-separated allowed origins |

**Frontend (`frontend/.env.local` or Vercel env):**
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Your Railway backend URL |

## Project Structure
```
├── backend/
│   ├── server.js           # Express + Socket.IO server
│   ├── db.js               # MongoDB connection
│   ├── services/           # Game logic & persistence
│   ├── models/             # Mongoose schemas
│   └── middleware/         # Rate limiting
├── frontend/
│   ├── app/                # Next.js App Router pages
│   ├── components/         # Reusable UI components
│   └── public/             # PWA assets
└── deployment/
    ├── vercel.json         # Vercel config
    └── railway.json        # Railway config
```

## License
MIT

