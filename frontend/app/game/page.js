'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CurrentWord from '../../components/CurrentWord';
import GameTimer from '../../components/GameTimer';
import GuessInput from '../../components/GuessInput';
import RoomUnavailable from '../../components/RoomUnavailable';
import Scoreboard from '../../components/Scoreboard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useGameStore } from '../store';

export default function Game() {
  const [leaving, setLeaving] = useState(false);
  const { game, lastError, leaveGame, sessionStatus, connectionStatus } = useGameStore();
  const router = useRouter();

  if (!game) return <RoomUnavailable title="No active round" />;

  const isRoundEnd = game.status === 'round_end';
  const isActor = game.isActor && !isRoundEnd;
  const canGuess = game.canGuess && !isRoundEnd;
  const online = connectionStatus === 'online' && sessionStatus === 'ready';
  const teamName = game.teams[game.currentTeam]?.name;

  async function handleLeave() {
    if (!window.confirm('Leave this game?')) return;
    setLeaving(true);
    try {
      await leaveGame(game.id);
      router.push('/');
    } catch {
      // The server error stays visible in the game.
    } finally {
      setLeaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl space-y-5 px-4 py-5 sm:px-8 sm:py-8">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-slate-100 sm:text-2xl">Round {game.currentRound || 1}</h1>
          <p className="mt-1 break-words text-sm text-slate-300">
            {teamName}{game.currentActorName && ` · ${game.currentActorName} is acting`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <GameTimer timeLeft={game.timeLeft} roundTime={game.roundTime} paused={isRoundEnd || !online} />
          <Button variant="ghost" size="sm" onClick={handleLeave} disabled={leaving || !online}>
            {leaving ? 'Leaving…' : 'Leave game'}
          </Button>
        </div>
      </Card>

      {lastError && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{lastError}</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {isRoundEnd ? (
            <RoundRecap round={game.lastRound} />
          ) : isActor ? (
            <Card className="border-emerald-500/20 bg-emerald-500/5 p-5 text-center sm:p-8">
              <CurrentWord word={game.currentWord} />
            </Card>
          ) : canGuess ? (
            <GuessPanel key={game.roundId || game.currentRound} game={game} enabled={online && game.timeLeft > 0} />
          ) : (
            <Card className="p-6 text-center sm:p-10">
              <p className="mb-3 text-4xl" aria-hidden="true">👀</p>
              <h2 className="text-2xl font-black text-slate-100">Watch the round</h2>
              <p className="mx-auto mt-2 max-w-sm text-slate-300">
                {teamName || 'The active team'} is guessing this round. Your team can guess on its turn.
              </p>
            </Card>
          )}

          {!isRoundEnd && (
            <Card className="p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-bold text-slate-100">Recent guesses</h2>
              {game.recentGuesses?.length ? (
                <ul className="space-y-2">
                  {game.recentGuesses.map((entry) => (
                    <li key={entry.id} className="grid grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_auto] items-start gap-3 rounded-xl bg-base-800/70 px-3 py-2.5 text-sm">
                      <span className="break-words font-semibold text-slate-200">{entry.username}</span>
                      <span className="break-words text-slate-300">{entry.guess}</span>
                      <span className={entry.score ? 'font-bold text-emerald-300' : 'text-slate-400'}>{entry.score ? `+${entry.score}` : '0'}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-300">Guesses will appear here as players submit them.</p>}
            </Card>
          )}
        </div>

        <Scoreboard teams={game.teams} targetScore={game.targetScore} />
      </div>
    </main>
  );
}

function GuessPanel({ game, enabled }) {
  const [guess, setGuess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const submitGuess = useGameStore((state) => state.submitGuess);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!enabled || submitting || !guess.trim()) return;
    setSubmitting(true);
    setFeedback('');
    try {
      const response = await submitGuess(game.id, guess.trim(), game.roundId);
      setFeedback(response.score > 0 ? `Correct! +${response.score} points.` : 'Keep guessing. Try another answer.');
      setGuess('');
    } catch {
      // Keep the draft in case the player needs to retry.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-4 border-indigo-500/25 p-5 sm:p-7">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-indigo-300">Your team’s turn</p>
        <h2 className="text-2xl font-black text-slate-100">Guess the word</h2>
        <p className="mt-1 text-sm text-slate-300">Watch the actor and send a guess before time runs out.</p>
      </div>
      <GuessInput guess={guess} setGuess={setGuess} onSubmit={handleSubmit} disabled={!enabled} submitting={submitting} />
      <p role="status" className="text-sm font-semibold text-indigo-200">{feedback}</p>
    </Card>
  );
}

function RoundRecap({ round }) {
  const guessed = round?.reason === 'guessed';
  const title = guessed ? 'Correct guess!' : round?.reason === 'timeout' ? 'Time’s up' : 'Round complete';

  return (
    <Card className="space-y-4 p-6 text-center sm:p-10">
      <p className="text-5xl" aria-hidden="true">{guessed ? '✨' : '⏳'}</p>
      <h2 className="text-2xl font-black text-slate-100 sm:text-3xl">{title}</h2>
      {round?.word && <p className="break-words text-slate-300">The word was <strong className="text-lg text-slate-100">{round.word}</strong>.</p>}
      {guessed && round.guessingPlayerName && <p className="font-semibold text-emerald-300">{round.guessingPlayerName} earned {round.score} {round.score === 1 ? 'point' : 'points'}.</p>}
      <p className="text-sm text-slate-300" role="status">The next round is starting soon.</p>
    </Card>
  );
}
