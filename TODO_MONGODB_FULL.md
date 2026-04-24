# MongoDB Full Integration TODO

**Status:** Approved, implementing.

1. [ ] Edit backend/server.js - Uncomment imports, add async connectDB IIFE, refactor handlers to always use gameService + memory sync
2. [ ] Edit backend/services/gameService.js - Add cleanup(gameCode), fix createGame team order
3. [ ] Edit backend/models/Game.js - Add fields teamCount, playersPerTeam, currentRound etc.
4. [ ] Frontend results/page.js - Add 'Play Again' / 'End Game' buttons emit 'playAgain' or 'endGameConfirm'
5. [ ] Restart servers
6. [ ] Test persistence: create game, restart backend, join works
7. [ ] Test cleanup after end
8. [ ] Done
