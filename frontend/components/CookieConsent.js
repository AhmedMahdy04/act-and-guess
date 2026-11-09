'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ADS_ENABLED, getAdPreference, saveAdPreference, subscribeToAdPreference } from '../lib/adConfig';
import Button from './ui/Button';

export default function CookieConsent({ manage = false }) {
  const [mounted, setMounted] = useState(false);
  const preference = useSyncExternalStore(subscribeToAdPreference, getAdPreference, () => null);
  useEffect(() => setMounted(true), []);

  if (!ADS_ENABLED || !mounted || (!manage && preference)) return null;

  return (
    <div className={manage ? 'rounded-xl border border-white/10 bg-base-900 p-4' : 'fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-xl border border-white/15 bg-base-900 p-4 shadow-2xl'}>
      <p className="text-sm font-bold text-slate-100">Optional advertising</p>
      <p className="mt-1 text-sm text-slate-300">
        Ad partners may use cookies or similar storage. You can choose whether to load their ads and change your choice on the <Link href="/privacy" className="text-indigo-300 underline">privacy page</Link>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => saveAdPreference('declined')} disabled={preference === 'declined'}>Decline ads</Button>
        <Button size="sm" onClick={() => saveAdPreference('allowed')} disabled={preference === 'allowed'}>Allow ads</Button>
      </div>
    </div>
  );
}
