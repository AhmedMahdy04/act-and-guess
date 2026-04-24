const gameService = require('../services/gameService');

async function createGame(hostId, config, hostSocketId, hostUsername, hostTeamIndex) {
  return gameService.createGame(config, hostId, hostSocketId, hostUsername, hostTeamIndex);
}

async function joinGame(gameCode, playerId, socketId, username, teamId) {
  await gameService.addPlayerToGame(gameCode, playerId, socketId, username, teamId);
  return gameService.getGameByCode(gameCode);
}

function calculateScore(guess, answer) {
  const cleanGuess = String(guess || '').toLowerCase().trim();
  const cleanAnswer = String(answer || '').toLowerCase().trim();
  const distance = levenshteinDistance(cleanGuess, cleanAnswer);
  const maxLen = Math.max(cleanGuess.length, cleanAnswer.length);
  const similarity = maxLen === 0 ? 1 : 1 - (distance / maxLen);

  if (similarity >= 1) return 2;
  if (similarity >= 0.7) return 1;
  return 0;
}

async function nextRound(gameCode) {
  return gameService.getGameByCode(gameCode);
}

function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i += 1) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

module.exports = { createGame, joinGame, calculateScore, nextRound };
