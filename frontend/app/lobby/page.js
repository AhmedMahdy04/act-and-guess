'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useGameStore } from '../store';
import TeamList from '../../components/TeamList';
import GameSettingsFields, { formatLabel, getSettingsProblem } from '../../components/GameSettingsFields';
import RoomUnavailable from '../../components/RoomUnavailable';
import AdBanner from '../../components/AdBanner';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function Lobby() {
  const [pending, setPending] = useState('');
  const [notice, setNotice] = useState('');
  const [joinLink, setJoinLink] = useState('');
  const router = useRouter();
  const {
    game, players, teams, isHost, gameId, lastError, wordCatalog, catalogStatus,
    connectionStatus, sessionStatus, startGame, updateGameSettings, movePlayer, transferHost, leaveGame, kickPlayer
  } = useGameStore();

  useEffect(() => {
    setJoinLink(gameId ? `${window.location.origin}/join?id=${encodeURIComponent(gameId)}` : '');
  }, [gameId]);

  if (!game) return <RoomUnavailable />;

  const totalPlayers = Object.keys(players).length;
  const readyTeams = Object.values(teams).filter((team) => (
    team.players.filter((playerId) => players[playerId]?.connected).length >= 2
  )).length;
  const inLobby = game.status === 'lobby';
  const canAct = !pending && connectionStatus === 'online' && sessionStatus === 'ready';
  const canStart = inLobby && canAct && readyTeams >= 2 && !getSettingsProblem(game, wordCatalog);
  const category = wordCatalog?.categoryDetails?.find(({ slug }) => slug === game.category);
  const settings = {
    teamCount: game.teamCount,
    playersPerTeam: game.playersPerTeam,
    targetScore: game.targetScore,
    roundTime: game.roundTime,
    visibility: game.visibility,
    category: game.category,
    difficulty: game.difficulty
  };
  const roster = Object.values(players).sort((left, right) => (
    Number(right.isHost) - Number(left.isHost) || left.username.localeCompare(right.username)
  ));

  async function act(name, action, message = '') {
    if (!canAct) return;
    setPending(name);
    setNotice('');
    try {
      await action();
      setNotice(message);
    } catch {
      // Server errors are displayed at the top of the lobby.
    } finally {
      setPending('');
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-300">Room <code className="ml-1 text-sm text-indigo-200">{gameId}</code></p>
          <h1 className="text-3xl font-black text-slate-100 sm:text-4xl">Game lobby</h1>
          <p className="mt-2 text-sm text-slate-300">Share the room code, then get your teams ready.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canAct}
          onClick={() => {
            if (window.confirm('Leave this lobby?')) {
              act('leave', async () => { await leaveGame(gameId); router.push('/'); });
            }
          }}
        >
          {pending === 'leave' ? 'Leaving…' : 'Leave lobby'}
        </Button>
      </header>

      {lastError && <p role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{lastError}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{notice}</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
        <div className="space-y-5">
          <Card className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-100">Ready to play?</h2>
              <p className="text-sm text-slate-300">{totalPlayers}/{game.teamCount * game.playersPerTeam} spots filled</p>
            </div>
            <p className="text-sm text-slate-300">
              {readyTeams} of {game.teamCount} teams ready. You need at least two teams with two connected players each.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
              {[formatLabel(game.visibility), category?.name || formatLabel(game.category), formatLabel(game.difficulty), `${game.roundTime}s rounds`, `${game.targetScore} points to win`].map((label, index) => (
                <span key={`${index}-${label}`} className="rounded-md border border-white/10 bg-base-800 px-2.5 py-1.5">{label}</span>
              ))}
            </div>
            {isHost ? (
              <Button onClick={() => act('start', () => startGame(gameId))} disabled={!canStart} size="lg" className="w-full">
                {pending === 'start' ? 'Starting…' : 'Start game'}
              </Button>
            ) : (
              <p className="rounded-xl border border-white/10 bg-base-800/60 px-4 py-3 text-sm text-slate-300">
                Waiting for {game.hostName || 'the host'} to start the game.
              </p>
            )}
          </Card>

          <TeamList teams={teams} players={players} maxPlayersPerTeam={game.playersPerTeam} />

          {isHost && inLobby && (
            <Card className="space-y-3 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-slate-100">Manage players</h2>
              {roster.map((player) => (
                <div key={player.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-base-800/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-100">{player.username}{player.isHost && <span className="ml-2 text-xs text-indigo-300">Host</span>}</p>
                    <p className="mt-1 text-xs text-slate-300">{teams[player.teamId]?.name} · {player.connected ? 'Connected' : 'Reconnecting'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <TeamMoveSelect player={player} teams={teams} maxPlayers={game.playersPerTeam} disabled={!canAct} onMove={(id) => act('move', () => movePlayer(gameId, player.id, id), `${player.username} moved to ${teams[id].name}.`)} />
                    {!player.isHost && (
                      <>
                        <Button variant="ghost" size="sm" disabled={!canAct || !player.connected} onClick={() => {
                          if (window.confirm(`Make ${player.username} the host?`)) act('transfer', () => transferHost(gameId, player.id));
                        }}>Make host</Button>
                        <Button variant="ghost" size="sm" disabled={!canAct} aria-label={`Remove ${player.username}`} onClick={() => {
                          if (window.confirm(`Remove ${player.username} from this lobby?`)) act('remove', () => kickPlayer(gameId, player.id), `${player.username} was removed.`);
                        }}>Remove</Button>
                        <Button variant="danger" size="sm" disabled={!canAct} aria-label={`Ban ${player.username}`} onClick={() => {
                          if (window.confirm(`Ban ${player.username} from this room?`)) act('ban', () => kickPlayer(gameId, player.id, true), `${player.username} was banned.`);
                        }}>Ban</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <InviteCard gameId={gameId} joinLink={joinLink} />

          {isHost && inLobby && (
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-bold text-slate-100">Room settings</h2>
              <p className="mb-4 mt-1 text-sm text-slate-300">Saved settings are shared with everyone in this lobby.</p>
              <SettingsForm
                key={`${gameId}-${Object.values(settings).join('-')}`}
                settings={settings}
                catalog={wordCatalog}
                catalogStatus={catalogStatus}
                disabled={!canAct}
                saving={pending === 'save'}
                onSave={(values) => act('save', () => updateGameSettings(gameId, values), 'Room settings saved.')}
              />
            </Card>
          )}
          <AdBanner />
        </div>
      </div>
    </main>
  );
}

function SettingsForm({ settings, catalog, catalogStatus, disabled, saving, onSave }) {
  const [draft, setDraft] = useState(settings);
  const changed = Object.keys(settings).some((key) => settings[key] !== draft[key]);
  const canSave = changed && !disabled && !getSettingsProblem(draft, catalog);

  return (
    <form onSubmit={(event) => { event.preventDefault(); if (canSave) onSave(draft); }} aria-busy={saving}>
      <fieldset disabled={disabled} className="space-y-4">
        <GameSettingsFields
          settings={draft}
          catalog={catalog}
          catalogStatus={catalogStatus}
          onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
        />
        <Button type="submit" variant="secondary" disabled={!canSave} className="w-full">
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </fieldset>
    </form>
  );
}

function InviteCard({ gameId, joinLink }) {
  const [copyStatus, setCopyStatus] = useState('');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopyStatus('Join link copied.');
    } catch {
      setCopyStatus('Select the join link above to copy it.');
    }
  }

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-bold text-slate-100">Invite friends</h2>
        <p className="mt-1 text-sm text-slate-300">Share code <strong className="font-mono text-indigo-300">{gameId}</strong>, send the link, or let friends scan the QR code.</p>
      </div>
      {joinLink && (
        <div className="mx-auto w-fit rounded-xl bg-white p-3">
          <QRCodeSVG value={joinLink} size={144} title="QR code for the room invite" />
        </div>
      )}
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-slate-300">Join link</span>
        <input
          value={joinLink}
          readOnly
          onFocus={(event) => event.target.select()}
          className="w-full rounded-xl border border-white/10 bg-base-800 px-4 py-3 font-mono text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </label>
      <Button variant="secondary" onClick={copyLink} size="sm" disabled={!joinLink} className="w-full">Copy join link</Button>
      {copyStatus && <p role="status" className="text-center text-sm text-slate-300">{copyStatus}</p>}
    </Card>
  );
}

function TeamMoveSelect({ player, teams, maxPlayers, disabled, onMove }) {
  const available = Object.values(teams).filter((team) => team.id !== player.teamId && team.players.length < maxPlayers);
  if (!available.length) return null;

  return (
    <select
      value=""
      onChange={(event) => { if (event.target.value) onMove(event.target.value); }}
      aria-label={`Move ${player.username} to another team`}
      disabled={disabled}
      className="rounded-lg border border-white/10 bg-base-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
    >
      <option value="">Move to…</option>
      {available.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.players.length}/{maxPlayers})</option>)}
    </select>
  );
}
