import PlayerAvatar from './PlayerAvatar';

const teamColors = {
  team1: 'border-red-500/20 bg-red-500/5',
  team2: 'border-blue-500/20 bg-blue-500/5',
  team3: 'border-amber-500/20 bg-amber-500/5',
  team4: 'border-emerald-500/20 bg-emerald-500/5',
  team5: 'border-purple-500/20 bg-purple-500/5',
  team6: 'border-pink-500/20 bg-pink-500/5',
};

export default function TeamList({ teams, players, maxPlayersPerTeam, renderPlayerAction }) {
  return (
    <div className="space-y-4">
      {Object.entries(teams).map(([teamId, team]) => {
        const connected = team.players.filter((playerId) => players[playerId]?.connected).length;
        return (
          <section
            key={teamId}
            className={`rounded-2xl p-4 sm:p-6 border ${teamColors[teamId] || teamColors.team1}`}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-100">{team.name}</h2>
              <span className="rounded-lg border border-white/10 bg-base-900/80 px-2.5 py-1 text-xs font-semibold text-slate-200">
                {connected >= 2 ? 'Ready' : 'Waiting'} · {team.players.length}/{maxPlayersPerTeam} spots
              </span>
            </div>

            {team.players.length ? (
              <ul className="grid grid-cols-2 gap-2 min-[375px]:grid-cols-3 sm:grid-cols-4">
                {team.players.map((playerId) => players[playerId] && (
                  <li key={playerId} className="min-w-0">
                    <PlayerAvatar player={players[playerId]} />
                    {renderPlayerAction?.(players[playerId])}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-300">This team has open spots.</p>}
          </section>
        );
      })}
    </div>
  );
}

