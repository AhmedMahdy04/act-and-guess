'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '../store';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import GameSettingsFields, { getSettingsProblem } from '../../components/GameSettingsFields';
import RoomUnavailable from '../../components/RoomUnavailable';

const initialSettings = {
  teamCount: 2,
  playersPerTeam: 3,
  targetScore: 10,
  roundTime: 30,
  visibility: 'private',
  category: 'random',
  difficulty: 'mixed'
};

export default function CreateGame() {
  const [settings, setSettings] = useState(initialSettings);
  const [hostName, setHostName] = useState('');
  const [hostTeamId, setHostTeamId] = useState('team1');
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const { createGame, wordCatalog, catalogStatus, gameId, lastError, sessionStatus, connectionStatus } = useGameStore();

  const teamCount = Math.min(6, Math.max(2, settings.teamCount || 2));
  const teams = Array.from({ length: teamCount }, (_, index) => `team${index + 1}`);
  const selectedTeam = teams.includes(hostTeamId) ? hostTeamId : 'team1';
  const canCreate = !creating && sessionStatus === 'ready' && connectionStatus === 'online'
    && hostName.trim() && !getSettingsProblem(settings, wordCatalog);

  async function handleCreate(event) {
    event.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    try {
      await createGame(settings, hostName.trim(), selectedTeam);
      router.replace('/lobby');
    } catch {
      // The store displays the server's error in this form.
    } finally {
      setCreating(false);
    }
  }

  if (gameId || sessionStatus !== 'ready') return <RoomUnavailable />;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-4xl flex-col justify-center px-4 py-10 sm:px-8">
      <header className="mb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-300">Set up your room</p>
        <h1 className="text-3xl font-black text-slate-100 sm:text-4xl">Host a game</h1>
        <p className="mt-2 text-slate-300">Choose your settings, then share the room code or QR code with friends.</p>
      </header>

      <Card className="p-5 sm:p-8">
        <form onSubmit={handleCreate} aria-busy={creating}>
          <fieldset disabled={creating} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-300">Your name</span>
                <input
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  maxLength={24}
                  autoComplete="nickname"
                  required
                  placeholder="e.g. Alex"
                  className="w-full rounded-xl border border-white/10 bg-base-800 px-4 py-3.5 text-base font-semibold text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-300">Your team</span>
                <select
                  value={selectedTeam}
                  onChange={(event) => setHostTeamId(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-base-800 px-4 py-3.5 text-base font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {teams.map((id, index) => <option key={id} value={id}>Team {index + 1}</option>)}
                </select>
              </label>
            </div>

            <GameSettingsFields
              settings={settings}
              onChange={(key, value) => setSettings((current) => ({ ...current, [key]: value }))}
              catalog={wordCatalog}
              catalogStatus={catalogStatus}
            />

            {lastError && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{lastError}</p>}
            <Button type="submit" disabled={!canCreate} size="lg" className="w-full">
              {creating ? 'Creating room…' : 'Open lobby'}
            </Button>
          </fieldset>
        </form>
      </Card>
    </main>
  );
}
