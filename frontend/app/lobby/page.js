'use client';

import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import TeamList from '../../components/TeamList';
import Scoreboard from '../../components/Scoreboard';
import { useGameStore } from '../store';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function Lobby() {
  const [starting, setStarting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState({
    teamCount: 2,
    playersPerTeam: 3,
    targetScore: 10,
    roundTime: 30,
    visibility: 'private',
    category: 'random',
    difficulty: 'mixed'
  });

  const {
    game,
    players,
    teams,
    status,
    isHost,
    startGame,
    gameId,
    lastError,
    clearError,
    fetchWordCatalog,
    wordCatalog,
    updateGameSettings,
    movePlayer,
    transferHost,
    leaveGame,
    kickPlayer
  } = useGameStore();

  useEffect(() => {
    fetchWordCatalog().catch(() => {});
  }, [fetchWordCatalog]);

  useEffect(() => {
    if (!game) return;
    setSettings({
      teamCount: game.teamCount,
      playersPerTeam: game.playersPerTeam,
      targetScore: game.targetScore,
      roundTime: game.roundTime,
      visibility: game.visibility || 'private',
      category: game.category || 'random',
      difficulty: game.difficulty || 'mixed'
    });
  }, [game]);

  const joinLink = useMemo(() => {
    if (!gameId || typeof window === 'undefined') return '';
    return `${window.location.origin}/join?id=${gameId}`;
  }, [gameId]);

  const categoryOptions = useMemo(
    () => wordCatalog?.categoryOptions || ['random'],
    [wordCatalog]
  );

  const totalPlayers = Object.keys(players).length;
  const totalSlots = game ? game.teamCount * game.playersPerTeam : 0;
  const readyTeams = Object.values(teams).filter((team) => (
    team.players?.filter((playerId) => players[playerId]?.connected !== false).length >= 2
  )).length;
  const canStart = Boolean(game) && Object.values(teams).every((team) => (
    team.players?.filter((playerId) => players[playerId]?.connected !== false).length >= 2
  ));

  const roster = Object.values(players).sort((left, right) => {
    if (left.isHost) return -1;
    if (right.isHost) return 1;
    return left.username.localeCompare(right.username);
  });

  if (!game) {
    return (
      <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-8">
        <Card className="p-8 sm:p-12 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary text-3xl flex items-center justify-center mx-auto mb-5">
            🎭
          </div>
          <h1 className="text-2xl font-bold text-slate-200 mb-2">No Active Game</h1>
          <p className="text-slate-500 text-sm mb-6">Create a new game or join an existing one to open the lobby.</p>
          <Button onClick={() => window.location.href = '/create'}>Host a Game</Button>
        </Card>
      </main>
    );
  }

  const handleStartGame = async () => {
    setStarting(true);
    clearError();
    try {
      await startGame(game.id);
    } catch (error) {
      console.error(error);
    } finally {
      setStarting(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    clearError();
    try {
      await updateGameSettings(game.id, settings);
    } catch (error) {
      console.error(error);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Leave this lobby and return to the home page?')) return;
    clearError();
    try {
      await leaveGame(game.id);
    } catch (error) {
      console.error(error);
      window.location.href = '/';
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="mb-8 sm:mb-10"
      >
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-2">Game Lobby</h1>
          <div className="inline-flex items-center gap-3 bg-base-800 border border-white/[0.06] rounded-full px-5 py-2">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Room</span>
            <code className="font-mono text-primary font-bold text-sm">{game.id || gameId}</code>
            <button
              onClick={() => navigator.clipboard.writeText(game.id || gameId)}
              className="text-slate-500 hover:text-slate-300 transition-colors text-xs"
              title="Copy code"
            >
              Copy
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5 sm:gap-6 items-start">
        <div className="space-y-5">
          <TeamList teams={teams} players={players} maxPlayersPerTeam={game.playersPerTeam} />
          <Scoreboard teams={teams} />
        </div>

        <div className="space-y-5">
          {/* Status */}
          <Card className="p-5 sm:p-6">
            <h3 className="text-lg font-bold text-slate-200 mb-4">Lobby Status</h3>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <StatusPill label="Players" value={`${totalPlayers}/${totalSlots}`} />
              <StatusPill label="Ready" value={`${readyTeams}/${game.teamCount}`} />
              <StatusPill label="Round" value={`${game.roundTime}s`} />
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              <Tag label={capitalize(game.visibility)} />
              <Tag label={formatLabel(game.category)} />
              <Tag label={capitalize(game.difficulty)} />
            </div>

            {isHost && status === 'lobby' && (
              <Button
                onClick={handleStartGame}
                disabled={!canStart || starting}
                size="lg"
                className="w-full justify-center mb-3"
              >
                {starting
                  ? 'Starting...'
                  : canStart
                    ? 'Start Game'
                    : 'Need 2+ players per team'}
              </Button>
            )}

            {!isHost && (
              <p className="text-center text-slate-500 text-sm py-3 mb-3">
                Waiting for the host to start the game.
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleLeave}
              className="w-full justify-center"
            >
              Leave Lobby
            </Button>
          </Card>

          {/* Invite */}
          <Card className="p-5 sm:p-6">
            <h3 className="text-lg font-bold text-slate-200 mb-4">Invite Players</h3>
            <div className="flex flex-col gap-4 items-center">
              {joinLink && (
                <div className="bg-white rounded-xl p-2.5 shadow-lg">
                  <QRCodeSVG value={joinLink} size={160} />
                </div>
              )}
              <input
                value={joinLink}
                readOnly
                className="w-full bg-base-800 border border-white/[0.06] rounded-xl px-4 py-3 font-mono text-xs text-center text-slate-400"
              />
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard.writeText(joinLink)}
                size="sm"
                className="w-full justify-center"
              >
                Copy Join Link
              </Button>
            </div>
          </Card>

          {/* Host Settings */}
          {isHost && (
            <Card className="p-5 sm:p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-200">Next Session Settings</h3>
              <p className="text-xs text-slate-500 -mt-3">Changes apply after returning to lobby</p>

              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Teams"
                  value={settings.teamCount}
                  min={2}
                  max={6}
                  onChange={(value) => setSettings((current) => ({
                    ...current,
                    teamCount: Math.min(6, Math.max(2, value || 2))
                  }))}
                />
                <NumberField
                  label="Players / Team"
                  value={settings.playersPerTeam}
                  min={2}
                  max={8}
                  onChange={(value) => setSettings((current) => ({
                    ...current,
                    playersPerTeam: Math.min(8, Math.max(2, value || 2))
                  }))}
                />
                <NumberField
                  label="Target Score"
                  value={settings.targetScore}
                  min={1}
                  max={50}
                  onChange={(value) => setSettings((current) => ({
                    ...current,
                    targetScore: Math.min(50, Math.max(1, value || 1))
                  }))}
                />
                <NumberField
                  label="Round Time"
                  value={settings.roundTime}
                  min={1}
                  max={60}
                  onChange={(value) => setSettings((current) => ({
                    ...current,
                    roundTime: Math.min(60, Math.max(1, value || 1))
                  }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SelectField
                  label="Visibility"
                  value={settings.visibility}
                  onChange={(value) => setSettings((current) => ({ ...current, visibility: value }))}
                  options={[
                    { value: 'private', label: 'Private' },
                    { value: 'public', label: 'Public' }
                  ]}
                />
                <SelectField
                  label="Difficulty"
                  value={settings.difficulty}
                  onChange={(value) => setSettings((current) => ({ ...current, difficulty: value }))}
                  options={[
                    { value: 'mixed', label: 'Mixed' },
                    { value: 'easy', label: 'Easy' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'hard', label: 'Hard' }
                  ]}
                />
                <SelectField
                  label="Category"
                  value={settings.category}
                  onChange={(value) => setSettings((current) => ({ ...current, category: value }))}
                  options={categoryOptions.map((option) => ({
                    value: option,
                    label: formatLabel(option)
                  }))}
                />
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                variant="secondary"
                className="w-full justify-center"
              >
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </Card>
          )}

          {/* Player Management */}
          {isHost && (
            <Card className="p-5 sm:p-6 space-y-3">
              <h3 className="text-lg font-bold text-slate-200">Players</h3>
              {roster.map((player) => (
                <div
                  key={player.id}
                  className="rounded-xl border border-white/[0.04] bg-base-800/40 px-4 py-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 text-sm truncate">
                        {player.username}
                        {player.isHost && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary font-bold">Host</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {teams[player.teamId]?.name || player.teamId} · {player.connected === false ? <span className="text-amber-500">Offline</span> : <span className="text-accent-emerald">Online</span>}
                      </div>
                    </div>
                    {!player.isHost && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          onClick={() => kickPlayer(game.id, player.id, false).catch(() => {})}
                          size="sm"
                        >
                          Kick
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => kickPlayer(game.id, player.id, true).catch(() => {})}
                          size="sm"
                        >
                          Ban
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Host controls: move team + transfer host */}
                  {isHost && !player.isHost && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <TeamMoveSelect
                        player={player}
                        teams={teams}
                        game={game}
                        onMove={(teamId) => movePlayer(game.id, player.id, teamId).catch(() => {})}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Make ${player.username} the new host?`)) {
                            transferHost(game.id, player.id).catch(() => {});
                          }
                        }}
                      >
                        Make Host
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}

          {/* Non-host: simple player list */}
          {!isHost && (
            <Card className="p-5 sm:p-6 space-y-3">
              <h3 className="text-lg font-bold text-slate-200">Players</h3>
              {roster.map((player) => (
                <div
                  key={player.id}
                  className="rounded-xl border border-white/[0.04] bg-base-800/40 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 text-sm truncate">
                      {player.username}
                      {player.isHost && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary font-bold">Host</span>}
                    </div>
                    <div className="text-xs text-slate-500">
                      {teams[player.teamId]?.name || player.teamId} · {player.connected === false ? <span className="text-amber-500">Offline</span> : <span className="text-accent-emerald">Online</span>}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {lastError && (
            <div className="text-center text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm">
              {lastError}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function TeamMoveSelect({ player, teams, game, onMove }) {
  const [value, setValue] = useState('');
  const available = Object.values(teams).filter(
    (t) => t.id !== player.teamId && t.players.length < game.playersPerTeam
  );

  if (!available.length) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => {
          const teamId = e.target.value;
          setValue('');
          if (teamId) onMove(teamId);
        }}
        className="bg-base-800 border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
      >
        <option value="">Move to...</option>
        {available.map((t) => (
          <option key={t.id} value={t.id}>{t.name} ({t.players.length}/{game.playersPerTeam})</option>
        ))}
      </select>
    </div>
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

function SelectField({ label, value, onChange, options }) {
  return (
    <FormField label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-base font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
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
        className="w-full bg-base-800 border border-white/[0.08] rounded-xl px-4 py-3.5 text-lg font-bold text-center text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </FormField>
  );
}

function StatusPill({ label, value }) {
  return (
    <div className="rounded-xl bg-base-800/60 border border-white/[0.04] px-3 py-2.5 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-200">{value}</div>
    </div>
  );
}

function Tag({ label }) {
  return (
    <span className="inline-flex px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs font-medium text-slate-400">
      {label}
    </span>
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

