'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PlayerAvatar from './PlayerAvatar';

const teamColors = {
  team1: 'border-red-500/20 bg-red-500/5',
  team2: 'border-blue-500/20 bg-blue-500/5',
  team3: 'border-amber-500/20 bg-amber-500/5',
  team4: 'border-emerald-500/20 bg-emerald-500/5',
  team5: 'border-purple-500/20 bg-purple-500/5',
  team6: 'border-pink-500/20 bg-pink-500/5',
};

export default function TeamList({ teams, players, maxPlayersPerTeam, renderPlayerAction, onMovePlayer }) {
  const dragEnabled = Boolean(onMovePlayer);
  const roster = useRef(null);
  const activePointer = useRef(null);
  const [drag, setDrag] = useState(null);

  function teamAt(x, y) {
    const section = document.elementFromPoint(x, y)?.closest('[data-drop-team]');
    return roster.current?.contains(section) ? section.dataset.dropTeam : null;
  }

  function showDrag(pointer) {
    const { playerId, x, y } = pointer;
    setDrag({ playerId, x, y, overTeam: teamAt(x, y) });
  }

  function startDrag(event, player) {
    if (!onMovePlayer || activePointer.current || !event.isPrimary || event.button !== 0) return;

    const pointer = {
      id: event.pointerId,
      playerId: player.id,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      frame: 0,
      moved: false
    };
    activePointer.current = pointer;
    event.currentTarget.setPointerCapture(pointer.id);

    function scrollNearEdge() {
      if (activePointer.current !== pointer || !pointer.moved) return;
      const bounds = window.visualViewport;
      const top = bounds?.offsetTop ?? 0;
      const bottom = top + (bounds?.height ?? window.innerHeight);
      const edge = 72;
      const delta = pointer.y < top + edge ? -14 : pointer.y > bottom - edge ? 14 : 0;
      if (delta) {
        const before = window.scrollY;
        window.scrollBy({ top: delta, behavior: 'instant' });
        if (window.scrollY !== before) showDrag(pointer);
      }
      pointer.frame = requestAnimationFrame(scrollNearEdge);
    }

    pointer.startScrolling = scrollNearEdge;
  }

  function moveDrag(event) {
    const pointer = activePointer.current;
    if (pointer?.id !== event.pointerId) return;

    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!pointer.moved) {
      if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) < 6) return;
      pointer.moved = true;
      pointer.frame = requestAnimationFrame(pointer.startScrolling);
    }
    showDrag(pointer);
  }

  function finishDrag(event, drop = false) {
    const pointer = activePointer.current;
    if (pointer?.id !== event.pointerId) return;

    activePointer.current = null;
    cancelAnimationFrame(pointer.frame);
    setDrag(null);
    if (!drop || !pointer.moved || !onMovePlayer) return;

    const player = players[pointer.playerId];
    const teamId = teamAt(event.clientX, event.clientY);
    const destination = teams[teamId];
    if (player && destination && player.teamId !== teamId && destination.players.length < maxPlayersPerTeam) {
      onMovePlayer(player, teamId);
    }
  }

  useEffect(() => () => {
    cancelAnimationFrame(activePointer.current?.frame);
    activePointer.current = null;
  }, [dragEnabled]);

  const draggedPlayer = dragEnabled && drag && activePointer.current ? players[drag.playerId] : null;
  return (
    <div ref={roster} className="space-y-4">
      {renderPlayerAction && <p className="text-sm text-slate-300">Drag a player by the grip or use Move to.</p>}
      {draggedPlayer && createPortal(
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[100] max-w-48 -translate-x-1/2 -translate-y-full truncate rounded-xl border border-indigo-300/60 bg-base-900 px-3 py-2 text-sm font-semibold text-white shadow-lg"
          style={{ left: drag.x, top: drag.y - 16 }}
        >
          {draggedPlayer.username}
        </div>,
        document.body
      )}
      {Object.entries(teams).map(([teamId, team]) => {
        const connected = team.players.filter((playerId) => players[playerId]?.connected).length;
        const full = team.players.length >= maxPlayersPerTeam;
        const eligible = draggedPlayer && draggedPlayer.teamId !== teamId && !full;
        const hovered = eligible && drag.overTeam === teamId;
        return (
          <section
            key={teamId}
            data-drop-team={teamId}
            className={`rounded-2xl p-4 sm:p-6 border ${teamColors[teamId] || teamColors.team1} ${hovered ? 'ring-2 ring-indigo-300 bg-indigo-500/20' : eligible ? 'ring-1 ring-indigo-400/50' : ''}`}
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
                  <li key={playerId} className="relative min-w-0">
                    <PlayerAvatar player={players[playerId]} />
                    {dragEnabled && (draggedPlayer?.id === playerId || Object.values(teams).some((target) => target.id !== teamId && target.players.length < maxPlayersPerTeam)) && (
                      <span
                        aria-hidden="true"
                        title="Drag to another team"
                        data-player-grip={playerId}
                        className="absolute right-1 top-1 grid size-10 touch-none cursor-grab select-none place-items-center rounded-lg border border-white/10 bg-base-800 text-xl leading-none text-indigo-200 active:cursor-grabbing"
                        onPointerDown={(event) => startDrag(event, players[playerId])}
                        onPointerMove={moveDrag}
                        onPointerUp={(event) => finishDrag(event, true)}
                        onPointerCancel={finishDrag}
                        onLostPointerCapture={finishDrag}
                        onContextMenu={(event) => event.preventDefault()}
                      >⠿</span>
                    )}
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

