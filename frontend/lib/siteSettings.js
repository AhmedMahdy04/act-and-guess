'use client';

import { useEffect, useState } from 'react';

const backend = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4001').replace(/\/$/, '');
export const defaultRoomSettings = {
  teamCount: 2,
  playersPerTeam: 3,
  targetScore: 10,
  roundTime: 30,
  difficulty: 'mixed',
  visibility: 'private',
  category: 'random'
};

export function useSiteSettings({ refreshEvery } = {}) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(backend + '/api/site-settings', { signal: controller.signal });
        if (response.ok && !controller.signal.aborted) setSettings(await response.json());
      } catch {
        // Keep the current settings if the backend is temporarily unavailable.
      }
    }
    const onPublished = (event) => setSettings(event.detail);
    window.addEventListener('actguess:settings', onPublished);
    refresh();
    const interval = refreshEvery ? setInterval(() => {
      if (!document.hidden) refresh();
    }, refreshEvery) : undefined;

    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener('actguess:settings', onPublished);
    };
  }, [refreshEvery]);

  return settings;
}
