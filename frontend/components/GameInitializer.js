'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useGameStore } from '../app/store';
import Button from './ui/Button';
import { reportTestSeat, testSeat } from '../lib/testSeat';

export default function GameInitializer() {
  const initListeners = useGameStore((state) => state.initListeners);
  const resumeSession = useGameStore((state) => state.resumeSession);
  const fetchWordCatalog = useGameStore((state) => state.fetchWordCatalog);
  const game = useGameStore((state) => state.game);
  const reconnectTestSeat = useGameStore((state) => state.reconnectTestSeat);
  const status = useGameStore((state) => state.status);
  const gameId = useGameStore((state) => state.gameId);
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const sessionStatus = useGameStore((state) => state.sessionStatus);
  const router = useRouter();
  const pathname = usePathname();
  const roomPath = status === 'finished' ? '/results' : status === 'lobby' ? '/lobby' : '/game';
  const playerPage = ['/create', '/join', '/lobby', '/game', '/results', '/admin/testing/player'].includes(pathname);
  const catalogPage = pathname === '/create' || pathname === '/lobby';

  useEffect(() => {
    initListeners();
  }, [initListeners]);

  useEffect(() => {
    if (!catalogPage) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') fetchWordCatalog();
    };
    fetchWordCatalog();
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [catalogPage, fetchWordCatalog]);

  useEffect(() => {
    if (playerPage && gameId && sessionStatus === 'ready' && pathname !== roomPath) {
      router.replace(roomPath);
    }
  }, [gameId, pathname, playerPage, roomPath, router, sessionStatus]);

  useEffect(() => {
    if (!testSeat()) return;
    const player = game?.players?.[game.selfId];
    reportTestSeat({
      gameId,
      status,
      teamId: player?.teamId,
      isHost: game?.isHost,
      connected: Boolean(gameId && sessionStatus === 'ready' && connectionStatus === 'online'),
      teamSizes: game && Object.values(game.teams).map(({ id, name, players }) => ({
        id, name, size: players.length
      })),
      capacity: game?.playersPerTeam
    });
  }, [game, gameId, status, sessionStatus, connectionStatus]);

  useEffect(() => {
    if (!testSeat() || !gameId) return;
    const receive = (event) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (event.data?.type === 'actguess:reconnect-test-seat') reconnectTestSeat();
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [gameId, reconnectTestSeat]);

  if (!playerPage || (connectionStatus === 'online' && sessionStatus === 'ready')) return null;

  const message = sessionStatus === 'failed'
    ? 'Your session could not be restored.'
    : connectionStatus === 'reconnecting'
      ? 'Connection interrupted. Reconnecting to the game server…'
      : sessionStatus === 'restoring' && connectionStatus === 'online'
        ? 'Rejoining your game…'
        : 'Connecting to the game server…';

  return (
    <div className="sticky top-16 z-40 flex flex-wrap items-center justify-center gap-2 border-b border-amber-300/20 bg-base-900 px-4 py-2 text-center text-sm text-amber-200" role="status">
      <span>{message}</span>
      {sessionStatus === 'failed' && <Button size="sm" variant="ghost" onClick={resumeSession}>Retry</Button>}
    </div>
  );
}
