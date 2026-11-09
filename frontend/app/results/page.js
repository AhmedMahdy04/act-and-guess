'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '../store';
import RoomUnavailable from '../../components/RoomUnavailable';
import Scoreboard from '../../components/Scoreboard';
import AdBanner from '../../components/AdBanner';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function Results() {
  const [pending, setPending] = useState('');
  const { game, winner, isHost, lastError, connectionStatus, sessionStatus, startGame, returnToLobby, leaveGame, closeGame } = useGameStore();
  const router = useRouter();

  if (!game || game.status !== 'finished') return <RoomUnavailable title="No completed game" />;

  const winnerTeam = game.teams[winner];
  const online = connectionStatus === 'online' && sessionStatus === 'ready';
  const canRematch = Object.values(game.teams).filter((team) => (
    team.players.filter((playerId) => game.players[playerId]?.connected).length >= 2
  )).length >= 2;

  async function act(name, action) {
    if (pending || !online) return;
    setPending(name);
    try {
      await action();
    } catch {
      // Keep the results open so the player can see and retry the failed action.
    } finally {
      setPending('');
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-4xl space-y-6 px-4 py-8 sm:px-8 sm:py-12">
      <Card className="border-indigo-400/20 bg-indigo-500/5 p-6 text-center sm:p-10">
        <p className="mb-3 text-5xl" aria-hidden="true">🏆</p>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-300">Game complete</p>
        <h1 className="text-balance text-3xl font-black text-slate-100 sm:text-5xl">
          {winnerTeam ? `${winnerTeam.name} wins!` : 'Final results'}
        </h1>
        {winnerTeam && <p className="mt-3 text-slate-300">{winnerTeam.score} points · {game.currentRound} {game.currentRound === 1 ? 'round' : 'rounds'}</p>}
      </Card>

      <Scoreboard teams={game.teams} targetScore={game.targetScore} final />

      {lastError && <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{lastError}</p>}
      <div className="flex flex-col flex-wrap justify-center gap-3 sm:flex-row">
        {isHost && (
          <>
            <Button disabled={Boolean(pending) || !online || !canRematch} onClick={() => act('rematch', () => startGame(game.id))}>
              {pending === 'rematch' ? 'Starting…' : 'Play again'}
            </Button>
            <Button variant="secondary" disabled={Boolean(pending) || !online} onClick={() => act('lobby', () => returnToLobby(game.id))}>
              {pending === 'lobby' ? 'Opening…' : 'Return to lobby'}
            </Button>
          </>
        )}
        <Button variant="ghost" disabled={Boolean(pending) || !online} onClick={() => act('leave', async () => {
          await leaveGame(game.id);
          router.push('/');
        })}>
          {pending === 'leave' ? 'Leaving…' : 'Leave game'}
        </Button>
      </div>
      {isHost && !canRematch && <p className="text-center text-sm text-slate-300">Return to the lobby to get two teams ready for a rematch.</p>}
      {!isHost && <p className="text-center text-sm text-slate-300">Stay here to play again when the host starts another game.</p>}
      {isHost && (
        <div className="text-center">
          <Button variant="ghost" size="sm" disabled={Boolean(pending) || !online} onClick={() => {
            if (window.confirm('Close this room for everyone?')) act('close', async () => { await closeGame(game.id); router.push('/'); });
          }}>
            {pending === 'close' ? 'Closing…' : 'Close room for everyone'}
          </Button>
        </div>
      )}
      <AdBanner />
    </main>
  );
}
