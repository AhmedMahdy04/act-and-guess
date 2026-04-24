'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useGameStore } from './store';

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const { fetchPublicGames, publicGames, lastError, clearError } = useGameStore();

  useEffect(() => {
    fetchPublicGames().catch(() => {});
  }, [fetchPublicGames]);

  const normalized = joinCode.trim();
  const canJoin = normalized.length > 0;

  const handleCreate = () => router.push('/create');

  const handleJoin = (gameId = normalized) => {
    if (!gameId) return;
    clearError();
    router.push(`/join?id=${encodeURIComponent(gameId)}`);
  };

  return (
    <main className="min-h-[calc(100vh-2rem)] flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-6xl"
      >
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <Card className="p-6 sm:p-10">
            <div className="text-center">
              <motion.h1
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="text-5xl sm:text-6xl font-black tracking-tight mb-3 bg-gradient-to-r from-purple-400 via-blue-400 to-pink-500 bg-clip-text text-transparent"
              >
                Act &amp; Guess
              </motion.h1>
              <p className="text-base sm:text-xl opacity-90 mb-8">
                Launch-ready party rounds with live rooms, public lobbies, and curated word decks.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                <Button onClick={handleCreate} className="py-5 text-2xl">
                  Host New Game
                </Button>

                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold opacity-90 text-left px-2">
                    Join by private code
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value)}
                      placeholder="Enter room code"
                      className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-lg font-bold placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary/60"
                      inputMode="text"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => handleJoin()}
                      disabled={!canJoin}
                      className="px-4 py-4 rounded-2xl text-lg"
                    >
                      Join
                    </Button>
                  </div>
                </div>
              </div>

              {lastError && (
                <div className="mt-6 text-center text-red-200 bg-red-500/20 border border-red-300/30 rounded-2xl px-4 py-3">
                  {lastError}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="text-2xl sm:text-3xl font-black">Public Lobbies</h2>
              <Button
                variant="ghost"
                onClick={() => fetchPublicGames().catch(() => {})}
                className="px-4 py-2 text-sm"
              >
                Refresh
              </Button>
            </div>

            <div className="space-y-4">
              {publicGames.length ? publicGames.map((game) => (
                <div
                  key={game.id}
                  className="rounded-3xl border border-white/15 bg-black/20 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] opacity-60">Hosted by</p>
                      <p className="text-xl font-black">{game.hostName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.2em] opacity-60">Room</p>
                      <p className="font-mono text-lg">{game.id}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <InfoPill label="Category" value={game.categoryLabel} />
                    <InfoPill label="Difficulty" value={capitalize(game.difficulty)} />
                    <InfoPill label="Players" value={`${game.currentPlayerCount}/${game.maxPlayers}`} />
                    <InfoPill label="Round" value={`${game.roundTime}s`} />
                  </div>

                  <Button
                    onClick={() => handleJoin(game.id)}
                    className="w-full justify-center py-3"
                  >
                    Join Public Lobby
                  </Button>
                </div>
              )) : (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-center opacity-75">
                  No public lobbies are open right now.
                </div>
              )}
            </div>
          </Card>
        </div>
      </motion.div>
    </main>
  );
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.18em] opacity-60">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}

function capitalize(value) {
  const next = String(value || '');
  return next.charAt(0).toUpperCase() + next.slice(1);
}
