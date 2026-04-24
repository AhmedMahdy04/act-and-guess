'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import Scoreboard from '../../components/Scoreboard';
import { useRouter } from 'next/navigation';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Logo from '../../components/Logo';

export default function Results() {
  const [starting, setStarting] = useState(false);
  const [editing, setEditing] = useState(false);
  const { game, winner, startGame, isHost, resetGame, returnToLobby, leaveGame } = useGameStore();
  const router = useRouter();

  if (!winner) {
    return (
      <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-8">
        <Card className="p-8 sm:p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary text-3xl flex items-center justify-center mx-auto mb-5">
            🏆
          </div>
          <h1 className="text-2xl font-bold text-slate-200 mb-2">Game Complete!</h1>
          <p className="text-slate-500 text-sm">Fetching final scoreboard...</p>
        </Card>
      </main>
    );
  }

  const winnerName = winner.replace('team', 'Team ');
  const winnerTeam = game?.teams?.[winner];

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="text-center mb-10 sm:mb-12"
      >
        <div className="inline-flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="text-6xl sm:text-7xl mb-4"
          >
            🎉
          </motion.div>
          <h1 className="text-3xl sm:text-5xl font-bold text-slate-100 mb-2">
            {winnerName} Wins!
          </h1>
          {winnerTeam && (
            <p className="text-slate-500 text-sm mb-6">
              Final score: <span className="font-bold text-slate-300">{winnerTeam.score}</span> points
            </p>
          )}
        </div>
      </motion.div>

      <Scoreboard teams={game?.teams || {}} />

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-10 sm:mt-12">
        <Button
          variant="secondary"
          onClick={() => {
            resetGame({ cleanupRemote: isHost });
            router.push('/');
          }}
          size="lg"
          className="flex-1 justify-center max-w-xs mx-auto"
        >
          New Game
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try { await leaveGame(game.id); } catch { window.location.href = '/'; }
          }}
          size="lg"
          className="flex-1 justify-center max-w-xs mx-auto"
        >
          Leave Game
        </Button>
        {isHost && (
          <>
            <Button
              variant="secondary"
              onClick={async () => {
                setEditing(true);
                try {
                  await returnToLobby(game.id);
                  router.push('/lobby');
                } catch (error) {
                  console.error(error);
                } finally {
                  setEditing(false);
                }
              }}
              disabled={editing}
              size="lg"
              className="flex-1 justify-center max-w-xs mx-auto"
            >
              {editing ? 'Opening...' : 'Edit Settings'}
            </Button>
            <Button
              onClick={async () => {
                setStarting(true);
                try {
                  await startGame(game.id);
                } catch (error) {
                  console.error(error);
                } finally {
                  setStarting(false);
                }
              }}
              disabled={starting}
              size="lg"
              className="flex-1 justify-center max-w-xs mx-auto"
            >
              {starting ? 'Starting...' : 'Play Again'}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}

