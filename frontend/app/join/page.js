'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStore } from '../store';
import { motion } from 'framer-motion';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Logo from '../../components/Logo';

export default function JoinGame() {
  const [gameId, setGameId] = useState('');
  const [username, setUsername] = useState('');
  const [teamId, setTeamId] = useState('team1');
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { joinGame, fetchGamePreview, gamePreview, lastError, clearError } = useGameStore();

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setGameId(id.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;

    async function loadPreview() {
      setLookupLoading(true);
      clearError();

      try {
        const preview = await fetchGamePreview(gameId);
        if (!cancelled) {
          const defaultTeam = Object.keys(preview.teams || {})[0] || 'team1';
          setTeamId((current) => (preview.teams?.[current] ? current : defaultTeam));
        }
      } catch (error) {
        if (!cancelled) console.error(error);
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }

    loadPreview();
    return () => { cancelled = true; };
  }, [clearError, fetchGamePreview, gameId]);

  const teamEntries = useMemo(
    () => Object.entries(gamePreview?.teams || {}),
    [gamePreview]
  );

  const handleJoin = async () => {
    if (!gameId || !username || !teamId) return;

    setLoading(true);
    clearError();

    try {
      await joinGame(gameId, username, teamId);
      router.push('/lobby');
    } catch (error) {
      console.error('Join failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-6">
          <Logo size="lg" className="justify-center mb-2" />
          <p className="text-slate-500 text-sm">Enter the room code and join the fun.</p>
        </div>

        <Card className="p-6 sm:p-8">
          <div className="space-y-5">
            <FormField label="Room Code">
              <input
                value={gameId}
                onChange={(event) => setGameId(event.target.value.toUpperCase())}
                placeholder="ABC123"
                className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-lg font-bold text-center text-slate-200 placeholder-slate-600 tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/20"
                inputMode="text"
                maxLength={8}
              />
            </FormField>

            <FormField label="Your Name">
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your name"
                maxLength={24}
                className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-base font-semibold text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/20"
              />
            </FormField>

            <FormField label="Choose Team">
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                disabled={!teamEntries.length || gamePreview?.status !== 'lobby'}
                className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-base font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              >
                {teamEntries.length ? (
                  teamEntries.map(([currentTeamId, team], index) => (
                    <option key={currentTeamId} value={currentTeamId} disabled={team.isFull}>
                      Team {index + 1} {team.isFull ? '(Full)' : `(${team.playerCount}/${gamePreview.playersPerTeam})`}
                    </option>
                  ))
                ) : (
                  <option value="team1">Enter a room code first</option>
                )}
              </select>
            </FormField>

            {gamePreview && (
              <div className="rounded-xl border border-white/[0.05] bg-base-800/40 px-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <PreviewStat label="Status" value={capitalize(gamePreview.status)} />
                  <PreviewStat label="Visibility" value={capitalize(gamePreview.visibility || 'private')} />
                  <PreviewStat label="Category" value={formatLabel(gamePreview.category || 'random')} />
                  <PreviewStat label="Difficulty" value={capitalize(gamePreview.difficulty || 'mixed')} />
                </div>
              </div>
            )}

            <Button
              onClick={handleJoin}
              disabled={
                loading ||
                lookupLoading ||
                !gameId ||
                !username.trim() ||
                !teamEntries.length ||
                gamePreview?.status !== 'lobby'
              }
              size="lg"
              className="w-full justify-center"
            >
              {loading ? 'Joining...' : lookupLoading ? 'Loading...' : 'Join Game'}
            </Button>

            {lastError && (
              <div className="text-center text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm">
                {lastError}
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </main>
  );
}

function FormField({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function PreviewStat({ label, value }) {
  return (
    <div className="rounded-lg bg-base-900/60 border border-white/[0.04] px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-primary">{value}</div>
    </div>
  );
}

function capitalize(value) {
  const next = String(value || '');
  return next.charAt(0).toUpperCase() + next.slice(1);
}

function formatLabel(value) {
  if (value === 'random') return 'Random';
  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

