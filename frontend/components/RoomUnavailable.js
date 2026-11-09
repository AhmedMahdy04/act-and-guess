'use client';

import Link from 'next/link';
import { useGameStore } from '../app/store';
import Card from './ui/Card';

export default function RoomUnavailable({ title = 'No active game' }) {
  const sessionStatus = useGameStore((state) => state.sessionStatus);
  const lastError = useGameStore((state) => state.lastError);
  const waiting = sessionStatus !== 'ready';

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-3xl" aria-hidden="true">🎭</div>
        <h1 className="mb-2 text-2xl font-bold text-slate-100">{waiting ? 'Restoring your room' : title}</h1>
        <p className="text-sm text-slate-300" role="status">
          {waiting ? 'Your game will appear when your session reconnects.' : lastError || 'Host a new game or enter an invite code to join your friends.'}
        </p>
        {!waiting && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/create" className="rounded-xl bg-primary px-4 py-3 font-semibold text-white hover:bg-indigo-500">Host a game</Link>
            <Link href="/join" className="rounded-xl bg-base-800 px-4 py-3 font-semibold text-slate-200 hover:bg-base-700">Join a game</Link>
          </div>
        )}
      </Card>
    </main>
  );
}
