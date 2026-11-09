import './globals.css'
import GameInitializer from '../components/GameInitializer';
import PageTransitions from '../components/PageTransitions';
import Logo from '../components/Logo';
import Link from 'next/link';
import CookieConsent from '../components/CookieConsent';

export const metadata = {
  title: 'Act & Guess — Multiplayer Party Game',
  description: 'Real-time acting and guessing game. Create a room, invite friends, and play!',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-base-950/70 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
            <Link href="/" aria-label="Act & Guess home" className="shrink-0 hover:opacity-80 transition-opacity">
              <Logo size="sm" />
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main navigation">
              <Link
                href="/create"
                className="px-3 py-2.5 sm:px-4 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-white/[0.06] transition-colors"
              >
                Host
              </Link>
              <Link
                href="/join"
                className="px-3 py-2.5 sm:px-4 rounded-lg text-sm font-medium bg-primary/15 text-indigo-200 hover:bg-primary/25 transition-colors"
              >
                Join
              </Link>
            </nav>
          </div>
        </header>

        <div id="content" tabIndex={-1} className="pt-16 relative z-10">
          <GameInitializer />
          <PageTransitions>{children}</PageTransitions>
        </div>

        <CookieConsent />
      </body>
    </html>
  )
}

