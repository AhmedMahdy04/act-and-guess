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
      <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="p-8 sm:p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary text-3xl flex items-center justify-center mx-auto mb-5">
            🎭
          </div>
          <h1 className="text-2xl font-bold text-slate-200 mb-2">No Game Found</h1>
          <p className="text-slate-500 text-sm">Your game session may have ended. Create or join a new one.</p>
        </Card>
      </main>
    );
  }

  const isRoundEnd = status === 'round_end';
  const isActor = game.isActor;
  const canGuess = game.canGuess;
  const isSpectator = status === 'playing' && !isActor && !canGuess;

  const handleSubmit = async () => {
    if (!guess.trim()) return;
    setSubmitting(true);
    clearError();
    setGuessFeedback(null);

    try {
      const response = await submitGuess(game.id, guess);
      const score = Number(response?.score) || 0;
      setGuessFeedback({ score, status: score > 0 ? 'correct' : 'incorrect' });
      setGuess('');
    } catch (error) {
      console.error(error);
      setGuessFeedback(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mb-5 sm:mb-6"
      >
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xl sm:text-2xl font-bold text-slate-100">
                Round {game.currentRound || 1}
              </div>
              {game.currentTeam && (
                <TeamBadge teamId={game.currentTeam} />
              )}
              {game.currentActorName && (
                <div className="px-3 py-1.5 rounded-lg font-semibold text-sm bg-base-800 border border-white/[0.06] text-slate-400">
                  Actor: <span className="text-slate-200">{game.currentActorName}</span>
                </div>
              )}
            </div>
            <GameTimer timeLeft={game.timeLeft} />
          </div>
        </Card>
      </motion.div>

      {isRoundEnd ? (
        <section className="max-w-3xl mx-auto">
          <Card className="p-8 sm:p-12 text-center space-y-5">
            <motion.div
              initial={{ scale: 0.95, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="text-6xl"
            >
              ⏳
            </motion.div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Next round starting soon
            </h2>
            {game.lastRound?.word && (
              <p className="text-slate-400">
                Previous word:{' '}
                <span className="font-bold text-slate-200">{game.lastRound.word.toUpperCase()}</span>
              </p>
            )}
            <Scoreboard teams={game.teams} />
          </Card>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.85fr] gap-5 sm:gap-6 items-start">
          {/* Main stage */}
          <div className="space-y-5">
            <motion.div
              key={`${status}-${isActor}-${canGuess}`}
              initial={{ opacity: 0.4, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`rounded-2xl p-6 sm:p-10 text-center border ${
                isActor
                  ? 'bg-accent-emerald/5 border-accent-emerald/20'
                  : 'bg-base-900/50 border-white/[0.06]'
              }`}
            >
              {isActor ? (
                <CurrentWord word={game.currentWord} />
              ) : (
                <div className="flex flex-col items-center">
                  <div className="text-5xl sm:text-6xl mb-5">
                    {canGuess ? '🧠' : '👀'}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2">
                    {canGuess ? 'Guess the word!' : `Watch ${game.currentActorName}`}
                  </h2>
                  <p className="text-slate-500 max-w-md">
                    {canGuess
                      ? 'Your team is up. Submit a guess before time runs out.'
                      : 'Only the active team can guess this round.'}
                  </p>
                </div>
              )}
            </motion.div>

            {isActor && (
              <Card className="p-5 sm:p-6 text-center border-accent-amber/15 bg-accent-amber/5">
                <div className="text-4xl mb-2">🎭</div>
                <h3 className="text-lg font-bold text-slate-200 mb-1">Act It Out</h3>
                <p className="text-sm text-slate-500">No talking, no spelling, no pointing.</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {canGuess ? (
              <div className="space-y-3">
                <GuessInput guess={guess} setGuess={setGuess} onSubmit={handleSubmit} />

                <AnimatePresence>
                  {guessFeedback && (
                    <motion.div
                      key={`feedback-${guessFeedback.status}-${guessFeedback.score}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className={`text-center rounded-xl border px-4 py-3 ${
                        guessFeedback.status === 'correct'
                          ? 'bg-accent-emerald/10 border-accent-emerald/20 text-emerald-200'
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                      }`}
                    >
                      <span className="font-bold text-base">
                        {guessFeedback.status === 'correct'
                          ? `Nice! +${guessFeedback.score}`
                          : 'Not quite. Try again!'}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {submitting && (
                  <p className="text-center text-slate-500 text-sm">Submitting guess...</p>
                )}
              </div>
            ) : (
              <Card className="p-6 sm:p-8 text-center">
                <div className="text-4xl sm:text-5xl mb-4">
                  {isSpectator ? '📣' : '🎬'}
                </div>
                <h3 className="text-lg font-bold text-slate-200 mb-2">
                  {isActor ? 'Your Team Is Guessing' : 'Spectator View'}
                </h3>
                <p className="text-sm text-slate-500">
                  {isActor
                    ? 'Focus on acting out the word.'
                    : 'Wait for your team\'s round to start.'}
                </p>
              </Card>
            )}

            {lastError && (
              <div className="text-center text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm">
                {lastError}
              </div>
            )}

            {/* Recent guesses */}
            <Card className="p-5 sm:p-6">
              <h3 className="text-base font-bold text-slate-200 mb-4 text-center">Recent Guesses</h3>
              <div className="space-y-2">
                {game.recentGuesses?.length ? (
                  game.recentGuesses.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-3 py-2.5 bg-base-800/60 rounded-xl flex justify-between items-center gap-3 text-sm"
                    >
                      <span className="font-semibold text-slate-300 truncate max-w-[40%]">
                        {entry.username}
                      </span>
                      <span className="text-slate-500 truncate max-w-[35%]">{entry.guess}</span>
                      <span className="tabular-nums font-bold text-slate-200 shrink-0">
                        {entry.score > 0 ? `+${entry.score}` : '0'}
                      </span>
                    </motion.div>
                  ))
                ) : (
                  <div className="px-3 py-4 bg-base-800/40 rounded-xl text-center text-sm text-slate-500">
                    No guesses yet...
                  </div>
                )}
              </div>
            </Card>

            <Scoreboard teams={game.teams} />
          </div>
        </div>
      )}
    </main>
  );
}

function TeamBadge({ teamId }) {
  const colors = {
    team1: 'bg-red-500/10 text-red-400 border-red-500/20',
    team2: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    team3: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    team4: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    team5: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    team6: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  };
  const colorClass = colors[teamId] || colors.team1;
  const name = teamId.replace('team', 'Team ');

  return (
    <div className={`px-3 py-1.5 rounded-lg font-semibold text-sm border ${colorClass}`}>
      {name}
    </div>
  );
}

