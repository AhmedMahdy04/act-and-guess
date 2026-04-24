'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../store';
import Scoreboard from '../../components/Scoreboard';
import { useRouter } from 'next/navigation';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function Results() {
  const [starting, setStarting] = useState(false);
  const [editing, setEditing] = useState(false);
  const { game, winner, startGame, isHost, resetGame, returnToLobby } = useGameStore();
  const router = useRouter();

  if (!winner) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 sm:p-8">
        <Card className="p-8 sm:p-12 text-center">
          <div className="text-7xl mb-4">🏆</div>
          <h1 className="text-4xl font-black">Game Complete!</h1>
          <p className="opacity-80 mt-2">Fetching final scoreboard.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="text-center mb-10 sm:mb-16"
      >
        <div className="text-7xl sm:text-8xl mb-4 animate-bounce">🎉</div>
        <motion.h1
          initial={{ scale: 0.95, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="text-4xl sm:text-6xl font-black bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent"
        >
          {winner.replace('team', 'Team ').toUpperCase()} WINS!
        </motion.h1>
        <p className="text-base sm:text-2xl opacity-90 mt-3">
          Congratulations to the champions!
        </p>
      </motion.div>

      <Scoreboard teams={game?.teams || {}} />

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center mt-10 sm:mt-16">
        <Button
          variant="secondary"
          onClick={() => {
            resetGame({ cleanupRemote: isHost });
            router.push('/');
          }}
          className="flex-1 justify-center py-7 px-10 text-2xl max-w-md mx-auto"
        >
          🏠 New Game
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
              className="flex-1 justify-center py-7 px-10 text-2xl max-w-md mx-auto"
            >
              {editing ? 'Opening Lobby...' : '⚙️ Edit Next Session'}
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
              className="flex-1 justify-center py-7 px-10 text-2xl max-w-md mx-auto"
            >
              {starting ? 'Starting...' : '🔄 Play Again'}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
