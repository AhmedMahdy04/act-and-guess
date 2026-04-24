import PlayerAvatar from './PlayerAvatar';

export default function TeamList({ teams, players, maxPlayersPerTeam }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {Object.entries(teams).map(([teamId, team]) => (
        <div
          key={teamId}
          className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
        >
          <h3 className="text-2xl sm:text-3xl font-black mb-5 text-center flex items-center justify-center gap-3 flex-wrap">
            <span>{team.name}</span>
            <span
              className={`px-4 py-2 rounded-full text-base sm:text-xl font-black bg-gradient-to-r ${
                teamId === 'team1'
                  ? 'from-red-500/90 to-red-600/90'
                  : teamId === 'team2'
                    ? 'from-blue-500/90 to-blue-600/90'
                    : teamId === 'team3'
                      ? 'from-yellow-500/90 to-yellow-600/90'
                      : 'from-green-500/90 to-green-600/90'
              }`}
            >
              {team.score || 0}
            </span>
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
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
                className="w-20 h-20 bg-white/5 rounded-2xl border border-dashed border-white/15 animate-pulse"
              />
            ))}
          </div>
          
          <p className="text-center mt-4 text-base sm:text-lg opacity-75">
            {team.players?.length || 0}/{maxPlayersPerTeam} players
          </p>
        </div>
      ))}
    </div>
  );
}
