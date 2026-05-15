'use client';

import { useMemo } from 'react';
import type { Player, PropertyState, GameSettings, BoardSpace, PropertyColor } from '@umukino/shared';
import { SpaceType } from '@umukino/shared-types';
import { BOARD_SPACES } from '@umukino/board-data';
import {
  HomeIcon, ShieldIcon, GlobeIcon, AlertIcon, StarIcon,
  DiceIcon, UsersIcon, CrownIcon, HotelIcon, HouseIcon
} from '../layout/Icons';

// Map PropertyColor enum values to CSS hex colors
const colorCss: Record<string, string> = {
  BROWN:      '#92400e',
  LIGHT_BLUE: '#7dd3fc',
  PINK:       '#f472b6',
  ORANGE:     '#fb923c',
  RED:        '#ef4444',
  YELLOW:     '#fbbf24',
  GREEN:      '#22c55e',
  DARK_BLUE:  '#3b82f6',
};

interface GameBoardProps {
  spaces: PropertyState[];      // dynamic ownership/building data from GameState
  players: Player[];
  vacationPool: number;
  settings: GameSettings;
}

export const GameBoard = ({ spaces, players, vacationPool, settings }: GameBoardProps) => {

  const playerPositions = useMemo(() => {
    const positions: Record<number, Player[]> = {};
    players.forEach(player => {
      if (player.status !== 'BANKRUPT') {
        if (!positions[player.position]) {
          positions[player.position] = [];
        }
        positions[player.position].push(player);
      }
    });
    return positions;
  }, [players]);

  // Build a quick lookup for PropertyState by spaceIndex
  const propertyStateByIndex = useMemo(() => {
    const map: Record<number, PropertyState> = {};
    spaces.forEach(s => { map[s.spaceIndex] = s; });
    return map;
  }, [spaces]);

  const renderSpace = (boardSpace: BoardSpace) => {
    const isCorner = [0, 10, 20, 30].includes(boardSpace.index);
    const occupants = playerPositions[boardSpace.index] || [];
    const ps = propertyStateByIndex[boardSpace.index];
    const cssColor = boardSpace.color ? colorCss[boardSpace.color] : undefined;

    return (
      <div
        key={boardSpace.index}
        className={`
          relative flex flex-col items-center justify-between p-1 border border-white/5 bg-black/40 group overflow-hidden transition-all
          ${isCorner ? 'aspect-square bg-white/[0.03]' : 'flex-1'}
        `}
      >
        {/* Color Bar for properties */}
        {!isCorner && cssColor && (
          <div
            className="absolute top-0 left-0 right-0 h-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
            style={{ backgroundColor: cssColor }}
          />
        )}

        {/* Space Name */}
        <div className={`
          text-[7px] font-black uppercase tracking-tighter text-center mt-2 leading-none
          ${isCorner ? 'text-purple-400 text-[9px]' : 'text-white/60 group-hover:text-white'}
        `}>
          {boardSpace.name}
        </div>

        {/* Special Icons */}
        <div className="flex-1 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
          {boardSpace.index === 0 && <div className="text-emerald-400 rotate-45 scale-150"><StarIcon /></div>}
          {boardSpace.index === 10 && <div className="text-orange-400 scale-150"><ShieldIcon /></div>}
          {boardSpace.index === 20 && <div className="text-sky-400 scale-150"><GlobeIcon /></div>}
          {boardSpace.index === 30 && <div className="text-red-400 scale-150"><AlertIcon /></div>}
          {boardSpace.type === SpaceType.TAX && !isCorner && <div className="text-amber-400 scale-75"><AlertIcon /></div>}
          {boardSpace.type === SpaceType.PROPERTY && !isCorner && <div className="text-white/10 scale-75"><HomeIcon /></div>}
        </div>

        {/* Price */}
        {boardSpace.price && !isCorner && (
          <div className="mb-1 text-[8px] font-bold text-yellow-500/80 tracking-tighter">
            {boardSpace.price.toLocaleString()}
          </div>
        )}

        {/* Buildings Indicators */}
        {ps && (ps.houses > 0 || ps.hotel) && (
          <div className="absolute top-2 right-1 flex gap-0.5">
            {ps.hotel ? (
              <div className="text-red-500 scale-[0.6]"><HotelIcon /></div>
            ) : (
              Array.from({ length: ps.houses }).map((_, i) => (
                <div key={i} className="text-emerald-500 scale-[0.5]"><HouseIcon /></div>
              ))
            )}
          </div>
        )}

        {/* Mortgage Overlay */}
        {ps?.mortgaged && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-[7px] font-black text-red-400 uppercase tracking-tighter rotate-[-20deg]">Mortgaged</span>
          </div>
        )}

        {/* Player Tokens */}
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1 p-2 pointer-events-none">
          {occupants.map((player, i) => (
            <div
              key={player.id}
              className="w-4 h-4 rounded-full border border-white/20 shadow-xl animate-in zoom-in duration-300 transition-all"
              style={{
                backgroundColor: player.color,
                transform: `translate(${i * 2}px, ${i * 2}px)`,
                boxShadow: `0 0 15px ${player.color}40`
              }}
              title={player.displayName}
            >
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-black/20 to-white/20" />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full max-w-4xl aspect-square p-4 select-none">
      <div className="absolute inset-0 bg-purple-500/5 blur-[100px] rounded-full" />

      <div className="relative w-full h-full flex flex-col border border-white/10 rounded-3xl bg-black/60 backdrop-blur-xl shadow-2xl overflow-hidden shadow-purple-500/10">

        {/* Top Row */}
        <div className="h-[15%] flex flex-row-reverse border-b border-white/5">
          {BOARD_SPACES.slice(20, 31).map(renderSpace)}
        </div>

        {/* Middle */}
        <div className="flex-1 flex">
          {/* Left Column */}
          <div className="w-[15%] flex flex-col-reverse border-r border-white/5">
            {BOARD_SPACES.slice(11, 20).map(renderSpace)}
          </div>

          {/* Center Hub */}
          <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden">
            <div className="absolute inset-0 opacity-5 flex items-center justify-center">
              <DiceIcon />
            </div>

            <div className="relative z-10 text-center animate-in fade-in zoom-in duration-1000">
              <h2 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-400 to-blue-500 mb-2 drop-shadow-2xl">
                UMUKINO
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent mx-auto mb-6" />

              {vacationPool > 0 && (
                <div className="inline-flex flex-col items-center gap-1 px-6 py-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 shadow-lg shadow-sky-500/5 mb-6">
                  <span className="text-[10px] uppercase font-black tracking-[0.2em] text-sky-400/60">Vacation Pool</span>
                  <span className="text-2xl font-black text-white tracking-tight tabular-nums">
                    {vacationPool.toLocaleString()} <span className="text-sm text-white/40">RWF</span>
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <div className="text-[10px] uppercase font-black tracking-widest text-white/20 mb-1">Status</div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live match
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase font-black tracking-widest text-white/20 mb-1">Capacity</div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-white/60 uppercase">
                    <UsersIcon /> {players.length}/{settings.maxPlayers}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute top-4 left-4 text-white/5 rotate-[-45deg] scale-[2]"><CrownIcon /></div>
            <div className="absolute bottom-4 right-4 text-white/5 rotate-[135deg] scale-[2]"><DiceIcon /></div>
          </div>

          {/* Right Column */}
          <div className="w-[15%] flex flex-col border-l border-white/5">
            {BOARD_SPACES.slice(31, 40).map(renderSpace)}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="h-[15%] flex border-t border-white/5">
          {BOARD_SPACES.slice(0, 11).reverse().map(renderSpace)}
        </div>
      </div>
    </div>
  );
};