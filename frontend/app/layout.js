import './globals.css'
import GameInitializer from '../components/GameInitializer';
import PageTransitions from '../components/PageTransitions';
import Logo from '../components/Logo';
import Link from 'next/link';

export const metadata = {
  title: 'Act & Guess — Multiplayer Party Game',
  description: 'Real-time acting and guessing game. Create a room, invite friends, and play!',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.04] bg-base-950/70 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Logo size="sm" />
            </Link>
            <nav className="flex items-center gap-2">
              <Link
                href="/"
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors"
              >
                Home
              </Link>
              <Link
                href="/create"
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors"
              >
                Host
              </Link>
              <Link
                href="/join"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                Join
              </Link>
            </nav>
          </div>
        </header>

        <div className="pt-16 relative z-10">
          <GameInitializer />
          <PageTransitions>{children}</PageTransitions>
        </div>
      </body>
    </html>
  )
}

