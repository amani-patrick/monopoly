'use client';

import type { GameCard } from '@umukino/shared-types';
import { CardDeckType } from '@umukino/shared-types';
import { StarIcon, GiftIcon, AlertIcon, ArrowUpIcon, ShieldIcon, UsersIcon } from '../layout/Icons';

interface CardModalProps {
  card: GameCard;
  onClose: () => void;
}

export const CardModal = ({ card, onClose }: CardModalProps) => {
  const isChance = card.deck === CardDeckType.SURPRISE;

  const renderEffect = () => {
    switch (card.action) {
      case 'GAIN':
        return `+ ${card.amount?.toLocaleString()} RWF`;
      case 'LOSE':
        return `- ${card.amount?.toLocaleString()} RWF`;
      case 'MOVE_TO':
        return `Advance to Space ${card.moveTo}`;
      case 'MOVE_BY':
        return `Move ${card.moveBy && card.moveBy > 0 ? 'forward' : 'back'} ${Math.abs(card.moveBy ?? 0)} spaces`;
      case 'GO_TO_JAIL':
        return 'Direct to Prison';
      case 'GET_OUT_OF_JAIL_FREE':
        return 'Freedom Card Issued';
      case 'COLLECT_FROM_PLAYERS':
        return `Collect ${card.amount?.toLocaleString()} RWF per player`;
      case 'PAY_TO_PLAYERS':
        return `Pay ${card.amount?.toLocaleString()} RWF per player`;
      case 'STREET_REPAIRS':
        return `House: ${card.houseCost?.toLocaleString()} · Hotel: ${card.hotelCost?.toLocaleString()} RWF each`;
      case 'SKIP_TURN':
        return 'Lose your next turn';
      case 'GO_TO_START':
        return 'Return to Start — Collect bonus';
      default:
        return '';
    }
  };

  const effectIcon = () => {
    if (card.action === 'GAIN' || card.action === 'COLLECT_FROM_PLAYERS') return <ArrowUpIcon />;
    if (card.action === 'LOSE' || card.action === 'PAY_TO_PLAYERS' || card.action === 'STREET_REPAIRS') return <AlertIcon />;
    if (card.action === 'GO_TO_JAIL') return <ShieldIcon />;
    if (card.action === 'COLLECT_FROM_PLAYERS' || card.action === 'PAY_TO_PLAYERS') return <UsersIcon />;
    return null;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-500" />

      <div className="relative w-full max-w-sm bg-[#0f0f1a] border border-white/10 rounded-[3rem] p-8 shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-10 duration-500">
        {/* Card Body */}
        <div
          className={`
            relative aspect-[3/4] w-full rounded-[2rem] p-8 flex flex-col items-center justify-between text-center overflow-hidden border-2 shadow-2xl
            ${isChance
              ? 'bg-gradient-to-br from-orange-600 to-red-700 border-orange-400/30'
              : 'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-400/30'
            }
          `}
        >
          {/* Dot pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none grid grid-cols-6 gap-4 p-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="w-1 h-1 bg-white rounded-full" />
            ))}
          </div>

          {/* Header */}
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-4 mx-auto shadow-xl">
              {isChance ? <StarIcon /> : <GiftIcon />}
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60 mb-1">
              {isChance ? 'Surprise Card' : 'Treasure Chest'}
            </h3>
            <div className="h-px w-12 bg-white/20 mx-auto" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex-1 flex flex-col justify-center gap-4">
            <p className="text-base font-bold text-white leading-snug px-2">
              {card.text}
            </p>
            {card.textKiny && (
              <p className="text-[10px] font-medium text-white/50 italic">
                {card.textKiny}
              </p>
            )}
          </div>

          {/* Effect Badge */}
          <div className="relative z-10 w-full bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-inner">
            <div className="flex items-center justify-center gap-2 text-white font-black uppercase tracking-widest text-[10px]">
              {effectIcon()}
              <span>{renderEffect()}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-8 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-[0.3em] py-4 rounded-2xl transition-all active:scale-95 shadow-xl"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
};