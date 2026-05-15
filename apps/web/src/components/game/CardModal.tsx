'use client';

import { StarIcon, GiftIcon, AlertIcon, ArrowUpIcon, ShieldIcon, UsersIcon } from '../layout/Icons';

interface Card {
  id: string;
  type: 'chance' | 'community_chest';
  title: string;
  description: string;
  effect: {
    type: 'money' | 'move' | 'jail' | 'get_out_of_jail' | 'collect_from_players';
    amount?: number;
    position?: number;
  };
}

interface CardModalProps {
  card: Card;
  onClose: () => void;
}

export const CardModal = ({ card, onClose }: CardModalProps) => {
  const isChance = card.type === 'chance';
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-500" />
      
      {/* Modal */}
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
          {/* Patterns */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)]" />
            <div className="grid grid-cols-6 gap-4 p-4">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="w-1 h-1 bg-white rounded-full opacity-20" />
              ))}
            </div>
          </div>

          {/* Header */}
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl mb-4 mx-auto shadow-xl">
              {isChance ? <StarIcon /> : <GiftIcon />}
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60 mb-1">
              {isChance ? 'Surprise Card' : 'Treasure Chest'}
            </h3>
            <div className="h-px w-12 bg-white/20 mx-auto" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex-1 flex flex-col justify-center gap-4">
            <h4 className="text-2xl font-black text-white italic tracking-tighter leading-none">
              {card.title}
            </h4>
            <p className="text-xs font-medium text-white/70 leading-relaxed max-w-[200px]">
              {card.description}
            </p>
          </div>

          {/* Effect Badge */}
          <div className="relative z-10 w-full bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-inner">
            <div className="flex items-center justify-center gap-2 text-white font-black uppercase tracking-widest text-[10px]">
              {card.effect.type === 'money' && (card.effect.amount! > 0 ? <ArrowUpIcon /> : <AlertIcon />)}
              {card.effect.type === 'jail' && <ShieldIcon />}
              {card.effect.type === 'collect_from_players' && <UsersIcon />}
              
              <span>
                {card.effect.type === 'money' && (
                  card.effect.amount! > 0 
                    ? `+ ${card.effect.amount!.toLocaleString()} RWF`
                    : `- ${Math.abs(card.effect.amount!).toLocaleString()} RWF`
                )}
                {card.effect.type === 'move' && `Advance to Space ${card.effect.position}`}
                {card.effect.type === 'jail' && 'Direct to Prison'}
                {card.effect.type === 'get_out_of_jail' && 'Freedom Card Issued'}
                {card.effect.type === 'collect_from_players' && `Tax: ${card.effect.amount?.toLocaleString()} per player`}
              </span>
            </div>
          </div>
        </div>

        {/* Action */}
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