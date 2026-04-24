'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore } from '../store';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function CreateGame() {
  const [config, setConfig] = useState({
    teamCount: 2,
    playersPerTeam: 3,
    targetScore: 10,
    roundTime: 30,
    visibility: 'private',
    category: 'random',
    difficulty: 'mixed'
  });
  const [hostName, setHostName] = useState('Host');
  const [hostTeamId, setHostTeamId] = useState('team1');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const {
    createGame,
    fetchWordCatalog,
    wordCatalog,
    gameId,
    game,
    isHost,
    lastError,
    clearError,
    username,
    teamId
  } = useGameStore();

  useEffect(() => {
    fetchWordCatalog().catch(() => {});
  }, [fetchWordCatalog]);

  const teamOptions = useMemo(
    () => Array.from({ length: config.teamCount }, (_, index) => `team${index + 1}`),
    [config.teamCount]
  );

  const categoryOptions = useMemo(
    () => wordCatalog?.categoryOptions || ['random'],
    [wordCatalog]
  );

  const canShowInvite = Boolean(isHost && gameId && game);
  const joinLink = useMemo(() => {
    if (!canShowInvite || typeof window === 'undefined') {
      return '';
    }

    return `${window.location.origin}/join?id=${gameId}`;
  }, [canShowInvite, gameId]);

  const handleCreate = async () => {
    setLoading(true);
    clearError();

    try {
      await createGame(config, hostName, hostTeamId);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-5xl"
      >
        <Card className="p-6 sm:p-10 w-full">
          <h1 className="text-4xl sm:text-5xl font-black mb-10 text-center bg-gradient-to-r from-purple-400 via-blue-400 to-pink-500 bg-clip-text text-transparent">
            Create Your Game
          </h1>

          {canShowInvite ? (
            <div className="space-y-8">
              <div className="bg-gradient-to-br from-emerald-500/70 to-green-600/70 p-7 rounded-3xl border border-white/10">
                <h2 className="text-3xl font-black mb-2">Game Created!</h2>
                <p className="text-base sm:text-xl mb-3 opacity-95">
                  Game ID:{' '}
                  <code className="bg-black/20 px-3 py-1 rounded-full font-mono text-white">
                    {gameId}
                  </code>
                </p>
                <p className="text-lg opacity-90">
                  You joined as <span className="font-bold">{username}</span> on{' '}
                  {game.teams?.[teamId]?.name || 'your team'}.
                </p>

                <div className="mt-7 flex flex-col md:flex-row gap-6 justify-center items-center">
                  <div className="bg-white/10 border border-white/20 p-4 rounded-2xl">
                    <QRCodeSVG value={joinLink || gameId} size={200} />
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-md">
                    <input
                      value={joinLink}
                      readOnly
                      className="bg-black/25 p-4 rounded-2xl font-mono text-base sm:text-lg text-center border border-white/15"
                    />
                    <Button
                      onClick={() => navigator.clipboard.writeText(joinLink)}
                      className="w-full py-4 text-lg"
                    >
                      Copy Join Link
                    </Button>
                    <Button
                      onClick={() => router.push('/lobby')}
                      variant="secondary"
                      className="w-full py-4 text-lg"
                    >
                      Open Lobby Controls
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <StatCard label="Visibility" value={capitalize(config.visibility)} />
                <StatCard label="Category" value={formatLabel(config.category)} />
                <StatCard label="Difficulty" value={capitalize(config.difficulty)} />
                <StatCard label="Round Time" value={`${config.roundTime}s`} />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex flex-col space-y-2">
                  <span className="font-bold opacity-90">Your Name</span>
                  <input
                    value={hostName}
                    onChange={(event) => setHostName(event.target.value)}
                    maxLength={24}
                    className="bg-white/10 p-4 rounded-2xl text-xl font-bold border border-white/15 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="flex flex-col space-y-2">
                  <span className="font-bold opacity-90">Your Team</span>
                  <select
                    value={hostTeamId}
                    onChange={(event) => setHostTeamId(event.target.value)}
                    className="bg-white/10 p-4 rounded-2xl text-xl font-bold border border-white/15 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {teamOptions.map((currentTeamId, index) => (
                      <option key={currentTeamId} value={currentTeamId}>
                        Team {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Teams"
                  value={config.teamCount}
                  min="2"
                  max="6"
                  onChange={(value) => {
                    const safeTeamCount = Math.min(6, Math.max(2, value || 2));
                    setConfig((current) => ({ ...current, teamCount: safeTeamCount }));
                    setHostTeamId((current) => {
                      const teamIndex = Number.parseInt(current.replace('team', ''), 10) || 1;
                      return teamIndex > safeTeamCount ? 'team1' : current;
                    });
                  }}
                />
                <NumberField
                  label="Players / Team"
                  value={config.playersPerTeam}
                  min="2"
                  max="8"
                  onChange={(value) => setConfig((current) => ({
                    ...current,
                    playersPerTeam: Math.min(8, Math.max(2, value || 2))
                  }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Target Score"
                  value={config.targetScore}
                  min="1"
                  max="50"
                  onChange={(value) => setConfig((current) => ({
                    ...current,
                    targetScore: Math.min(50, Math.max(1, value || 1))
                  }))}
                />
                <NumberField
                  label="Round Time (s)"
                  value={config.roundTime}
                  min="1"
                  max="60"
                  onChange={(value) => setConfig((current) => ({
                    ...current,
                    roundTime: Math.min(60, Math.max(1, value || 1))
                  }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SelectField
                  label="Visibility"
                  value={config.visibility}
                  onChange={(value) => setConfig((current) => ({ ...current, visibility: value }))}
                  options={[
                    { value: 'private', label: 'Private' },
                    { value: 'public', label: 'Public' }
                  ]}
                />
                <SelectField
                  label="Difficulty"
                  value={config.difficulty}
                  onChange={(value) => setConfig((current) => ({ ...current, difficulty: value }))}
                  options={[
                    { value: 'mixed', label: 'Mixed' },
                    { value: 'easy', label: 'Easy' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'hard', label: 'Hard' }
                  ]}
                />
                <SelectField
                  label="Category"
                  value={config.category}
                  onChange={(value) => setConfig((current) => ({ ...current, category: value }))}
                  options={categoryOptions.map((option) => ({
                    value: option,
                    label: formatLabel(option)
                  }))}
                />
              </div>

              <div className="rounded-3xl border border-white/15 bg-black/20 px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm sm:text-base">
                <div>
                  <div className="opacity-60 uppercase tracking-[0.16em] text-[11px]">Catalog</div>
                  <div className="font-black">{wordCatalog?.totalWords || 0} words ready</div>
                </div>
                <div>
                  <div className="opacity-60 uppercase tracking-[0.16em] text-[11px]">Categories</div>
                  <div className="font-black">{Math.max(0, (categoryOptions?.length || 1) - 1)} live groups</div>
                </div>
                <div>
                  <div className="opacity-60 uppercase tracking-[0.16em] text-[11px]">Word Studio</div>
                  <div className="font-black">Add more words from the lobby</div>
                </div>
              </div>

              <Button
                onClick={handleCreate}
                disabled={loading || !hostName.trim()}
                className="w-full justify-center py-8 px-8 text-3xl"
              >
                {loading ? 'Creating...' : 'Launch Lobby'}
              </Button>

              {lastError && (
                <p className="text-center text-red-200 bg-red-500/20 border border-red-300/30 rounded-2xl px-4 py-3">
                  {lastError}
                </p>
              )}
            </div>
          )}
        </Card>
      </motion.div>
    </main>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col space-y-2">
      <span className="font-bold opacity-90">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-white/10 p-4 rounded-2xl text-lg font-bold border border-white/15 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({ label, value, onChange, min, max }) {
  return (
    <label className="flex flex-col space-y-2">
      <span className="font-bold opacity-90">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
        min={min}
        max={max}
        className="bg-white/10 p-4 rounded-2xl text-2xl font-bold text-center border border-white/15 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
      <div className="text-2xl sm:text-3xl font-black tracking-tight">{value}</div>
      <div className="mt-2 text-sm sm:text-base font-bold opacity-90">{label}</div>
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
