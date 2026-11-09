const teamColors = {
  team1: 'bg-red-400',
  team2: 'bg-blue-400',
  team3: 'bg-amber-400',
  team4: 'bg-emerald-400',
  team5: 'bg-purple-400',
  team6: 'bg-pink-400'
};

export default function Scoreboard({ teams, targetScore, final = false }) {
  const rankedTeams = Object.values(teams || {}).sort((left, right) => right.score - left.score);

  return (
    <section className="rounded-2xl border border-white/10 bg-base-900/80 p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-100">{final ? 'Final scores' : 'Scoreboard'}</h2>
        {targetScore > 0 && <p className="text-sm text-slate-300">{targetScore} points to win</p>}
      </div>
      {rankedTeams.length ? (
        <ol className="space-y-2">
          {rankedTeams.map((team) => {
            const score = team.score || 0;
            const rank = rankedTeams.findIndex((entry) => entry.score === team.score) + 1;
            return (
              <li key={team.id} className="rounded-xl border border-white/10 bg-base-800/50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="rounded-md bg-base-950 px-2 py-1 font-mono text-xs text-slate-300"><span className="sr-only">Rank </span>#{rank}</span>
                    <span className="break-words text-sm font-bold text-slate-100">{team.name}</span>
                  </div>
                  <span className="shrink-0 text-lg font-black tabular-nums text-slate-100">{score}</span>
                </div>
                {targetScore > 0 && (
                  <div className="mt-2 h-1.5 rounded-full bg-white/10" aria-hidden="true">
                    <div className={`h-full rounded-full transition-[width] ${teamColors[team.id] || 'bg-slate-400'}`} style={{ width: `${Math.min(100, (score / targetScore) * 100)}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : <p className="text-sm text-slate-300">Scores will appear when the game starts.</p>}
    </section>
  );
}
