'use client';

import { useSyncExternalStore } from 'react';
import { ADS_ENABLED, AD_IFRAME_DOCUMENT, getAdPreference, subscribeToAdPreference } from '../lib/adConfig';

export default function AdBanner() {
  const preference = useSyncExternalStore(subscribeToAdPreference, getAdPreference, () => null);
  if (!ADS_ENABLED || preference !== 'allowed') return null;

  return (
    <iframe
      title="Advertisement"
      srcDoc={AD_IFRAME_DOCUMENT}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      loading="lazy"
      className="h-64 w-full rounded-xl border border-white/10 bg-base-900"
    />
  );
}
