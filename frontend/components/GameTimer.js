'use client';

import { motion } from 'framer-motion';

export default function GameTimer({ timeLeft }) {
  const safeTimeLeft = Number(timeLeft) || 0;
  const isCritical = safeTimeLeft < 10;
  const isSoon = safeTimeLeft < 20;

  const colorClass = isCritical
    ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
    : isSoon
      ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';

  return (
    <motion.div
      className={`px-5 py-3 rounded-xl font-bold text-center border ${colorClass}`}
      initial={{ scale: 0.98, opacity: 0.6 }}
      animate={{
        scale: isCritical ? 1.04 : isSoon ? 1.02 : 1,
        opacity: 1,
      }}
      transition={{ type: 'spring', stiffness: 280, damping: 20 }}
    >
      <div className={`text-2xl sm:text-3xl tabular-nums ${isCritical ? 'animate-pulse' : ''}`}>
        {safeTimeLeft}s
      </div>
    </motion.div>
  );
}

