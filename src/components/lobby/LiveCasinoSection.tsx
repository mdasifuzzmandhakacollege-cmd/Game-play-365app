/**
 * @file LiveCasinoSection.tsx
 * @description Luxury Live Casino Horizontal Swipe Section for PLAY369 Mobile Dashboard.
 * Displays authoritative Live Casino tables (Evolution, Pragmatic Live, Ezugi) with horizontal swipe cards.
 */

import React from 'react';
import { ChevronRight, Play, Sparkles } from 'lucide-react';
import { GameItem } from '../../services/providers/types';
import { soundEngine } from '../../services/soundEngine';

export interface LiveCasinoSectionProps {
  games: GameItem[];
  onLaunchGame: (gameId: string) => void;
  onViewAllCasino?: () => void;
}

export const LiveCasinoSection: React.FC<LiveCasinoSectionProps> = ({
  games,
  onLaunchGame,
  onViewAllCasino
}) => {
  // Filter for casino games from real catalog
  const liveCasinoGames = games.filter((g) => g.category === 'casino' || g.category === 'table').slice(0, 8);

  if (liveCasinoGames.length === 0) return null;

  return (
    <section id="play369-live-casino-section" className="space-y-2.5 sm:space-y-3" aria-label="Live Casino Games">
      {/* Section Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <h3 className="text-sm sm:text-base font-black text-white font-sans tracking-tight uppercase">
            Live Casino
          </h3>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black bg-rose-600/30 text-rose-400 border border-rose-500/40">
            HD FEED
          </span>
        </div>

        {onViewAllCasino && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick(800);
              onViewAllCasino();
            }}
            className="min-h-[48px] px-2 text-xs font-mono text-amber-300 hover:text-amber-200 flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Horizontal Swipe Rail */}
      <div className="w-full overflow-x-auto scrollbar-none -mx-2 px-2 sm:mx-0 sm:px-0 py-1">
        <div className="flex items-stretch space-x-2.5 sm:space-x-3.5 min-w-max pb-1">
          {liveCasinoGames.map((game) => (
            <div
              key={`live-${game.id}`}
              onClick={() => {
                soundEngine.playClick(1000);
                onLaunchGame(game.id);
              }}
              className="group relative w-36 xs:w-40 sm:w-48 rounded-2xl overflow-hidden bg-[#02180e] border border-emerald-800/70 hover:border-amber-400/80 shadow-lg hover:shadow-[0_6px_20px_rgba(245,158,11,0.25)] transition-all cursor-pointer select-none active:scale-[0.98] flex flex-col justify-between"
              role="button"
              tabIndex={0}
              aria-label={`Play ${game.name}`}
            >
              {/* Image Area with 4:3 Aspect */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-emerald-950/40">
                <img
                  src={game.imageUrl}
                  alt={game.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-108"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#02180e] via-transparent to-transparent opacity-80" />

                {/* Badge */}
                <div className="absolute top-1.5 left-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs">
                    LIVE
                  </span>
                </div>

                {/* Play Button Overlay on Hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-slate-950 ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Title & Provider */}
              <div className="p-2 sm:p-2.5 bg-[#02180e] border-t border-emerald-900/60">
                <h4 className="font-bold text-xs sm:text-sm text-white group-hover:text-amber-300 transition-colors truncate">
                  {game.name}
                </h4>
                <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300/70 mt-0.5">
                  <span className="truncate">{game.provider}</span>
                  {game.rtp && <span className="text-amber-400 font-bold shrink-0">{game.rtp}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
