'use client';

import { motion } from 'framer-motion';

export default function GameTimer({ timeLeft }) {
  const safeTimeLeft = Number(timeLeft) || 0;

  const isCritical = safeTimeLeft < 10;
  const isSoon = safeTimeLeft < 20;

  const baseClass = isCritical
    ? 'bg-red-500 border-red-300'
    : isSoon
      ? 'bg-orange-500 border-orange-300'
      : 'bg-emerald-500 border-emerald-300';

  return (
    <motion.div
      className={`p-5 sm:p-6 rounded-2xl text-3xl sm:text-4xl font-black text-center shadow-2xl border-4 ${baseClass}`}
      initial={{ scale: 0.98, opacity: 0.6 }}
      animate={{
        scale: isCritical ? 1.08 : isSoon ? 1.03 : 1,
        opacity: 1,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <div className={isCritical ? 'animate-pulse' : ''}>{safeTimeLeft}s</div>
    </motion.div>
  );
}

