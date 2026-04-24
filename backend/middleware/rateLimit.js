const RateLimit = require('rate-limiter-flexible');

const rateLimiter = new RateLimit.RateLimiterMemory({
  points: 5, // 5 guesses
  duration: 60, // per minute
});

async function limitGuesses(reqSocketId) {
  return new Promise((resolve, reject) => {
    rateLimiter.consume(reqSocketId)
      .then(() => resolve())
      .catch(() => reject(new Error('Too many guesses!')));
  });
}

module.exports = { rateLimiter, limitGuesses };

