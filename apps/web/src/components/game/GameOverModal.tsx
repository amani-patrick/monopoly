'use client';

import type { Player } from '@umukino/shared-types';
import { TrophyIcon, CrownIcon, RefreshIcon, DashboardIcon } from '../layout/Icons';

interface GameOverModalProps {
  players: Player[];
  myId?: string;
}

export const GameOverModal = ({ players, myId }: GameOverModalProps) => {
  const sortedPlayers = [...players].sort((a, b) => b.balance - a.balance);
  const winner = sortedPlayers[0];
  const isWinner = winner?.userId === myId;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-1000" />

      <div className="relative w-full max-w-xl bg-[#0f0f1a] border border-white/10 rounded-[3rem] p-10 shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-20 duration-1000">
        {/* Light streaks */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-purple-500 to-transparent" />
          <div className="absolute top-0 left-2/4 w-px h-full bg-gradient-to-b from-blue-500 to-transparent" />
          <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-emerald-500 to-transparent" />
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="relative inline-block mb-6">
            <div className={`
              w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl border-2 animate-bounce
              ${isWinner ? 'bg-yellow-500/10 border-yellow-400 text-yellow-400' : 'bg-white/5 border-white/10 text-white/40'}
            `}>
              {isWinner ? <TrophyIcon /> : <CrownIcon />}
            </div>
            {isWinner && <div className="absolute -inset-4 bg-yellow-400/20 blur-3xl rounded-full animate-pulse -z-10" />}
          </div>

          <h2 className={`
            text-5xl font-black italic tracking-tighter mb-2
            ${isWinner ? 'text-transparent bg-clip-text bg-gradient-to-br from-yellow-200 via-yellow-400 to-orange-500' : 'text-white'}
          `}>
            {isWinner ? 'VICTORY' : 'GAME OVER'}
          </h2>
          <p className="text-white/40 text-sm font-black uppercase tracking-[0.3em]">Match results finalized</p>
        </div>

        {/* Standings */}
        <div className="space-y-3 mb-10">
          {sortedPlayers.slice(0, 4).map((player, index) => {
            const isMe = player.userId === myId;
            return (
              <div
                key={player.id}
                className={`
                  relative flex items-center justify-between p-4 rounded-2xl border transition-all
                  ${index === 0 ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-white/[0.03] border-white/5'}
                  ${isMe ? 'ring-1 ring-purple-500/50' : ''}
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0
                    ${index === 0 ? 'bg-yellow-400 text-black' : index === 1 ? 'bg-slate-300 text-black' : index === 2 ? 'bg-orange-600 text-white' : 'bg-white/10 text-white/30'}
                  `}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      {player.displayName}
                      {isMe && <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">YOU</span>}
                    </div>
                    <div className="text-[10px] text-white/30 uppercase font-black tracking-widest">
                      {player.status === 'BANKRUPT' ? 'Eliminated' : 'Finalist'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-sm font-black tabular-nums ${player.status === 'BANKRUPT' ? 'text-red-400/50 line-through' : 'text-yellow-400'}`}>
                    {player.balance.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-white/20 uppercase font-black tracking-tighter">RWF</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.href = '/lobby'}
            className="w-full flex items-center justify-center gap-3 py-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-3xl transition-all shadow-xl shadow-purple-500/20 active:scale-95"
          >
            <DashboardIcon /> Return to Lobby
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-95"
          >
            <RefreshIcon /> New Session
          </button>
        </div>

        <p className="text-[9px] text-white/10 mt-8 text-center uppercase font-black tracking-[0.4em]">
          Authority: Umukino Global Matchmaking
        </p>
      </div>
    </div>
  );
};