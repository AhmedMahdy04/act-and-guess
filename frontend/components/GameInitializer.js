'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useGameStore } from '../app/store';

export default function GameInitializer() {
  const initListeners = useGameStore((state) => state.initListeners);
  const status = useGameStore((state) => state.status);
  const gameId = useGameStore((state) => state.gameId);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    initListeners();
  }, [initListeners]);

  useEffect(() => {
    if (!gameId) {
      return;
    }

    if ((status === 'playing' || status === 'round_end') && pathname !== '/game') {
      router.push('/game');
      return;
    }

    if (status === 'finished' && pathname !== '/results') {
      router.push('/results');
      return;
    }

    if (status === 'lobby' && pathname === '/game') {
      router.push('/lobby');
    }
  }, [gameId, pathname, router, status]);

  return null;
}
