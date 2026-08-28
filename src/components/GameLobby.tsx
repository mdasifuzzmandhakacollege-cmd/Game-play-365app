/**
 * @file GameLobby.tsx
 * @description Master Authenticated Home & Game Lobby interface for PLAY369.
 * 
 * Structural Hierarchy:
 * 1. Lobby Header (Live Announcement Marquee & Progressive Mega Jackpot bar)
 * 2. Featured Games Showcase (Hero promotional carousel from GameService)
 * 3. Game Category Navigation (All, Hot, Slots, Crash, Live Casino, Table, Fishing, Sports)
 * 4. Provider Filter UI (PG Soft, Pragmatic Play, JILI, Spribe, Evolution, Fa Chai, Nolimit)
 * 5. Popular & Hot Games Spotlight Section
 * 6. Responsive Game Grid with Empty and Loading skeleton states
 * 7. Live Activity / Winner Ticker
 * 8. Search Games Modal with instant autocomplete via GameService
 * 
 * [ARCHITECTURAL CONTRACT]:
 * - Reads all games, categories, and provider data exclusively through `gameService` & `GameProviderAdapter`.
 * - Provider implementations remain completely decoupled from this UI layer.
 * - No wallet balance or transaction logic is modified here.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { gameService } from '../services/gameService';
import { GameItem } from '../services/providers/types';
import {
  MockCategory,
  MockProvider,
  MockFeaturedHeroSlide,
  MOCK_CATEGORIES,
  MOCK_PROVIDERS,
  MOCK_FEATURED_SLIDES
} from '../data/mockGamesData';
import { LobbyHeader } from './lobby/LobbyHeader';
import { FeaturedGamesSection } from './lobby/FeaturedGamesSection';
import { GameCategoryNav } from './lobby/GameCategoryNav';
import { ProviderFilter } from './lobby/ProviderFilter';
import { PopularHotSection } from './lobby/PopularHotSection';
import { GameGrid } from './lobby/GameGrid';
import { GameSearchModal } from './lobby/GameSearchModal';
import { LiveActivityTicker } from './LiveActivityTicker';
import { TreasureChestModal } from './TreasureChestModal';
import { DailyUnclaimedRewardsModal } from './DailyUnclaimedRewardsModal';
import { ShareWheelModal } from './ShareWheelModal';
import { InboxMailModal } from './InboxMailModal';
import { SupportModal } from './SupportModal';
import { soundEngine } from '../services/soundEngine';
import { Sparkles } from 'lucide-react';

export interface GameLobbyProps {
  currentUser?: UserEntity;
  currentWallet?: WalletEntity;
  currency?: 'BDT' | 'USD';
  onLaunchGame: (gameId: string) => void;
  onOpenCashier: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  currentUser,
  currentWallet,
  currency = 'BDT',
  onLaunchGame,
  onOpenCashier,
  onNavigateTab
}) => {
  // Navigation & Filter States
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Catalog State loaded via GameService & Provider Adapters
  const [games, setGames] = useState<GameItem[]>([]);
  const [allCatalogGames, setAllCatalogGames] = useState<GameItem[]>([]);
  const [categories, setCategories] = useState<MockCategory[]>(MOCK_CATEGORIES);
  const [providers, setProviders] = useState<MockProvider[]>(MOCK_PROVIDERS);
  const [featuredSlides, setFeaturedSlides] = useState<MockFeaturedHeroSlide[]>(MOCK_FEATURED_SLIDES);

  // Favorite Games State (Local player preference)
  const [favorites, setFavorites] = useState<string[]>(['spribe_aviator', 'vs20olympgate']);

  // Modals for gamification widgets
  const [isTreasureOpen, setIsTreasureOpen] = useState<boolean>(false);
  const [isRewardsOpen, setIsRewardsOpen] = useState<boolean>(false);
  const [isShareWheelOpen, setIsShareWheelOpen] = useState<boolean>(false);
  const [isInboxOpen, setIsInboxOpen] = useState<boolean>(false);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);

  // 1. Initial metadata loading from GameService
  useEffect(() => {
    let isMounted = true;

    async function loadLobbyMetadata() {
      try {
        const [cats, provs, slides, fullCatalog] = await Promise.all([
          gameService.getCategories(),
          gameService.getProviders(),
          gameService.getFeaturedSlides(),
          gameService.listGames()
        ]);

        if (isMounted) {
          setCategories(cats);
          setProviders(provs);
          setFeaturedSlides(slides);
          setAllCatalogGames(fullCatalog);
        }
      } catch (err) {
        console.error('Failed to load initial lobby metadata:', err);
      }
    }

    loadLobbyMetadata();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Initialize category from URL query parameters (e.g. ?category=slots)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    if (categoryParam) {
      setActiveCategory(categoryParam);
    }
  }, []);

  // 3. Fetch filtered games dynamically via gameService
  const fetchFilteredGames = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await gameService.listGames({
        category: activeCategory,
        providerId: selectedProvider
      });
      setGames(results);
    } catch (err) {
      console.error('Failed to list games via gameService:', err);
      setGames([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, selectedProvider]);

  useEffect(() => {
    fetchFilteredGames();
  }, [fetchFilteredGames]);

  // Handle favorite toggle
  const handleToggleFavorite = (gameId: string) => {
    setFavorites((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
  };

  // Reset all filters helper
  const handleResetFilters = () => {
    setActiveCategory('all');
    setSelectedProvider('all');
  };

  // Safe game launcher bridging to GameService adapter launch
  const handleLaunchGame = async (gameId: string) => {
    soundEngine.playClick(1050);
    try {
      if (currentUser) {
        // Authorize launch session through Provider Adapter
        await gameService.launchGame({
          userId: currentUser.id,
          username: currentUser.username,
          gameId,
          currency
        });
      }
    } catch (err) {
      console.warn('Game launch session pre-flight note:', err);
    }
    // Delegate to primary app router
    onLaunchGame(gameId);
  };

  return (
    <div
      id="play369-authenticated-game-lobby"
      className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2.5 sm:py-4 space-y-4 sm:space-y-6 text-slate-100 font-sans pb-24 lg:pb-12"
    >
      {/* 1. Lobby Header (Speaker Marquee + Progressive Jackpot + Quick Actions) */}
      <LobbyHeader
        onOpenSearch={() => setIsSearchOpen(true)}
        onLaunchGame={handleLaunchGame}
        onOpenCashier={onOpenCashier}
        onOpenVip={() => onNavigateTab && onNavigateTab('vip')}
      />

      {/* 2. Featured Game Hero Showcase (Golden Ratio Carousel via GameService) */}
      <FeaturedGamesSection
        onLaunchGame={handleLaunchGame}
        onOpenCashier={onOpenCashier}
        slides={featuredSlides}
      />

      {/* 3. Game Category Navigation Bar (Minimum 48px touch targets) */}
      <div className="space-y-2.5">
        <GameCategoryNav
          activeCategory={activeCategory}
          onSelectCategory={(catId) => {
            setActiveCategory(catId);
          }}
          categories={categories}
        />

        {/* 4. Provider Filter UI */}
        <ProviderFilter
          selectedProvider={selectedProvider}
          onSelectProvider={(provId) => {
            setSelectedProvider(provId);
          }}
          providers={providers}
        />
      </div>

      {/* 5. Popular / Hot Games Spotlight (Displayed when on "All" or "Hot" category) */}
      {(activeCategory === 'all' || activeCategory === 'hot') && selectedProvider === 'all' && (
        <PopularHotSection
          games={allCatalogGames}
          onLaunchGame={handleLaunchGame}
          onViewAllHot={() => setActiveCategory('hot')}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* 6. Responsive Game Grid (with Empty and Loading states from GameService) */}
      <GameGrid
        games={games}
        isLoading={isLoading}
        onLaunchGame={handleLaunchGame}
        onResetFilters={handleResetFilters}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        title={
          activeCategory === 'all'
            ? 'All Games'
            : categories.find((c) => c.id === activeCategory)?.label || 'Games'
        }
        totalCount={allCatalogGames.length}
      />

      {/* 7. Live Activity / Winners Ticker */}
      <div className="pt-2">
        <LiveActivityTicker onLaunchGame={handleLaunchGame} />
      </div>

      {/* 8. Floating Gamified Badges (VIP Rewards, Lucky Wheel, Treasure Chest) */}
      <div className="fixed bottom-20 right-3.5 sm:right-6 z-40 flex flex-col items-end space-y-2">
        {/* VIP Rewards ৳999 */}
        <button
          id="play369-float-vip-reward"
          onClick={() => {
            soundEngine.playClick(1000);
            setIsRewardsOpen(true);
          }}
          className="group flex items-center bg-[#02180e]/95 border border-emerald-500/70 hover:border-amber-400 p-1.5 pr-3 rounded-full shadow-[0_4px_18px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer min-h-[48px]"
          title="Daily VIP Bonus ৳999"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
            🎁
          </div>
          <div className="ml-2 text-left hidden sm:block">
            <div className="text-[10px] text-emerald-300 font-bold leading-none font-sans">VIP Bonus</div>
            <div className="text-[11px] font-black text-amber-400 font-mono leading-tight">৳ 999 Free</div>
          </div>
        </button>

        {/* Lucky Spin Wheel */}
        <button
          id="play369-float-wheel"
          onClick={() => {
            soundEngine.playClick(1000);
            setIsShareWheelOpen(true);
          }}
          className="group flex items-center bg-[#02180e]/95 border border-amber-400/70 hover:border-amber-300 p-1.5 pr-3 rounded-full shadow-[0_4px_18px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer min-h-[48px]"
          title="Lucky Spin Wheel"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
            🎡
          </div>
          <div className="ml-2 text-left hidden sm:block">
            <div className="text-[10px] text-amber-300 font-bold leading-none font-sans">Lucky Wheel</div>
            <div className="text-[11px] font-black text-amber-400 font-mono leading-tight">Spin & Win</div>
          </div>
        </button>

        {/* Treasure Chest */}
        <button
          id="play369-float-treasure"
          onClick={() => {
            soundEngine.playClick(1000);
            setIsTreasureOpen(true);
          }}
          className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer font-black border border-amber-200"
          title="Open Treasure Chest"
          aria-label="Treasure Chest"
        >
          <Sparkles className="w-6 h-6 fill-slate-950 animate-pulse" />
        </button>
      </div>

      {/* Search Modal (powered by GameService catalog) */}
      <GameSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        games={allCatalogGames}
        onLaunchGame={handleLaunchGame}
      />

      {/* Gamified Modals */}
      <TreasureChestModal
        isOpen={isTreasureOpen}
        onClose={() => setIsTreasureOpen(false)}
        currency={currency}
      />

      <DailyUnclaimedRewardsModal
        isOpen={isRewardsOpen}
        onClose={() => setIsRewardsOpen(false)}
        currency={currency}
      />

      <ShareWheelModal
        isOpen={isShareWheelOpen}
        onClose={() => setIsShareWheelOpen(false)}
      />

      <InboxMailModal
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
        onNavigateTab={onNavigateTab || (() => {})}
      />

      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />
    </div>
  );
};
