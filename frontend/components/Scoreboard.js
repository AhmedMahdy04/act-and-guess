'use client';

import { AnimatePresence, motion } from 'framer-motion';

export default function Scoreboard({ teams }) {
  const sortedScores = Object.entries(teams || {})
    .map(([teamId, team]) => [teamId, team.score || 0, team.name])
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

  const teamColors = {
    team1: 'bg-red-500',
    team2: 'bg-blue-500',
    team3: 'bg-amber-500',
    team4: 'bg-emerald-500',
    team5: 'bg-purple-500',
    team6: 'bg-pink-500',
  };

  return (
    <motion.div
      className="rounded-2xl border border-white/[0.06] bg-base-900/60 p-5 sm:p-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-bold text-slate-200">Leaderboard</h3>
        <div className="hidden sm:flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse" />
          <span className="text-xs font-medium text-slate-500">Live</span>
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {sortedScores.map(([teamId, score, teamName], index) => {
            const rankStyles = [
              'bg-amber-500/8 border-amber-500/15',
              'bg-slate-400/5 border-slate-400/10',
              'bg-orange-400/5 border-orange-400/10',
              'border-white/[0.04] hover:bg-white/[0.02]',
            ];
            const rankClass = rankStyles[index] || rankStyles[3];
            const teamColor = teamColors[teamId] || 'bg-slate-500';

            return (
              <motion.div
                layout
                key={teamId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center justify-between p-3 rounded-xl border ${rankClass} transition-colors`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${teamColor} text-white`}>
                    {index + 1}
                  </div>
                  <span className="text-sm sm:text-base font-bold text-slate-200 truncate">
                    {String(teamName || teamId.replace('team', 'Team ')).toUpperCase()}
                  </span>
                </div>
                <motion.span
                  key={`${teamId}-${score}`}
                  initial={{ scale: 0.9, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                  className="text-2xl font-bold text-slate-100 tabular-nums"
                >
                  {score}
                </motion.span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {sortedScores.length === 0 && (
        <div className="text-center py-8">
          <p className="text-base font-bold text-slate-500 mb-1">No scores yet</p>
          <p className="text-xs text-slate-600">First round coming soon!</p>
        </div>
      )}
    </motion.div>
  );
}

