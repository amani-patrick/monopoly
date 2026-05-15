'use client';

import { useState, useEffect } from 'react';
import { AuctionIcon, WalletIcon, ClockIcon, GavelIcon } from '../layout/Icons';
import { BOARD_SPACES } from '@umukino/board-data';

interface AuctionModalProps {
  auction: Auction;
  myBalance: number;
  onBid: (amount: number) => void;
}

export const AuctionModal = ({ auction, myBalance, onBid }: AuctionModalProps) => {
  const [customBid, setCustomBid] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [initialTime] = useState(() => {
    const seconds = Math.max(0, Math.floor((new Date(auction.endsAt).getTime() - Date.now()) / 1000));
    return seconds;
  });
  const [progress, setProgress] = useState(100);

  const boardSpace = BOARD_SPACES.find(s => s.index === auction.spaceIndex);
  const propertyName = boardSpace?.name ?? `Space #${auction.spaceIndex}`;
  const minimumBid = auction.currentBid > 0 ? auction.currentBid + 1000 : (boardSpace?.price ?? 1000);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(auction.endsAt).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      setProgress(initialTime > 0 ? (remaining / initialTime) * 100 : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [auction.endsAt, initialTime]);

  const quickBids = [1000, 5000, 10000]
    .map(inc => auction.currentBid + inc)
    .filter(bid => bid <= myBalance && bid >= minimumBid);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-500" />

      <div className="relative w-full max-w-md bg-[#0f0f1a] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-10 duration-500">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[60px] rounded-full" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[60px] rounded-full" />

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-4">
            <AuctionIcon /> Live Auction
          </div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter mb-2">
            {propertyName}
          </h2>
          <p className="text-white/40 text-xs font-medium uppercase tracking-widest">Property Acquisition</p>
        </div>

        {/* Timer Bar */}
        <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden mb-8">
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
          {timeLeft < 5 && <div className="absolute inset-0 bg-red-500 animate-pulse" />}
        </div>

        {/* Current Bid */}
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 mb-8 text-center">
          <div className="text-[10px] uppercase font-black tracking-[0.2em] text-white/30 mb-2">Current Highest Bid</div>
          <div className="text-4xl font-black text-yellow-400 tabular-nums tracking-tighter mb-1">
            {auction.currentBid.toLocaleString()}
            <span className="text-lg text-yellow-400/40 ml-2 italic">RWF</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-white/60">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {auction.currentBidderId ? 'Someone is leading' : 'No bids yet — be first!'}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <div className="text-[9px] uppercase font-black tracking-widest text-white/20 mb-1 flex items-center gap-1.5">
              <WalletIcon /> Your Wallet
            </div>
            <div className="text-sm font-bold text-emerald-400">
              {myBalance.toLocaleString()} <span className="text-[10px] text-emerald-400/40">RWF</span>
            </div>
          </div>
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <div className="text-[9px] uppercase font-black tracking-widest text-white/20 mb-1 flex items-center gap-1.5">
              <ClockIcon /> Time Left
            </div>
            <div className={`text-sm font-bold ${timeLeft < 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {timeLeft}s
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {quickBids.length > 0 && (
            <div className="flex gap-2">
              {quickBids.map((amount) => (
                <button
                  key={amount}
                  onClick={() => onBid(amount)}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest text-white/80 transition-all active:scale-95"
                >
                  +{(amount - auction.currentBid).toLocaleString()}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <input
              type="number"
              value={customBid}
              onChange={(e) => setCustomBid(e.target.value)}
              placeholder={`Min: ${minimumBid.toLocaleString()} RWF`}
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 pr-32 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50 transition-all"
            />
            <button
              onClick={() => {
                const amount = parseInt(customBid);
                if (amount >= minimumBid && amount <= myBalance) {
                  onBid(amount);
                  setCustomBid('');
                }
              }}
              disabled={!customBid || parseInt(customBid) < minimumBid || parseInt(customBid) > myBalance}
              className="absolute right-2 top-2 bottom-2 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-white/10 disabled:to-white/10 disabled:text-white/20 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-purple-500/20 active:scale-95"
            >
              Bid
            </button>
          </div>
        </div>

        <p className="text-[9px] text-white/20 mt-6 text-center uppercase font-black tracking-[0.3em]">
          Authority: Game Engine Auctioneer
        </p>
      </div>
    </div>
  );
};