'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { normalizeRoomCode, ROOM_CODE_LENGTH, useGameStore } from '../store';
import { formatLabel } from '../../components/GameSettingsFields';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import RoomUnavailable from '../../components/RoomUnavailable';

const fieldClass = 'w-full rounded-xl border border-white/10 bg-base-800 px-4 py-3.5 text-base font-semibold text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50';

export default function JoinGame() {
  return (
    <Suspense fallback={<JoinLayout><p role="status" className="text-slate-300">Opening the join form…</p></JoinLayout>}>
      <JoinForm />
    </Suspense>
  );
}

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = normalizeRoomCode(searchParams.get('id') || '');
  const [code, setCode] = useState(inviteCode);
  const [username, setUsername] = useState('');
  const [teamId, setTeamId] = useState('');
  const [previewResult, setPreviewResult] = useState(null);
  const [joining, setJoining] = useState(false);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [requestedCode, setRequestedCode] = useState('');
  const { joinGame, fetchGamePreview, lastError, clearError, connectionStatus, sessionStatus, gameId } = useGameStore();

  useEffect(() => {
    setCode(inviteCode);
  }, [inviteCode]);

  const canLookUp = connectionStatus === 'online' && sessionStatus === 'ready' && !gameId;
  const lookupCode = canLookUp && (code.length === ROOM_CODE_LENGTH || code === inviteCode || code === requestedCode) ? code : '';

  useEffect(() => {
    if (!lookupCode) return;

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const preview = await fetchGamePreview(lookupCode);
        if (active) setPreviewResult({ code: lookupCode, lookupAttempt, preview });
      } catch (error) {
        if (active) setPreviewResult({ code: lookupCode, lookupAttempt, error: error.message });
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [fetchGamePreview, lookupAttempt, lookupCode]);

  const result = previewResult?.code === code && previewResult?.lookupAttempt === lookupAttempt ? previewResult : null;
  const preview = result?.preview;
  const teams = Object.values(preview?.teams || {});
  const selectedTeam = teams.find((team) => team.id === teamId && !team.isFull) || teams.find((team) => !team.isFull);
  const lookingUp = Boolean(lookupCode && !result);
  const canJoin = !joining && connectionStatus === 'online' && sessionStatus === 'ready'
    && Boolean(username.trim() && selectedTeam && preview?.status === 'lobby');

  async function handleJoin(event) {
    event.preventDefault();
    if (!canJoin) return;
    setJoining(true);
    try {
      await joinGame(code, username.trim(), selectedTeam.id);
      router.replace('/lobby');
    } catch {
      setLookupAttempt((current) => current + 1);
    } finally {
      setJoining(false);
    }
  }

  if (gameId || sessionStatus !== 'ready') return <RoomUnavailable />;

  return (
    <JoinLayout>
      <form onSubmit={handleJoin} aria-busy={joining}>
        <fieldset disabled={joining} className="space-y-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-300">Room code</span>
            <input
              value={code}
              onChange={(event) => {
                setCode(normalizeRoomCode(event.target.value));
                setPreviewResult(null);
                setRequestedCode('');
                clearError();
              }}
              placeholder="ABC123"
              className={`${fieldClass} text-center tracking-widest`}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={ROOM_CODE_LENGTH}
              required
              aria-describedby="room-lookup"
            />
          </label>

          <div id="room-lookup" className="text-sm text-slate-300" role="status">
            {lookingUp && 'Looking up your room…'}
            {canLookUp && code && !lookupCode && (
              <Button variant="ghost" size="sm" onClick={() => setRequestedCode(code)}>Find room</Button>
            )}
            {result?.error && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-rose-200">{result.error}</span>
                <Button variant="ghost" size="sm" onClick={() => setLookupAttempt((current) => current + 1)}>Retry</Button>
              </div>
            )}
            {preview?.status === 'lobby' && (selectedTeam ? `Hosted by ${preview.hostName}` : 'This lobby is full.')}
            {preview && preview.status !== 'lobby' && 'This room is already in play or has finished.'}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-300">Your name</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. Alex"
              maxLength={24}
              autoComplete="nickname"
              required
              className={fieldClass}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-300">Choose a team</span>
            <select
              value={selectedTeam?.id || ''}
              onChange={(event) => setTeamId(event.target.value)}
              disabled={!selectedTeam || preview?.status !== 'lobby'}
              className={fieldClass}
            >
              {!selectedTeam && <option value="">{teams.length ? 'No spots available' : 'Enter a room code first'}</option>}
              {teams.map((team) => (
                <option key={team.id} value={team.id} disabled={team.isFull}>
                  {team.name} {team.isFull ? '· Full' : `· ${team.playerCount}/${preview.playersPerTeam}`}
                </option>
              ))}
            </select>
          </label>

          {preview && (
            <p className="rounded-xl border border-white/10 bg-base-800/50 px-4 py-3 text-sm text-slate-300">
              {preview.categoryLabel || formatLabel(preview.category)} · {formatLabel(preview.difficulty)} difficulty · {preview.roundTime}s rounds
            </p>
          )}
          {lastError && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{lastError}</p>}
          <Button type="submit" disabled={!canJoin} size="lg" className="w-full">
            {joining ? 'Joining…' : 'Join lobby'}
          </Button>
        </fieldset>
      </form>
    </JoinLayout>
  );
}

function JoinLayout({ children }) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
      <header className="mb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-300">Room invite</p>
        <h1 className="text-3xl font-black text-slate-100 sm:text-4xl">Join a game</h1>
        <p className="mt-2 text-slate-300">Enter your friend’s room code and pick an open team.</p>
      </header>
      <Card className="p-5 sm:p-8">{children}</Card>
    </main>
  );
}

