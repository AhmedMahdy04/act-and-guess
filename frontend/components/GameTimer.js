export default function GameTimer({ timeLeft, roundTime, paused }) {
  const seconds = Math.max(0, Number(timeLeft) || 0);
  const percent = Math.min(100, (seconds / Math.max(1, Number(roundTime) || 0)) * 100);
  const isCritical = !paused && seconds <= 5;

  return (
    <div className={`w-24 rounded-xl border px-3 py-2 text-center ${isCritical ? 'border-rose-400/40 bg-rose-500/10 text-rose-200' : 'border-indigo-400/30 bg-indigo-500/10 text-indigo-100'}`} role="timer" aria-label={`${seconds} seconds remaining`}>
      <div className="text-lg font-black leading-none tabular-nums" aria-hidden="true">{seconds}s</div>
      <div className="mt-2 h-1 rounded-full bg-white/10" aria-hidden="true">
        <div className={`h-full rounded-full transition-[width] ${isCritical ? 'bg-rose-400' : 'bg-indigo-400'}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
