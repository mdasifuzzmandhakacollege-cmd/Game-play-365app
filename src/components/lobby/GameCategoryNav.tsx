/**
 * @file GameCategoryNav.tsx
 * @description Luxury Emerald & Gold Game Category navigation bar for PLAY369.
 * Follows Golden Ratio proportions and strictly provides >= 48px touch targets.
 */

import React from 'react';
import { MOCK_CATEGORIES, MockCategory } from '../../data/mockGamesData';
import { soundEngine } from '../../services/soundEngine';

export interface GameCategoryNavProps {
  activeCategory: string;
  onSelectCategory: (categoryId: string) => void;
  categories?: MockCategory[];
}

export const GameCategoryNav: React.FC<GameCategoryNavProps> = ({
  activeCategory,
  onSelectCategory,
  categories = MOCK_CATEGORIES
}) => {
  const handleCategoryClick = (catId: string) => {
    soundEngine.playClick(900);
    onSelectCategory(catId);
  };

  return (
    <nav
      id="play369-category-nav"
      className="w-full overflow-x-auto scrollbar-none py-1"
      aria-label="Game Categories"
    >
      <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-max px-0.5">
        {categories.map((cat) => {
          const isSelected = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              id={`play369-cat-btn-${cat.id}`}
              onClick={() => handleCategoryClick(cat.id)}
              className={`min-h-[48px] px-3.5 sm:px-4 py-2 rounded-2xl font-bold text-xs sm:text-sm flex items-center space-x-2 transition-all duration-200 cursor-pointer active:scale-95 select-none ${
                isSelected
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-[0_4px_16px_rgba(245,158,11,0.35)] border border-amber-300 font-black'
                  : 'bg-[#031c11]/80 hover:bg-[#062c1b] border border-emerald-800/60 hover:border-emerald-600 text-emerald-100/80 hover:text-white'
              }`}
              aria-pressed={isSelected}
              aria-label={`${cat.label} category, ${cat.count} games`}
            >
              <span className="text-base sm:text-lg leading-none" role="img" aria-hidden="true">
                {cat.icon}
              </span>
              <span className="font-sans whitespace-nowrap">{cat.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full leading-tight ${
                  isSelected
                    ? 'bg-slate-950/20 text-slate-950 font-black'
                    : 'bg-emerald-950/60 text-emerald-400/90 border border-emerald-800/40'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
