# Production Readiness TODO

## Plan
- [x] 1. Fix Production Configs
  - [x] Update `frontend/next.config.js` for standalone build
  - [x] Update `backend/server.js` to support `process.env.PORT`
  - [x] Clean `backend/package.json` (remove fuzzywuzzy, add engines)
- [x] 2. Environment Variable Templates
  - [x] Create `frontend/.env.example`
  - [x] Create `backend/.env.example`
  - [x] Create `frontend/.env.production`
- [x] 3. Deployment Config Updates
  - [x] Update `deployment/vercel.json`
  - [x] Update `deployment/railway.json`
  - [x] Create `backend/Procfile`
- [x] 4. Build Verification
  - [x] Run `npm run build` in frontend — **PASSED** (all 9 pages compiled)
  - [x] Verify backend starts cleanly
- [x] 5. Documentation
  - [x] Update `README.md` with deploy instructions
