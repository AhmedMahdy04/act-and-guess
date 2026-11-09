export default function CurrentWord({ word }) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">You’re the actor</p>
      <h2 className="rounded-2xl border border-white/10 bg-base-950 px-4 py-7 text-3xl font-black leading-tight text-slate-100 [overflow-wrap:anywhere] sm:px-8 sm:text-5xl">
        {word || 'Waiting for your word…'}
      </h2>
      <p className="text-sm text-slate-300">Act it out with gestures. Keep the word secret and avoid talking or spelling.</p>
    </div>
  );
}
