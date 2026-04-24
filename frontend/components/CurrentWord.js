'use client';

import { motion } from 'framer-motion';

export default function CurrentWord({ word }) {
  const safeWord = String(word || '');

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-center gap-3"
      >
        <span className="text-7xl">🎭</span>
        <span className="text-xl sm:text-2xl font-black opacity-90">
          You’re up
        </span>
      </motion.div>

      <div className="relative">
        <div className="bg-black/35 p-6 sm:p-10 rounded-3xl backdrop-blur-xl border border-white/20 shadow-2xl">
          <motion.h2
            key={safeWord}
            initial={{ scale: 0.92, opacity: 0.35, filter: 'blur(3px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase tracking-wider bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 bg-clip-text text-transparent drop-shadow-2xl"
          >
            {safeWord.toUpperCase()}
          </motion.h2>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3 text-sm sm:text-xl font-bold opacity-90">
          <span className="px-3 py-1 rounded-full border border-white/15 bg-white/5">
            Act it out
          </span>
          <span>⏱️</span>
        </div>
      </div>
    </div>
  );
}

