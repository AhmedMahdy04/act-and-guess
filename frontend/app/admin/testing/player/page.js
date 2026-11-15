'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../../store';
import { testSeat, reportTestSeat } from '../../../../lib/testSeat';
import Button from '../../../../components/ui/Button';

export default function TestPlayer() {
  const attempted = useRef(false);
  const [error, setError] = useState('');
  const [embedded, setEmbedded] = useState(false);
  const { connectionStatus, sessionStatus, gameId, createGame, joinGame, lastError } = useGameStore();

  function enterRoom() {
    const frame = testSeat() && window.frameElement;
    if (!frame || attempted.current || gameId) return;
    attempted.current = true;
    const { testName, testTeam, testRoom } = frame.dataset;
    setError('');
    const task = testRoom
      ? joinGame(testRoom, testName, testTeam)
      : createGame({ roundTime: 60, visibility: 'private' }, testName, testTeam);

    task.catch((failure) => {
      setError(failure.message);
      reportTestSeat({ error: failure.message, connected: false });
    });
  }

  useEffect(() => setEmbedded(Boolean(testSeat())), []);

  useEffect(() => {
    if (!testSeat() || connectionStatus !== 'online' || sessionStatus !== 'ready') return;
    // On refresh, the store resumes the existing seat before the game routes open.
    if (lastError) {
      setError(lastError);
      reportTestSeat({ error: lastError, connected: false });
    } else {
      enterRoom();
    }
  }, [connectionStatus, sessionStatus, gameId, lastError]);

  return (
    <main className="mx-auto max-w-lg space-y-3 p-6">
      <h1 className="text-lg font-bold text-white">Test player</h1>
      <p role={error ? 'alert' : 'status'} className={error ? 'text-rose-200' : 'text-slate-300'}>
        {error || (embedded ? 'Connecting this player to the test room…' : 'Open Game testing from the admin dashboard to launch a player.')}
      </p>
      {error && (
        <Button size="sm" onClick={() => {
          attempted.current = false;
          enterRoom();
        }}>Retry</Button>
      )}
    </main>
  );
}
