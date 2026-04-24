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
  const [addingWord, setAddingWord] = useState(false);
  const [settings, setSettings] = useState({
    teamCount: 2,
    playersPerTeam: 3,
    targetScore: 10,
    roundTime: 30,
    visibility: 'private',
    category: 'random',
    difficulty: 'mixed'
  });
  const [wordForm, setWordForm] = useState({
    word: '',
    category: 'food',
    difficulty: 'medium'
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
    addWord,
    kickPlayer
  } = useGameStore();

  useEffect(() => {
    fetchWordCatalog().catch(() => {});
  }, [fetchWordCatalog]);

  useEffect(() => {
    if (!game) {
      return;
    }

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
    if (!gameId || typeof window === 'undefined') {
      return '';
    }

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
      <main className="min-h-screen flex items-center justify-center p-4 sm:p-8">
        <Card className="p-6 sm:p-10 text-center">
          <h1 className="text-4xl font-black mb-3">No Active Game</h1>
          <p className="opacity-80">Create a new game or join an existing one to open the lobby.</p>
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

  const handleAddWord = async () => {
    setAddingWord(true);
    clearError();

    try {
      await addWord({
        gameId: game.id,
        word: wordForm.word,
        category: wordForm.category,
        difficulty: wordForm.difficulty
      });
      setWordForm((current) => ({ ...current, word: '' }));
    } catch (error) {
      console.error(error);
    } finally {
      setAddingWord(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="text-center mb-10 sm:mb-12"
      >
        <h1 className="text-4xl sm:text-6xl font-black mb-3 bg-gradient-to-r from-purple-400 via-blue-400 to-pink-500 bg-clip-text text-transparent">
          Game Lobby
        </h1>
        <p className="text-base sm:text-2xl opacity-90">
          Game ID:{' '}
          <code className="bg-black/20 px-4 py-2 rounded-full font-mono text-sm sm:text-lg">
            {game.id || gameId}
          </code>
        </p>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6 sm:gap-10 items-start">
        <div className="space-y-6">
          <TeamList teams={teams} players={players} maxPlayersPerTeam={game.playersPerTeam} />
          <Scoreboard teams={teams} />
        </div>

        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <h3 className="text-2xl sm:text-3xl font-black mb-5 text-center">Lobby Status</h3>
            <div className="grid grid-cols-2 gap-3 text-sm sm:text-base">
              <StatusPill label="Players" value={`${totalPlayers}/${totalSlots}`} />
              <StatusPill label="Ready Teams" value={`${readyTeams}/${game.teamCount}`} />
              <StatusPill label="Visibility" value={capitalize(game.visibility)} />
              <StatusPill label="Round" value={`${game.roundTime}s`} />
              <StatusPill label="Category" value={formatLabel(game.category)} />
              <StatusPill label="Difficulty" value={capitalize(game.difficulty)} />
            </div>

            {isHost && status === 'lobby' && (
              <Button
                onClick={handleStartGame}
                disabled={!canStart || starting}
                className="mt-6 w-full justify-center py-5 px-6 text-2xl"
              >
                {starting
                  ? 'Starting...'
                  : canStart
                    ? 'Start Session'
                    : 'Need 2 Connected Players Per Team'}
              </Button>
            )}

            {!isHost && (
              <p className="mt-6 text-center opacity-80">
                Waiting for the host to start the game.
              </p>
            )}
          </Card>

          <Card className="p-6 sm:p-8">
            <h3 className="text-2xl sm:text-3xl font-black mb-5 text-center">Invite Players</h3>
            <div className="flex flex-col gap-5 items-center">
              {joinLink && (
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                  <QRCodeSVG value={joinLink} size={180} />
                </div>
              )}
              <input
                value={joinLink}
                readOnly
                className="w-full bg-black/20 border border-white/15 p-4 rounded-2xl font-mono text-center text-sm"
              />
              <Button
                variant="ghost"
                onClick={() => navigator.clipboard.writeText(joinLink)}
                className="w-full justify-center py-3 px-6 font-black text-base"
              >
                Copy Join Link
              </Button>
            </div>
          </Card>

          {isHost && (
            <Card className="p-6 sm:p-8 space-y-5">
              <h3 className="text-2xl sm:text-3xl font-black text-center">Host Controls</h3>

              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Teams"
                  value={settings.teamCount}
                  min="2"
                  max="6"
                  onChange={(value) => setSettings((current) => ({
                    ...current,
                    teamCount: Math.min(6, Math.max(2, value || 2))
                  }))}
                />
                <NumberField
                  label="Players / Team"
                  value={settings.playersPerTeam}
                  min="2"
                  max="8"
                  onChange={(value) => setSettings((current) => ({
                    ...current,
                    playersPerTeam: Math.min(8, Math.max(2, value || 2))
                  }))}
                />
                <NumberField
                  label="Target Score"
                  value={settings.targetScore}
                  min="1"
                  max="50"
                  onChange={(value) => setSettings((current) => ({
                    ...current,
                    targetScore: Math.min(50, Math.max(1, value || 1))
                  }))}
                />
                <NumberField
                  label="Round Time"
                  value={settings.roundTime}
                  min="1"
                  max="60"
                  onChange={(value) => setSettings((current) => ({
                    ...current,
                    roundTime: Math.min(60, Math.max(1, value || 1))
                  }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                className="w-full justify-center py-4 text-lg"
              >
                {savingSettings ? 'Saving...' : 'Save Next Session Settings'}
              </Button>
            </Card>
          )}

          {isHost && (
            <Card className="p-6 sm:p-8 space-y-5">
              <h3 className="text-2xl sm:text-3xl font-black text-center">Word Studio</h3>

              <label className="flex flex-col gap-2">
                <span className="font-bold opacity-90">New Word</span>
                <input
                  value={wordForm.word}
                  onChange={(event) => setWordForm((current) => ({ ...current, word: event.target.value }))}
                  placeholder="Add a new word or phrase"
                  className="bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="font-bold opacity-90">Category</span>
                  <input
                    list="word-categories"
                    value={wordForm.category}
                    onChange={(event) => setWordForm((current) => ({ ...current, category: event.target.value }))}
                    className="bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <datalist id="word-categories">
                    {categoryOptions.filter((option) => option !== 'random').map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </label>

                <SelectField
                  label="Difficulty"
                  value={wordForm.difficulty}
                  onChange={(value) => setWordForm((current) => ({ ...current, difficulty: value }))}
                  options={[
                    { value: 'easy', label: 'Easy' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'hard', label: 'Hard' }
                  ]}
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm opacity-85">
                {wordCatalog?.totalWords || 0} words in the live catalog across {Math.max(0, categoryOptions.length - 1)} categories.
              </div>

              <Button
                onClick={handleAddWord}
                disabled={addingWord || !wordForm.word.trim() || !wordForm.category.trim()}
                className="w-full justify-center py-4 text-lg"
              >
                {addingWord ? 'Adding...' : 'Add Word To Live Catalog'}
              </Button>
            </Card>
          )}

          {isHost && (
            <Card className="p-6 sm:p-8 space-y-4">
              <h3 className="text-2xl sm:text-3xl font-black text-center">Moderation</h3>
              {roster.map((player) => (
                <div
                  key={player.id}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-black text-lg">
                      {player.username}
                      {player.isHost ? ' (Host)' : ''}
                    </div>
                    <div className="text-sm opacity-70">
                      {teams[player.teamId]?.name || player.teamId} • {player.connected === false ? 'Offline' : 'Online'}
                    </div>
                  </div>
                  {!player.isHost && (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => kickPlayer(game.id, player.id, false).catch(() => {})}
                        className="px-4 py-2 text-sm"
                      >
                        Kick
                      </Button>
                      <Button
                        onClick={() => kickPlayer(game.id, player.id, true).catch(() => {})}
                        className="px-4 py-2 text-sm"
                      >
                        Ban
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}

          {lastError && (
            <div className="text-center text-red-200 bg-red-500/20 border border-red-300/30 rounded-2xl px-4 py-3">
              {lastError}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatusPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.18em] opacity-60">{label}</div>
      <div className="mt-1 font-black">{value}</div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-bold opacity-90">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
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
    <label className="flex flex-col gap-2">
      <span className="font-bold opacity-90">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
        min={min}
        max={max}
        className="bg-white/10 border border-white/20 rounded-2xl px-4 py-4 text-xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </label>
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
