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
        placeholder="Type your guess here..."
        onKeyPress={(e) => e.key === 'Enter' && onSubmit()}
        className="w-full p-7 sm:p-8 rounded-3xl bg-white/10 backdrop-blur-xl border-2 border-white/20 focus:border-primary focus:outline-none text-2xl sm:text-3xl font-black text-center text-white placeholder-white/40 transition-all shadow-xl hover:shadow-2xl"
      />

      <motion.button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        whileHover={canSubmit ? { scale: 1.03 } : {}}
        whileTap={{ scale: 0.98 }}
        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-black text-lg sm:text-xl shadow-xl hover:shadow-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Guess
      </motion.button>

      <div className="mt-3 flex justify-between items-center px-2 text-xs sm:text-sm opacity-80">
        <span className="font-bold">No spelling. No talking.</span>
        <span className="tabular-nums">
          {safeGuess.length}/{24}
        </span>
      </div>
    </motion.div>
  );
}

