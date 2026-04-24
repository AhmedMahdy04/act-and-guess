'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CurrentWord from '../../components/CurrentWord';
import GameTimer from '../../components/GameTimer';
import GuessInput from '../../components/GuessInput';
import Scoreboard from '../../components/Scoreboard';
import { useGameStore } from '../store';
import Card from '../../components/ui/Card';

export default function Game() {
  const [guess, setGuess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [guessFeedback, setGuessFeedback] = useState(null);
  const { game, status, submitGuess, lastError, clearError } = useGameStore();

  if (!game) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 sm:p-12 text-center">
          <h1 className="text-4xl sm:text-5xl font-black mb-4">Loading Game...</h1>
          <p className="opacity-80">Preparing the round.</p>
        </Card>
      </main>
    );
  }

  const isRoundEnd = status === 'round_end';
  const isActor = game.isActor;
  const canGuess = game.canGuess;
  const isSpectator = status === 'playing' && !isActor && !canGuess;

  const handleSubmit = async () => {
    if (!guess.trim()) {
      return;
    }

    setSubmitting(true);
    clearError();
    setGuessFeedback(null);

    try {
      const response = await submitGuess(game.id, guess);
      const score = Number(response?.score) || 0;
      setGuessFeedback({
        score,
        status: score > 0 ? 'correct' : 'incorrect',
      });
      setGuess('');
    } catch (error) {
      console.error(error);
      setGuessFeedback(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 max-w-7xl mx-auto relative">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mb-6 sm:mb-8"
      >
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-2xl sm:text-3xl font-black">
                Round {game.currentRound || 1}
              </div>
              <div className="px-4 py-2 sm:px-6 sm:py-3 rounded-2xl font-bold text-sm sm:text-xl bg-white/10 border border-white/15">
                {game.currentTeam
                  ? game.currentTeam.replace('team', 'Team ')
                  : 'Waiting'}
              </div>
              {game.currentActorName && (
                <div className="px-4 py-2 sm:px-6 sm:py-3 rounded-2xl font-bold text-sm sm:text-xl bg-black/20 border border-white/10">
                  Actor: {game.currentActorName}
                </div>
              )}
            </div>

            <GameTimer timeLeft={game.timeLeft} />
          </div>
        </Card>
      </motion.div>

      {isRoundEnd ? (
        <section className="max-w-4xl mx-auto">
          <Card className="p-8 sm:p-12 text-center space-y-6">
            <motion.div
              initial={{ scale: 0.95, opacity: 0.6 }}
              animate={{ scale: 1.02, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="text-7xl"
            >
              ⏳
            </motion.div>
            <h2 className="text-3xl sm:text-4xl font-black">
              Next round starting soon
            </h2>
            {game.lastRound?.word && (
              <p className="text-base sm:text-xl opacity-90">
                Previous word:{' '}
                <span className="font-black">{game.lastRound.word.toUpperCase()}</span>
              </p>
            )}

            <div className="mt-2">
              <Scoreboard teams={game.teams} />
            </div>
          </Card>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 sm:gap-12 items-start">
          <div className="space-y-6 sm:space-y-8 text-center">
            <motion.div
              key={`${status}-${isActor}-${canGuess}`}
              initial={{ opacity: 0.4, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`p-6 sm:p-10 rounded-3xl ${
                isActor
                  ? 'bg-gradient-to-br from-emerald-500/90 to-green-600/90 shadow-2xl border-4 border-emerald-400/70'
                  : 'bg-white/10 backdrop-blur-xl border border-white/20'
              }`}
            >
              {isActor ? (
                <CurrentWord word={game.currentWord} />
              ) : (
                <div className="flex flex-col items-center">
                  <div className="text-6xl sm:text-8xl mb-6">
                    {canGuess ? '🧠' : '👀'}
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black mb-3">
                    {canGuess
                      ? 'Guess the word!'
                      : `Watch ${game.currentActorName}`}
                  </h2>
                  <p className="text-base sm:text-xl opacity-75">
                    {canGuess
                      ? 'Your team is up. Submit a guess before time runs out.'
                      : 'Only the active team can guess this round.'}
                  </p>
                </div>
              )}
            </motion.div>

            {isActor && (
              <Card className="p-6 sm:p-8 bg-gradient-to-r from-yellow-500/25 to-orange-500/25 border-yellow-400/40">
                <div className="text-6xl mb-3">🎭</div>
                <h3 className="text-2xl sm:text-3xl font-black mb-3">Act It Out</h3>
                <p className="text-base sm:text-xl opacity-90">
                  No talking, no spelling, no pointing.
                </p>
              </Card>
            )}
          </div>

          <div className="space-y-6 sm:space-y-8">
            {canGuess ? (
              <div className="space-y-4">
                <GuessInput guess={guess} setGuess={setGuess} onSubmit={handleSubmit} />

                <AnimatePresence>
                  {guessFeedback && (
                    <motion.div
                      key={`feedback-${guessFeedback.status}-${guessFeedback.score}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className={`text-center rounded-2xl border px-4 py-3 ${
                        guessFeedback.status === 'correct'
                          ? 'bg-emerald-500/20 border-emerald-300/40'
                          : 'bg-red-500/20 border-red-300/40'
                      }`}
                    >
                      <span className="font-black text-lg sm:text-xl">
                        {guessFeedback.status === 'correct'
                          ? `Nice! +${guessFeedback.score}`
                          : 'Not quite. Try again!'}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {submitting && (
                  <p className="text-center opacity-75">Submitting guess...</p>
                )}
              </div>
            ) : (
              <Card className="p-6 sm:p-8 text-center">
                <div className="text-5xl sm:text-6xl mb-4">
                  {isSpectator ? '📣' : '🎬'}
                </div>
                <h3 className="text-2xl sm:text-3xl font-black mb-3">
                  {isActor ? 'Your Team Is Guessing' : 'Spectator View'}
                </h3>
                <p className="text-base sm:text-xl opacity-75">
                  {isActor
                    ? 'Focus on acting out the word.'
                    : 'Wait for your team’s round to start.'}
                </p>
              </Card>
            )}

            {lastError && (
              <div className="text-center text-red-200 bg-red-500/20 border border-red-300/30 rounded-2xl px-4 py-3">
                {lastError}
              </div>
            )}

            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/20">
              <h3 className="text-2xl sm:text-3xl font-black mb-5 text-center">
                Recent Guesses
              </h3>
              <div className="space-y-3 text-base sm:text-lg">
                {game.recentGuesses?.length ? (
                  game.recentGuesses.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-4 bg-white/20 rounded-2xl flex justify-between gap-4"
                    >
                      <span className="font-bold truncate max-w-[45%]">
                        {entry.username}
                      </span>
                      <span className="truncate max-w-[40%]">{entry.guess}</span>
                      <span className="tabular-nums font-black">
                        {entry.score > 0 ? `+${entry.score}` : '0'}
                      </span>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-4 bg-white/20 rounded-2xl opacity-50">
                    No guesses yet...
                  </div>
                )}
              </div>
            </div>

            <Scoreboard teams={game.teams} />
          </div>
        </div>
      )}
    </main>
  );
}
