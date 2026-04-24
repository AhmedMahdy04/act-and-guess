'use client';

import AdBanner from './AdBanner';
import { AD_SLOTS } from '../lib/adConfig';

/**
 * Fixed bottom banner ad that appears on every page.
 */
export default function AdFooter() {
  const slot = AD_SLOTS.footer;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-base-950/90 border-t border-white/[0.04] backdrop-blur-sm"
      style={{ minHeight: '50px' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1 flex items-center justify-center">
        <AdBanner
          scripts={slot.scripts}
          html={slot.html}
          className="w-full flex justify-center"
        />
      </div>
    </div>
  );
}

