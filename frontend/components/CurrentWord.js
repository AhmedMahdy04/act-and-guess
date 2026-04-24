'use client';

import { motion } from 'framer-motion';

export default function CurrentWord({ word }) {
  const safeWord = String(word || '');

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-center gap-2"
      >
        <span className="text-4xl">🎭</span>
        <span className="text-lg font-bold text-slate-400">
          You're up
        </span>
      </motion.div>

      <div className="relative">
        <div className="bg-base-950 border border-white/[0.08] rounded-2xl px-6 sm:px-10 py-8 sm:py-12">
          <motion.h2
            key={safeWord}
            initial={{ scale: 0.95, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-wider text-slate-100"
          >
            {safeWord.toUpperCase()}
          </motion.h2>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-slate-500">
          <span className="px-3 py-1 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            Act it out
          </span>
          <span>·</span>
          <span>No talking</span>
        </div>
      </div>
    </div>
  );
}

