'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGameStore } from '../store';
import { motion } from 'framer-motion';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

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
      setGameId(id);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!gameId) {
      return;
    }

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
        if (!cancelled) {
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          setLookupLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      cancelled = true;
    };
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
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <Card className="p-6 sm:p-10">
          <div className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-purple-400 via-blue-400 to-pink-500 bg-clip-text text-transparent">
              Join Game
            </h1>
            <p className="mt-2 text-sm sm:text-base opacity-80">
              Enter the code, pick your team, and join the party.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold opacity-90 mb-2 text-left px-2">
                Game Code
              </label>
              <input
                value={gameId}
                onChange={(event) => setGameId(event.target.value)}
                placeholder="e.g. game_123"
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                inputMode="text"
              />
            </div>

            <div>
              <label className="block text-sm font-bold opacity-90 mb-2 text-left px-2">
                Your Name
              </label>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your name"
                maxLength={24}
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm font-bold opacity-90 mb-2 text-left px-2">
                Choose Team
              </label>
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                disabled={!teamEntries.length || gamePreview?.status !== 'lobby'}
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {teamEntries.length ? (
                  teamEntries.map(([currentTeamId, team], index) => (
                    <option key={currentTeamId} value={currentTeamId} disabled={team.isFull}>
                      Team {index + 1}{' '}
                      {team.isFull ? '(Full)' : `(${team.playerCount}/${gamePreview.playersPerTeam})`}
                    </option>
                  ))
                ) : (
                  <option value="team1">Enter a game code first</option>
                )}
              </select>
            </div>

            {gamePreview && (
              <div className="rounded-2xl border border-white/15 bg-black/20 px-4 py-4 text-sm opacity-90">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <PreviewStat label="Status" value={gamePreview.status} />
                  <PreviewStat label="Visibility" value={gamePreview.visibility || 'private'} />
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
              className="w-full justify-center py-6 px-8 text-2xl"
            >
              {loading ? 'Joining...' : lookupLoading ? 'Loading Teams...' : '🎉 Join Game'}
            </Button>

            {lastError && (
              <div className="text-center text-red-200 bg-red-500/20 border border-red-300/30 rounded-2xl px-4 py-3">
                {lastError}
              </div>
            )}
          </div>
        </Card>
      </motion.div>
    </main>
  );
}

function PreviewStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.18em] opacity-60">{label}</div>
      <div className="mt-1 font-black text-primary">{value}</div>
    </div>
  );
}

function capitalize(value) {
  const next = String(value || '');
  return next.charAt(0).toUpperCase() + next.slice(1);
}

function formatLabel(value) {
  if (value === 'random') {
    return 'Random';
  }

  return String(value || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
