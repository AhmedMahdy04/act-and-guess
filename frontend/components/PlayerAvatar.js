export default function PlayerAvatar({ player }) {
  const statusColor = player.connected === false ? 'bg-slate-500' : 'bg-accent-emerald';
  const statusRing = player.connected === false ? 'ring-slate-500/30' : 'ring-accent-emerald/30';

  return (
    <div className="relative group">
      <div className={`aspect-square rounded-xl bg-base-800 border border-white/[0.06] flex items-center justify-center transition-all duration-200 group-hover:border-white/[0.12] group-hover:scale-[1.03] ${statusRing} ring-1`}>
        {/* Avatar circle with initial */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg sm:text-xl font-bold">
          {player.username.charAt(0).toUpperCase()}
        </div>

        {/* Connection status dot */}
        <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-base-800 ${statusColor}`} />

        {/* Host badge */}
        {player.isHost && (
          <div className="absolute -top-1.5 -left-1.5 text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-md">
            HOST
          </div>
        )}

        {/* Actor badge */}
        {player.isActor && (
          <div className="absolute -bottom-1.5 -right-1.5 text-[9px] font-bold bg-accent-emerald text-white px-1.5 py-0.5 rounded-md">
            ACTOR
          </div>
        )}
      </div>

      {/* Username below */}
      <p className="mt-1.5 text-[10px] sm:text-xs font-semibold text-center text-slate-400 truncate px-0.5">
        {player.username}
      </p>
    </div>
  );
}

