'use client';

import Button from './ui/Button';

export default function GuessInput({ guess, setGuess, onSubmit, disabled, submitting }) {
  return (
    <form onSubmit={onSubmit} aria-busy={submitting} className="flex flex-col gap-2 sm:flex-row">
      <input
        value={guess}
        onChange={(event) => setGuess(event.target.value)}
        aria-label="Your guess"
        placeholder="Type your guess"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        enterKeyHint="send"
        spellCheck={false}
        maxLength={120}
        readOnly={submitting}
        disabled={disabled}
        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-base-800 px-4 py-3.5 text-lg font-semibold text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
      />
      <Button type="submit" disabled={disabled || submitting || !guess.trim()}>
        {submitting ? 'Sending…' : 'Send guess'}
      </Button>
    </form>
  );
}
