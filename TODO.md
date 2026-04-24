# Fix MongoDB + Random 6-char Game ID

## Steps:
- [ ] 1. Kill old Node processes (\`pkill -f node\` or manual kill)
- [ ] 2. Ensure MongoDB running (\`brew services start mongodb-community\` if local)
- [ ] 3. Create .env with \`MONGODB_URI=mongodb://localhost:27017/guessgame\`
- [ ] 4. Edit backend/server.js: Uncomment DB imports, connectDB, use gameService everywhere, generate random 6-char gameId
- [ ] 5. Edit backend/services/gameService.js: Use random 6-char gameCode
- [ ] 6. Edit backend/controllers/gameController.js: Align gameCode generation
- [ ] 7. cd backend && npm install (fresh deps)
- [ ] 8. Test: npm start backend → create game (check 6-char ID, Mongo data)
- [ ] 9. Frontend integration test
- [ ] 10. attempt_completion
