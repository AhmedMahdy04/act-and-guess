'use client';

import { motion } from 'framer-motion';

export default function GuessInput({ guess, setGuess, onSubmit }) {
  const canSubmit = Boolean(String(guess || '').trim());
  const safeGuess = String(guess || '');

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0.2, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <input
        value={safeGuess}
        onChange={(e) => setGuess(e.target.value)}
        placeholder="Type your guess..."
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        className="w-full p-5 sm:p-6 pr-28 sm:pr-32 rounded-xl bg-base-800 border border-white/[0.08] focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/20 text-xl sm:text-2xl font-bold text-center text-slate-100 placeholder-slate-600 transition-all"
      />

      <motion.button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        whileHover={canSubmit ? { scale: 1.02 } : {}}
        whileTap={{ scale: 0.98 }}
        className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-primary hover:bg-indigo-500 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold text-base sm:text-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Guess
      </motion.button>

      <div className="mt-2 flex justify-between items-center px-1 text-xs text-slate-500">
        <span className="font-medium">No spelling. No talking.</span>
        <span className="tabular-nums">{safeGuess.length}/24</span>
      </div>
    </motion.div>
  );
}

