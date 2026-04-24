'use client';

import { AnimatePresence, motion } from 'framer-motion';

export default function Scoreboard({ teams }) {
  const sortedScores = Object.entries(teams || {})
    .map(([teamId, team]) => [teamId, team.score || 0, team.name])
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

  return (
    <motion.div
      className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/15"
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="flex items-center justify-between gap-4 mb-5">
        <h3 className="text-2xl sm:text-3xl font-black text-yellow-300">🏆 Leaderboard</h3>
        <div className="hidden sm:flex items-center gap-2 opacity-80">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-sm font-bold">Live</span>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {sortedScores.map(([teamId, score, teamName], index) => {
            const rankClass =
              index === 0
                ? 'bg-gradient-to-r from-yellow-400/25 to-orange-400/25 border-yellow-300/70 scale-[1.01]'
                : index === 1
                  ? 'bg-gradient-to-r from-gray-300/18 to-gray-400/18 border-gray-300/70'
                  : index === 2
                    ? 'bg-gradient-to-r from-[#CD7F32]/20 to-[#B8860B]/20 border-[#CD7F32]/80'
                    : 'hover:bg-white/10 border-white/10';

            const teamColor =
              teamId === 'team1'
                ? 'bg-red-500'
                : teamId === 'team2'
                  ? 'bg-blue-500'
                  : teamId === 'team3'
                    ? 'bg-yellow-500'
                    : 'bg-green-500';

            return (
              <motion.div
                layout
                key={teamId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className={`flex items-center justify-between p-4 rounded-2xl border ${rankClass} transition-colors`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl ${teamColor}`}>
                    {index + 1}
                  </div>
                  <span className="text-lg sm:text-xl font-black truncate">
                    {String(teamName || teamId.replace('team', 'Team ')).toUpperCase()}
                  </span>
                </div>
                <motion.span
                  key={`${teamId}-${score}`}
                  initial={{ scale: 0.9, opacity: 0.6 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="text-3xl font-black text-yellow-300 tabular-nums"
                >
                  {score}
                </motion.span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {sortedScores.length === 0 && (
        <div className="text-center py-12 opacity-70">
          <p className="text-xl sm:text-2xl mb-2 font-black">No scores yet</p>
          <p className="text-sm sm:text-base">First round coming soon!</p>
        </div>
      )}
    </motion.div>
  );
}
