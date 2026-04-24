'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Logo from '../components/Logo';
import { useGameStore } from './store';

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const { fetchPublicGames, publicGames, lastError, clearError } = useGameStore();

  useEffect(() => {
    fetchPublicGames().catch(() => {});
  }, [fetchPublicGames]);

  const normalized = joinCode.trim().toUpperCase();
  const canJoin = normalized.length > 0;

  const handleCreate = () => router.push('/create');

  const handleJoin = (gameId = normalized) => {
    if (!gameId) return;
    clearError();
    router.push(`/join?id=${encodeURIComponent(gameId)}`);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] flex flex-col p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center py-12 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-5xl"
        >
          <div className="text-center mb-12 sm:mb-16">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="inline-flex flex-col items-center gap-6"
            >
              <Logo size="xl" />
              <p className="text-lg sm:text-xl text-slate-400 max-w-lg mx-auto leading-relaxed">
                Create a room, invite your friends, and take turns acting out words while your team guesses. The first team to reach the target score wins!
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
            {/* Main actions */}
            <Card className="p-6 sm:p-10">
              <div className="space-y-6">
                <Button onClick={handleCreate} size="xl" className="w-full justify-center">
                  <span className="text-2xl mr-2">🎭</span>
                  Host New Game
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/[0.06]" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-base-900 px-4 text-slate-500">or join with a code</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <input
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value)}
                    placeholder="Enter room code"
                    className="flex-1 bg-base-800 border border-white/[0.08] rounded-xl px-5 py-4 text-lg font-semibold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30 text-center tracking-widest uppercase"
                    inputMode="text"
                    maxLength={8}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => handleJoin()}
                    disabled={!canJoin}
                    size="lg"
                    className="px-8"
                  >
                    Join
                  </Button>
                </div>

                {lastError && (
                  <div className="text-center text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm">
                    {lastError}
                  </div>
                )}
              </div>
            </Card>

            {/* Public lobbies */}
            <Card className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-200">Public Lobbies</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Join an open game</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => fetchPublicGames().catch(() => {})}
                  size="sm"
                >
                  Refresh
                </Button>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {publicGames.length ? publicGames.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-xl border border-white/[0.05] bg-base-800/50 p-4 space-y-3 hover:border-white/[0.1] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Host</p>
                        <p className="text-base font-bold text-slate-200 truncate">{game.hostName}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Room</p>
                        <p className="font-mono text-sm text-primary font-bold">{game.id}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Tag label={game.categoryLabel} />
                      <Tag label={capitalize(game.difficulty)} />
                      <Tag label={`${game.currentPlayerCount}/${game.maxPlayers}`} />
                    </div>

                    <Button
                      onClick={() => handleJoin(game.id)}
                      size="sm"
                      className="w-full justify-center"
                    >
                      Join Lobby
                    </Button>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-white/[0.06] bg-base-800/30 p-8 text-center">
                    <p className="text-slate-500 text-sm">No public lobbies open right now.</p>
                    <p className="text-slate-600 text-xs mt-1">Be the first to host one!</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </motion.div>
      </section>

      {/* How to play */}
      <section className="py-12 sm:py-16 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-slate-300 mb-10">How to Play</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StepCard
              step="1"
              title="Host a Room"
              desc="Create a game, choose your settings, and invite friends with a link or QR code."
            />
            <StepCard
              step="2"
              title="Act It Out"
              desc="One player from each team sees a secret word and acts it out without speaking."
            />
            <StepCard
              step="3"
              title="Guess & Win"
              desc="Your teammates guess the word. Score points for correct guesses. First to the target wins!"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-white/[0.04] text-center">
        <button
          onClick={() => router.push('/admin/login')}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          Admin Portal
        </button>
      </footer>
    </main>
  );
}

function Tag({ label }) {
  return (
    <span className="inline-flex px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs font-medium text-slate-400">
      {label}
    </span>
  );
}

function StepCard({ step, title, desc }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-base-900/50 p-6 text-center">
      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary font-black text-lg flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="text-base font-bold text-slate-200 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function capitalize(value) {
  const next = String(value || '');
  return next.charAt(0).toUpperCase() + next.slice(1);
}

