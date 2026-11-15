'use client';

import { useEffect } from 'react';
import { useSiteSettings } from '../lib/siteSettings';
import { testSeat } from '../lib/testSeat';

export default function SiteAppearance() {
  const settings = useSiteSettings({ refreshEvery: 30000 });

  useEffect(() => {
    if (testSeat()) document.documentElement.dataset.testSeat = 'true';
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings?.theme || 'midnight';
  }, [settings?.theme]);

  return null;
}
