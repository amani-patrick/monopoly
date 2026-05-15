'use client';

import { useState } from 'react';
import {
  DiceIcon, WalletIcon, HomeIcon, HotelIcon, HouseIcon,
  ShieldIcon, ArrowUpIcon, ArrowDownIcon, ClockIcon,
  CardIcon, CheckIcon
} from '../layout/Icons';
import type { GameState, PropertyState, TurnPhase } from '@umukino/shared-types';
import { BOARD_SPACES } from '@umukino/board-data';

interface ActionPanelProps {
  gameState: GameState;
  myId?: string;
  actions: {
    rollDice: () => void;
    buyProperty: () => void;
    skipBuy: () => void;
    buildHouse: (spaceIndex: number) => void;
    buildHotel: (spaceIndex: number) => void;
    mortgageProperty: (spaceIndex: number) => void;
    unmortgageProperty: (spaceIndex: number) => void;
    payJailFine: () => void;
    useJailCard: () => void;
    endTurn: () => void;
    initiateTrade: (data: any) => void;
  };
}

export const ActionPanel = ({ gameState, myId, actions }: ActionPanelProps) => {
  const [_selectedProperty, setSelectedProperty] = useState<number | null>(null);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.userId === myId;
  const myPropertyStates = gameState.properties.filter(p => p.ownerId === currentPlayer?.id);

  const ActionButton = ({
    onClick, disabled = false, children, variant = 'primary'
  }: {
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  }) => {
    const variants: Record<string, string> = {
      primary: 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/20',
      secondary: 'bg-white/5 hover:bg-white/10 border border-white/10',
      success: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20',
      warning: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/20',
      danger: 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-500/20',
    };

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-white
          transition-all duration-200 shadow-xl active:scale-95
          disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100
          ${disabled ? 'bg-white/5 border border-white/10' : variants[variant]}
        `}
      >
        {children}
      </button>
    );
  };

  const renderActions = () => {
    switch (gameState.turnPhase) {
      case 'ROLL':
        return (
          <div className="space-y-3">
            <ActionButton onClick={actions.rollDice} disabled={!isMyTurn} variant="primary">
              <DiceIcon /> Roll Dice
            </ActionButton>
            {isMyTurn && (
              <p className="text-[9px] text-center text-white/20 uppercase font-black tracking-widest">
                Your turn — roll to advance
              </p>
            )}
          </div>
        );

      case 'BUY_DECISION':
        return (
          <div className="space-y-3">
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 text-center">
              <p className="text-[10px] uppercase font-black tracking-widest text-white/30 mb-1">Opportunity Available</p>
              <p className="text-xs text-white/60">Purchase this property?</p>
            </div>
            <ActionButton onClick={actions.buyProperty} disabled={!isMyTurn} variant="success">
              <WalletIcon /> Buy Property
            </ActionButton>
            <ActionButton onClick={actions.skipBuy} disabled={!isMyTurn} variant="secondary">
              Skip — Pass to Auction
            </ActionButton>
          </div>
        );

      case 'ACTION':
        return (
          <div className="space-y-4">
            <div className="text-[10px] uppercase font-black tracking-widest text-white/30 flex items-center gap-2">
              <HomeIcon /> Property Management
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {myPropertyStates.length === 0 ? (
                <div className="text-center py-6 text-white/20 text-xs uppercase font-black tracking-widest">
                  No properties owned
                </div>
              ) : (
                myPropertyStates.map((ps: PropertyState) => {
                  const boardSpace = BOARD_SPACES.find(s => s.index === ps.spaceIndex);
                  return (
                    <div
                      key={ps.spaceIndex}
                      className="bg-white/[0.03] border border-white/5 rounded-2xl p-3"
                    >
                      <div className="text-[10px] font-bold text-white/70 mb-2 truncate">
                        {boardSpace?.name ?? `Space #${ps.spaceIndex}`}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {!ps.hotel && ps.houses < 4 && (
                          <button
                            onClick={() => actions.buildHouse(ps.spaceIndex)}
                            className="flex-1 min-w-[70px] flex items-center justify-center gap-1 px-2 py-2 text-[9px] font-black uppercase tracking-tight bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-xl transition-all active:scale-95"
                          >
                            <HouseIcon /> House
                          </button>
                        )}
                        {ps.houses === 4 && !ps.hotel && (
                          <button
                            onClick={() => actions.buildHotel(ps.spaceIndex)}
                            className="flex-1 min-w-[70px] flex items-center justify-center gap-1 px-2 py-2 text-[9px] font-black uppercase tracking-tight bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all active:scale-95"
                          >
                            <HotelIcon /> Hotel
                          </button>
                        )}
                        {!ps.mortgaged ? (
                          <button
                            onClick={() => actions.mortgageProperty(ps.spaceIndex)}
                            className="flex-1 min-w-[70px] flex items-center justify-center gap-1 px-2 py-2 text-[9px] font-black uppercase tracking-tight bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-xl transition-all active:scale-95"
                          >
                            <ArrowDownIcon /> Mortgage
                          </button>
                        ) : (
                          <button
                            onClick={() => actions.unmortgageProperty(ps.spaceIndex)}
                            className="flex-1 min-w-[70px] flex items-center justify-center gap-1 px-2 py-2 text-[9px] font-black uppercase tracking-tight bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 rounded-xl transition-all active:scale-95"
                          >
                            <ArrowUpIcon /> Lift
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <ActionButton onClick={actions.endTurn} disabled={!isMyTurn} variant="secondary">
              <CheckIcon /> End Turn
            </ActionButton>
          </div>
        );

      case 'JAIL_DECISION':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
              <div className="text-orange-400"><ShieldIcon /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">In Prison</p>
                <p className="text-[9px] text-white/30 mt-0.5">Choose an escape route</p>
              </div>
            </div>
            <ActionButton onClick={actions.payJailFine} disabled={!isMyTurn} variant="warning">
              <WalletIcon /> Pay 500 RWF Fine
            </ActionButton>
            <ActionButton onClick={actions.useJailCard} disabled={!isMyTurn} variant="primary">
              <CardIcon /> Use Freedom Card
            </ActionButton>
            <ActionButton onClick={actions.rollDice} disabled={!isMyTurn} variant="secondary">
              <DiceIcon /> Roll for Doubles
            </ActionButton>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center gap-4 py-6">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30">Awaiting Players</p>
              <p className="text-xs text-white/20 mt-1">Match starts soon...</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-white/30">
          <ClockIcon /> Round {gameState.round}
        </div>
        <div className={`
          px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border
          ${gameState.turnPhase === 'ROLL' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : ''}
          ${gameState.turnPhase === 'BUY_DECISION' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : ''}
          ${gameState.turnPhase === 'JAIL_DECISION' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : ''}
          ${gameState.turnPhase === 'ACTION' ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : ''}
          ${gameState.turnPhase === 'AUCTION' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' : ''}
        `}>
          {gameState.turnPhase}
        </div>
      </div>

      {/* Actions */}
      <div className="flex-1">
        {renderActions()}
      </div>

      {/* Waiting for other player */}
      {!isMyTurn && (
        <div className="flex items-center justify-center gap-2 py-3 bg-white/[0.03] border border-white/5 rounded-2xl">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/30">
            {currentPlayer?.displayName}&apos;s turn
          </span>
        </div>
      )}
    </div>
  );
};