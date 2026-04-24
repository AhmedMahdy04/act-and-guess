export default function PlayerAvatar({ player }) {
  return (
    <div className="group relative">
      <div className="w-20 h-20 bg-gradient-to-br from-purple-500/90 to-pink-500/90 rounded-2xl shadow-xl border-4 border-white/25 hover:border-white/50 transition-all duration-300 transform hover:scale-110 hover:rotate-3 group-hover:shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl" />
        <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-white shadow-lg ${
          player.connected === false ? 'bg-gray-400' : 'bg-green-400'
        }`} />
        {player.isHost && (
          <div className="absolute -top-3 -left-3 text-[10px] font-black bg-yellow-300 text-black px-2 py-1 rounded-full shadow-lg">
            HOST
          </div>
        )}
        {player.isActor && (
          <div className="absolute -bottom-3 -right-3 text-[10px] font-black bg-emerald-300 text-black px-2 py-1 rounded-full shadow-lg">
            ACTOR
          </div>
        )}
        <p className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs font-bold truncate max-w-[70px] px-1 bg-black/50 rounded-full">
          {player.username}
        </p>
        {player.connected === false && (
          <p className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] font-black bg-black/60 px-2 py-0.5 rounded-full">
            OFFLINE
          </p>
        )}
      </div>
    </div>
  );
}
