'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore } from '../store';

import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Logo from '../../components/Logo';

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
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-4xl"
      >
        <div className="text-center mb-8">
          <Logo size="lg" className="justify-center mb-3" />
          <p className="text-slate-500 text-sm">Configure your game and launch the lobby.</p>
        </div>

        <Card className="p-6 sm:p-10">
          {canShowInvite ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="rounded-2xl border border-accent-emerald/20 bg-accent-emerald/5 p-6 sm:p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-accent-emerald/10 text-accent-emerald flex items-center justify-center text-3xl mx-auto mb-4">
                  ✓
                </div>
                <h2 className="text-2xl font-bold text-slate-100 mb-2">Game Created!</h2>
                <p className="text-slate-400 text-sm mb-1">
                  Room code: <span className="font-mono text-primary font-bold text-base">{gameId}</span>
                </p>
                <p className="text-slate-500 text-sm">
                  You joined as <span className="font-semibold text-slate-300">{username}</span> on{' '}
                  <span className="font-semibold text-slate-300">{game.teams?.[teamId]?.name || 'your team'}</span>
                </p>

                <div className="mt-6 flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <div className="bg-white rounded-xl p-3 shadow-lg">
                    <QRCodeSVG value={joinLink || gameId} size={160} />
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-sm">
                    <input
                      value={joinLink}
                      readOnly
                      className="bg-base-800 border border-white/[0.06] rounded-xl px-4 py-3 font-mono text-sm text-center text-slate-300"
                    />
                    <Button
                      onClick={() => navigator.clipboard.writeText(joinLink)}
                      size="lg"
                      className="w-full justify-center"
                    >
                      Copy Join Link
                    </Button>
                    <Button
                      onClick={() => router.push('/lobby')}
                      variant="secondary"
                      size="lg"
                      className="w-full justify-center"
                    >
                      Open Lobby
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Visibility" value={capitalize(config.visibility)} />
                <StatCard label="Category" value={formatLabel(config.category)} />
                <StatCard label="Difficulty" value={capitalize(config.difficulty)} />
                <StatCard label="Round Time" value={`${config.roundTime}s`} />
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Your Name">
                  <input
                    value={hostName}
                    onChange={(event) => setHostName(event.target.value)}
                    maxLength={24}
                    className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-base font-semibold text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/20"
                  />
                </FormField>
                <FormField label="Your Team">
                  <select
                    value={hostTeamId}
                    onChange={(event) => setHostTeamId(event.target.value)}
                    className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-base font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/20"
                  >
                    {teamOptions.map((currentTeamId, index) => (
                      <option key={currentTeamId} value={currentTeamId}>
                        Team {index + 1}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <NumberField
                  label="Teams"
                  value={config.teamCount}
                  min={2}
                  max={6}
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
                  min={2}
                  max={8}
                  onChange={(value) => setConfig((current) => ({
                    ...current,
                    playersPerTeam: Math.min(8, Math.max(2, value || 2))
                  }))}
                />
                <NumberField
                  label="Target Score"
                  value={config.targetScore}
                  min={1}
                  max={50}
                  onChange={(value) => setConfig((current) => ({
                    ...current,
                    targetScore: Math.min(50, Math.max(1, value || 1))
                  }))}
                />
                <NumberField
                  label="Round Time (s)"
                  value={config.roundTime}
                  min={1}
                  max={60}
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

              <div className="rounded-xl border border-white/[0.05] bg-base-800/40 px-5 py-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <CatalogStat label="Words Ready" value={`${wordCatalog?.totalWords || 0}`} />
                <CatalogStat label="Categories" value={`${Math.max(0, (categoryOptions?.length || 1) - 1)}`} />
                <CatalogStat label="Word Studio" value="Available in lobby" />
              </div>

              <Button
                onClick={handleCreate}
                disabled={loading || !hostName.trim()}
                size="xl"
                className="w-full justify-center"
              >
                {loading ? 'Creating...' : 'Launch Lobby'}
              </Button>

              {lastError && (
                <p className="text-center text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm">
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

function FormField({ label, children }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <FormField label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-base font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function NumberField({ label, value, onChange, min, max }) {
  return (
    <FormField label={label}>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
        min={min}
        max={max}
        className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-xl font-bold text-center text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/20"
      />
    </FormField>
  );
}

function CatalogStat({ label, value }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="font-bold text-slate-300">{value}</div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-base-800/50 p-4 text-center">
      <div className="text-lg font-bold text-slate-200">{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
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

