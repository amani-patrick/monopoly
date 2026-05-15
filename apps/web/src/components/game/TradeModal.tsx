'use client';

import type { Trade } from '@umukino/shared-types';
import { TradeIcon, WalletIcon, HomeIcon, CheckIcon, XIcon, ArrowUpIcon, ArrowDownIcon } from '../layout/Icons';
import { BOARD_SPACES } from '@umukino/board-data';

interface TradeModalProps {
  trade: Trade;
  fromPlayerName: string; // passed separately since Trade type doesn't carry display name
  onAccept: () => void;
  onReject: () => void;
}

export const TradeModal = ({ trade, fromPlayerName, onAccept, onReject }: TradeModalProps) => {
  const lookupName = (idx: number) => BOARD_SPACES.find(s => s.index === idx)?.name ?? `Space #${idx}`;

  const AssetRow = ({
    icon, label, value
  }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[10px] uppercase font-black text-white/20">{label}</div>
        <div className="text-sm font-black text-white truncate max-w-[130px]">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-500" />

      <div className="relative w-full max-w-2xl bg-[#0f0f1a] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-10 duration-500">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">
            <TradeIcon /> Proposed Exchange
          </div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter mb-2">
            Offer from {fromPlayerName}
          </h2>
          <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Review the asset transfer request</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* They Offer */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
              <ArrowUpIcon /> They Offer
            </div>
            <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 flex flex-col gap-3">
              {trade.offer.cash > 0 && (
                <AssetRow
                  icon={<div className="text-yellow-400"><WalletIcon /></div>}
                  label="Currency"
                  value={`${trade.offer.cash.toLocaleString()} RWF`}
                />
              )}
              {trade.offer.jailFreeCards > 0 && (
                <AssetRow
                  icon={<div className="text-purple-400"><HomeIcon /></div>}
                  label="Get Out of Jail"
                  value={`${trade.offer.jailFreeCards} card(s)`}
                />
              )}
              {trade.offer.properties.map(idx => (
                <AssetRow
                  key={idx}
                  icon={<div className="text-purple-400"><HomeIcon /></div>}
                  label="Property"
                  value={lookupName(idx)}
                />
              ))}
              {trade.offer.cash === 0 && trade.offer.properties.length === 0 && trade.offer.jailFreeCards === 0 && (
                <div className="text-center py-8 text-white/20 text-xs font-medium uppercase italic">Nothing offered</div>
              )}
            </div>
          </div>

          {/* They Request */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] font-black text-rose-400 uppercase tracking-widest">
              <ArrowDownIcon /> They Request
            </div>
            <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-[2rem] p-6 flex flex-col gap-3">
              {trade.request.cash > 0 && (
                <AssetRow
                  icon={<div className="text-yellow-400"><WalletIcon /></div>}
                  label="Currency"
                  value={`${trade.request.cash.toLocaleString()} RWF`}
                />
              )}
              {trade.request.jailFreeCards > 0 && (
                <AssetRow
                  icon={<div className="text-rose-400"><HomeIcon /></div>}
                  label="Get Out of Jail"
                  value={`${trade.request.jailFreeCards} card(s)`}
                />
              )}
              {trade.request.properties.map(idx => (
                <AssetRow
                  key={idx}
                  icon={<div className="text-rose-400"><HomeIcon /></div>}
                  label="Property"
                  value={lookupName(idx)}
                />
              ))}
              {trade.request.cash === 0 && trade.request.properties.length === 0 && trade.request.jailFreeCards === 0 && (
                <div className="text-center py-8 text-white/20 text-xs font-medium uppercase italic">Nothing requested</div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={onReject}
            className="flex-1 flex items-center justify-center gap-3 py-5 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-white hover:text-rose-400 text-xs font-black uppercase tracking-[0.2em] rounded-3xl transition-all active:scale-95"
          >
            <XIcon /> Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 flex items-center justify-center gap-3 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-3xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
          >
            <CheckIcon /> Accept
          </button>
        </div>

        <p className="text-[9px] text-white/20 mt-8 text-center uppercase font-black tracking-[0.3em]">
          Transfer requires final confirmation
        </p>
      </div>
    </div>
  );
};
