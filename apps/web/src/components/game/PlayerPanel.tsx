'use client';

import { WalletIcon, ShieldIcon, BanIcon, ClockIcon, CrownIcon } from '../layout/Icons';
import type { Player, PlayerStatus } from '@umukino/shared-types';

interface PlayerPanelProps {
  players: Player[];
  currentPlayerId?: string;
  myId?: string;
}

export const PlayerPanel = ({ players, currentPlayerId, myId }: PlayerPanelProps) => {
  const sortedPlayers = [...players].sort((a, b) => b.balance - a.balance);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white/50 flex items-center gap-2">
          <CrownIcon /> Standings
        </h3>
        <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full border border-white/10 uppercase font-bold tracking-tighter">
          Live
        </span>
      </div>

      <div className="space-y-3">
        {sortedPlayers.map((player, index) => {
          const isCurrentTurn = player.id === currentPlayerId;
          const isMe = player.userId === myId;
          const isBankrupt = player.status === 'BANKRUPT';
          const isJailed = player.status === 'IN_JAIL';
          const isDisconnected = player.status === 'DISCONNECTED';

          return (
            <div
              key={player.id}
              className={`relative group transition-all duration-300 ${
                isCurrentTurn ? 'scale-[1.02] z-10' : 'scale-100'
              }`}
            >
              {/* Turn Glow */}
              {isCurrentTurn && (
                <div className="absolute -inset-[1px] bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur-sm opacity-50 animate-pulse" />
              )}

              <div
                className={`
                  relative p-4 rounded-2xl border backdrop-blur-sm transition-all
                  ${isCurrentTurn
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.06]'
                  }
                  ${isBankrupt ? 'opacity-40 grayscale' : ''}
                `}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-xl border-2 flex items-center justify-center text-lg font-black shadow-lg"
                        style={{
                          backgroundColor: `${player.color}20`,
                          borderColor: player.color,
                          color: player.color
                        }}
                      >
                        {player.displayName[0].toUpperCase()}
                      </div>
                      {/* Rank badge */}
                      <div className="absolute -top-2 -left-2 w-5 h-5 bg-black border border-white/20 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-xl">
                        {index + 1}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5 truncate max-w-[120px]">
                        {player.displayName}
                        {isMe && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-md border border-purple-500/20 uppercase tracking-tighter">Me</span>}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${player.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
                          {player.connected ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isCurrentTurn && (
                    <div className="bg-purple-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-lg animate-bounce shadow-lg shadow-purple-500/20 tracking-widest">
                      ROLLING
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                    <div className="flex items-center gap-1.5 text-[10px] text-white/30 uppercase font-bold mb-1">
                      <WalletIcon /> Balance
                    </div>
                    <div className="text-sm font-black text-yellow-400 tabular-nums">
                      {player.balance.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                    <div className="flex items-center gap-1.5 text-[10px] text-white/30 uppercase font-bold mb-1">
                      <ClockIcon /> Space
                    </div>
                    <div className="text-sm font-black text-white/80">
                      #{player.position}
                    </div>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {isJailed && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-[10px] font-bold text-orange-400 uppercase">
                      <ShieldIcon /> In Prison
                    </div>
                  )}
                  {isBankrupt && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400 uppercase">
                      <BanIcon /> Bankrupt
                    </div>
                  )}
                  {isDisconnected && !isBankrupt && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-500/10 border border-gray-500/20 text-[10px] font-bold text-gray-400 uppercase">
                      <BanIcon /> Offline
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
