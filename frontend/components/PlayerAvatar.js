export default function PlayerAvatar({ player }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-base-900/80 p-2.5 text-center" title={player.username}>
      <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full bg-indigo-500/15 font-black text-indigo-200" aria-hidden="true">
        {Array.from(player.username)[0]?.toUpperCase() || '?'}
      </div>
      <p className="truncate text-sm font-semibold text-slate-100">{player.username}</p>
      <p className={`mt-1 text-xs ${player.connected ? 'text-emerald-300' : 'text-amber-300'}`}>
        {player.isHost && 'Host · '}{player.connected ? 'Online' : 'Reconnecting'}
      </p>
    </div>
  );
}
