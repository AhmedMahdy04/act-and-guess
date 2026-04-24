import PlayerAvatar from './PlayerAvatar';

const teamColors = {
  team1: 'border-red-500/20 bg-red-500/5',
  team2: 'border-blue-500/20 bg-blue-500/5',
  team3: 'border-amber-500/20 bg-amber-500/5',
  team4: 'border-emerald-500/20 bg-emerald-500/5',
  team5: 'border-purple-500/20 bg-purple-500/5',
  team6: 'border-pink-500/20 bg-pink-500/5',
};

const teamScoreColors = {
  team1: 'bg-red-500',
  team2: 'bg-blue-500',
  team3: 'bg-amber-500',
  team4: 'bg-emerald-500',
  team5: 'bg-purple-500',
  team6: 'bg-pink-500',
};

export default function TeamList({ teams, players, maxPlayersPerTeam }) {
  return (
    <div className="space-y-4">
      {Object.entries(teams).map(([teamId, team]) => (
        <div
          key={teamId}
          className={`rounded-2xl p-5 sm:p-6 border ${teamColors[teamId] || teamColors.team1}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-200">{team.name}</h3>
            <span className={`px-3 py-1 rounded-lg text-sm font-bold text-white ${teamScoreColors[teamId] || teamScoreColors.team1}`}>
              {team.score || 0}
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
            {team.players?.map((playerId) => (
              players[playerId] ? (
                <PlayerAvatar key={playerId} player={players[playerId]} />
              ) : null
            ))}
            {Array.from({
              length: Math.max(0, maxPlayersPerTeam - (team.players?.length || 0)),
            }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square bg-white/[0.02] rounded-xl border border-dashed border-white/[0.06]"
              />
            ))}
          </div>

          <p className="text-center mt-3 text-xs font-medium text-slate-500">
            {team.players?.length || 0}/{maxPlayersPerTeam} players
          </p>
        </div>
      ))}
    </div>
  );
}

