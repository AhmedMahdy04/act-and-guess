'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { adminApi } from '../../../lib/adminApi';

function newSeat(name, team, gameId = '') {
  return { id: crypto.randomUUID(), name, initialTeam: team, gameId };
}

export default function TestingRoom() {
  const [access, setAccess] = useState('Checking your admin session…');
  const [allowed, setAllowed] = useState(false);
  const [seats, setSeats] = useState([]);
  const [updates, setUpdates] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState('team1');
  const [newName, setNewName] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const frames = useRef(new Map());

  useEffect(() => {
    const controller = new AbortController();
    adminApi.me(controller.signal).then(() => setAllowed(true)).catch((reason) => {
      if (!controller.signal.aborted) setAccess(reason.message);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const receive = (event) => {
      const message = event.data;
      if (event.origin !== window.location.origin || message?.type !== 'actguess:test-seat') return;
      if (frames.current.get(message.seat)?.contentWindow !== event.source) return;
      if (message.gameId) setRoomId(message.gameId);
      setUpdates((current) => ({
        ...current,
        [message.seat]: {
          ...current[message.seat],
          ...message,
          error: message.connected ? '' : message.error ?? current[message.seat]?.error,
          hadGame: Boolean(message.gameId || current[message.seat]?.hadGame)
        }
      }));
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);

  const connectedSeats = seats.filter((seat) => updates[seat.id]?.connected);
  const snapshot = updates[connectedSeats.find((seat) => updates[seat.id]?.isHost)?.id || connectedSeats[0]?.id];
  const teams = snapshot?.teamSizes || [{ id: 'team1', name: 'Team 1' }, { id: 'team2', name: 'Team 2' }];
  const active = seats.find(({ id }) => id === activeId);
  const teamFor = (seat) => updates[seat.id]?.teamId || seat.initialTeam;
  const activeTeam = teams.find(({ id }) => id === (active ? teamFor(active) : selectedTeam)) || teams[0];
  const pending = seats.filter((seat) => !updates[seat.id]?.hadGame && !updates[seat.id]?.error);
  const addingAllowed = roomId && snapshot?.status === 'lobby' && !closing;
  const pendingIn = (teamId) => pending.filter((seat) => teamFor(seat) === teamId).length;
  const targetFull = activeTeam.size + pendingIn(activeTeam.id) >= snapshot?.capacity;

  function reset() {
    setRoomId(null);
    setSeats([]);
    setUpdates({});
    setActiveId(null);
    setSelectedTeam('team1');
    setClosing(false);
    setError('');
    setNewName('');
  }

  function launch() {
    const host = newSeat('Test Host', 'team1');
    setSeats([host]);
    setActiveId(host.id);
  }

  function addPlayer(event) {
    event.preventDefault();
    const name = newName.trim();
    if (!name || !addingAllowed || targetFull) return;
    if (seats.some((seat) => seat.name.toLowerCase() === name.toLowerCase())) {
      setError('Choose a different name for this test player.');
      return;
    }
    setError('');
    const seat = newSeat(name, activeTeam.id, roomId);
    setSeats([...seats, seat]);
    setActiveId(seat.id);
    setNewName('');
  }

  function addStarterPlayers() {
    const names = new Set(seats.map((seat) => seat.name.toLowerCase()));
    let number = 1;
    const additions = teams.slice(0, 2).flatMap((team) =>
      Array.from({ length: Math.max(0, 2 - team.size - pendingIn(team.id)) }, () => {
        while (names.has(`test player ${number}`)) number += 1;
        return newSeat(`Test Player ${number++}`, team.id, roomId);
      })
    );
    setSeats([...seats, ...additions]);
  }

  async function endTest() {
    setClosing(true);
    setError('');
    try {
      if (roomId) await adminApi.closeTestRoom(roomId);
      reset();
    } catch (failure) {
      setClosing(false);
      setError(failure.message);
    }
  }

  function reconnect() {
    if (!activeId) return;
    frames.current.get(activeId)?.contentWindow?.postMessage({ type: 'actguess:reconnect-test-seat' }, window.location.origin);
  }

  function removeOfflineSeat() {
    if (!active || updates[activeId]?.gameId || !updates[activeId]?.hadGame && !updates[activeId]?.error) return;
    setSeats(seats.filter((seat) => seat.id !== activeId));
    setSelectedTeam(teamFor(active));
    setActiveId(null);
  }

  function selectTeam(teamId) {
    setSelectedTeam(teamId);
    if (active && teamFor(active) === teamId) return;
    const player = seats.find((seat) => teamFor(seat) === teamId);
    setActiveId(player?.id || null);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="text-sm text-indigo-200 hover:underline" href="/admin/dashboard">← Admin dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold text-white">Game testing</h1>
          <p className="mt-1 text-sm text-slate-300">Run a private room and play every seat from this window. Test rooms expire after two hours.</p>
        </div>
        {seats.length > 0 && (
          <Button size="sm" variant="secondary" disabled={closing} onClick={endTest}>{closing ? 'Closing…' : 'End test'}</Button>
        )}
      </header>

      {!allowed ? <p role="status">{access} <Link className="text-indigo-200 underline" href="/admin/login">Admin sign-in</Link></p> : seats.length === 0 ? (
        <Card className="space-y-4 p-5">
          <p className="text-slate-300">Create a test host, then add players or fill two teams with two players each to start a match.</p>
          <Button onClick={launch}>Create test room</Button>
        </Card>
      ) : (
        <Card className="space-y-4 p-3 sm:p-5">
          <nav aria-label="Test teams" className="flex flex-wrap gap-2">
            {teams.map((team) => (
              <button type="button" key={team.id} aria-pressed={activeTeam.id === team.id} onClick={() => selectTeam(team.id)}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-100 aria-pressed:bg-primary aria-pressed:text-white">
                {team.name} · {team.size ?? 0}
              </button>
            ))}
          </nav>
          <nav aria-label="Test players" className="flex min-h-9 flex-wrap items-center gap-2">
            {seats.filter((seat) => teamFor(seat) === activeTeam.id).map((seat) => (
              <button type="button" key={seat.id} aria-pressed={activeId === seat.id} onClick={() => setActiveId(seat.id)}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 aria-pressed:border-indigo-300 aria-pressed:bg-base-700">
                {seat.name}{updates[seat.id]?.isHost ? ' · Host' : ''}{updates[seat.id]?.error ? ' · Failed' : updates[seat.id]?.connected ? '' : ' · Offline'}
              </button>
            ))}
          </nav>
          {addingAllowed && (
            <form onSubmit={addPlayer} className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
                Add to {activeTeam.name}
                <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={24} placeholder="Player name"
                  className="rounded-lg border border-white/10 bg-base-800 px-3 py-2 text-slate-100" />
              </label>
              <Button size="sm" type="submit" disabled={!newName.trim() || targetFull}>{targetFull ? 'Team full' : 'Add player'}</Button>
              <Button size="sm" variant="secondary" disabled={teams.slice(0, 2).every((team) => team.size + pendingIn(team.id) >= 2)} onClick={addStarterPlayers}>Fill starter teams</Button>
            </form>
          )}
          {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
          {active && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-300">Viewing {active.name}</p>
              {updates[active.id]?.gameId && <Button size="sm" variant="ghost" onClick={reconnect}>Reconnect this player</Button>}
              {!updates[active.id]?.gameId && (updates[active.id]?.hadGame || updates[active.id]?.error) && (
                <Button size="sm" variant="ghost" onClick={removeOfflineSeat}>Remove player view</Button>
              )}
            </div>
          )}
          {seats.map((seat) => (
            <iframe
              key={seat.id}
              ref={(element) => {
                if (element) frames.current.set(seat.id, element);
                else frames.current.delete(seat.id);
              }}
              title={seat.name + ' game view'}
              src="/admin/testing/player"
              data-test-seat={seat.id}
              data-test-team={seat.initialTeam}
              data-test-room={seat.gameId}
              data-test-name={seat.name}
              hidden={seat.id !== activeId}
              className="h-[68dvh] min-h-96 w-full rounded-xl border border-white/10 bg-base-950"
            />
          ))}
        </Card>
      )}
    </main>
  );
}
