import './globals.css'
import GameInitializer from '../components/GameInitializer';
import PageTransitions from '../components/PageTransitions';

export const metadata = {
  title: 'Act & Guess - Multiplayer Party Game',
  description: 'Real-time acting and guessing game for parties!',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <GameInitializer />
        <PageTransitions>{children}</PageTransitions>
      </body>
    </html>
  )
}
