'use client';

import { useEffect, useRef } from 'react';
import { ADS_ENABLED } from '../lib/adConfig';

/**
 * Safe Adsterra ad injector for Next.js.
 * Injects external scripts into a container div on mount and cleans up on unmount.
 */
export default function AdBanner({ scripts = [], html = '', className = '', style = {} }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Inject static HTML first (e.g., container divs)
    if (html) {
      container.innerHTML = html;
    }

    // Inject script tags
    const injected = [];
    scripts.forEach((src) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      container.appendChild(script);
      injected.push(script);
    });

    return () => {
      injected.forEach((script) => {
        try {
          script.remove();
        } catch {
          // ignore
        }
      });
      if (html && container) {
        container.innerHTML = '';
      }
    };
  }, [scripts, html]);

  if (!ADS_ENABLED) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      aria-hidden="true"
    />
  );
}

