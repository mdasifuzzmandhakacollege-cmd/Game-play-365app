/**
 * @file LobbyHeader.tsx
 * @description Luxury Emerald & Gold Lobby Header Section for PLAY369.
 * Includes Progressive Jackpot Bar, Live Winner Announcement Marquee, and Quick Search Trigger.
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Play, Volume2, Search, Sparkles, Gift, Crown } from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';

export interface LobbyHeaderProps {
  onOpenSearch: () => void;
  onLaunchGame: (gameId: string) => void;
  onOpenCashier: () => void;
  onOpenVip?: () => void;
}

export const LobbyHeader: React.FC<LobbyHeaderProps> = ({
  onOpenSearch,
  onLaunchGame,
  onOpenCashier,
  onOpenVip
}) => {
  // Live simulated progressive jackpot counter (Mock UI visual only)
  const [jackpotAmount, setJackpotAmount] = useState(18945820);

  useEffect(() => {
    const timer = setInterval(() => {
      setJackpotAmount((prev) => prev + Math.floor(Math.random() * 28) + 12);
    }, 1618); // Golden Ratio interval 1.618s
    return () => clearInterval(timer);
  }, []);

  return (
    <header id="play369-lobby-header" className="w-full space-y-2.5 sm:space-y-3">
      {/* 1. Live Speaker Marquee Announcement Ticker */}
      <div
        id="play369-marquee-strip"
        className="flex items-center space-x-2.5 bg-[#02180e] border border-emerald-800/80 rounded-2xl px-3 py-2 text-xs overflow-hidden shadow-inner"
        aria-label="Live Casino Announcements"
      >
        <div className="flex items-center space-x-1.5 text-amber-400 font-bold shrink-0">
          <Volume2 className="w-4 h-4 animate-bounce text-amber-400" />
          <span className="hidden xs:inline font-mono text-[11px] uppercase tracking-wider">
            Notice:
          </span>
        </div>
        <div className="overflow-hidden whitespace-nowrap w-full">
          <div className="inline-block animate-[marquee_25s_linear_infinite] text-emerald-200/90 font-mono text-[11px] sm:text-xs">
            🎉 <strong className="text-amber-400">User 017***5643</strong> just cashed out <strong className="text-amber-300">৳48,500</strong> on Spribe Aviator! • 💎 Daily VIP Login Bonus ৳999 is live • ⚡ Instant 24/7 Auto-Withdrawal active • 🚀 Gates of Olympus 1000x multiplier unlocked!
          </div>
        </div>
      </div>

      {/* 2. Progressive Mega Jackpot & Quick Action Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3 items-center">
        {/* Left: Jackpot Banner */}
        <div className="md:col-span-7 bg-gradient-to-r from-emerald-950 via-[#032014] to-[#02180e] border border-emerald-700/80 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-400 flex items-center justify-center text-slate-950 shrink-0 shadow-md">
              <Trophy className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-[10px] text-emerald-300/80 font-mono uppercase tracking-wider flex items-center space-x-1.5">
                <span>Mega Progressive Jackpot</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              </div>
              <div className="text-lg sm:text-2xl font-black font-mono text-amber-400 drop-shadow-xs">
                ৳ {jackpotAmount.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            id="play369-jackpot-play-btn"
            onClick={() => {
              soundEngine.playClick(1000);
              onLaunchGame('spribe_aviator');
            }}
            className="min-h-[48px] px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs font-mono shadow-md active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>Play Aviator</span>
          </button>
        </div>

        {/* Right: Quick Action Launchers (Min 48px touch targets) */}
        <div className="md:col-span-5 grid grid-cols-2 gap-2">
          {/* Quick Search Trigger */}
          <button
            id="play369-quick-search-btn"
            onClick={() => {
              soundEngine.playClick(900);
              onOpenSearch();
            }}
            className="min-h-[48px] py-2 px-3 rounded-2xl bg-[#031c11] hover:bg-[#062c1b] border border-emerald-700/80 hover:border-amber-400/80 text-emerald-100 font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Search className="w-4 h-4 text-amber-400" />
            <span className="font-sans">Search Games</span>
          </button>

          {/* Deposit / VIP CTA */}
          <button
            id="play369-header-deposit-btn"
            onClick={() => {
              soundEngine.playClick(1000);
              onOpenCashier();
            }}
            className="min-h-[48px] py-2 px-3 rounded-2xl bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-600/70 text-amber-300 font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span className="font-sans">Deposit Bonus</span>
          </button>
        </div>
      </div>
    </header>
  );
};
