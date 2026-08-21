/**
 * @file GameLobby.tsx
 * @description Master Redesigned Asian-Market iGaming Dashboard & Casino Hub for GamePlay365.
 * Strictly adheres to the "Emerald & Gold" Design System:
 * - Rich, consistent Emerald Green backgrounds (bg-emerald-900 / bg-emerald-950 / #02180e)
 * - Exclusive Gold/Yellow accents for VIP highlights, badges, and primary action buttons
 * - Horizontal scrollable category tabs (Best, Slots, Mini Games, Sports, Live Casino, Fishing)
 * - Clean 2-column (mobile) and 3/4-column (desktop) strictly aligned game grid without text clutter
 * - Gamified Treasure Chest & Daily Unclaimed Rewards Quick Launchers
 * - Live Demo Arena & Real-Time Live Activity Ticker
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  Crown,
  Sparkles,
  Zap,
  Play,
  Search,
  Gamepad2,
  Trophy,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Copy,
  Check,
  RotateCw,
  Gift,
  Share2,
  Users,
  Headphones,
  Star,
  ShieldCheck,
  Send,
  X,
  CreditCard,
  TrendingUp,
  Wallet,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Clock
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { soundEngine } from '../services/soundEngine';
import { useWalletGame } from '../contexts/WalletGameContext';
import { assetLoader, GameAsset } from '../services/assetLoader';
import { InboxMailModal } from './InboxMailModal';
import { SupportModal } from './SupportModal';
import { ShareWheelModal } from './ShareWheelModal';
import { LiveActivityTicker } from './LiveActivityTicker';
import { DemoIframe, OFFICIAL_DEMO_GAMES } from './games/DemoIframe';
import { TreasureChestModal } from './TreasureChestModal';
import { DailyUnclaimedRewardsModal } from './DailyUnclaimedRewardsModal';
import { motion, AnimatePresence } from 'framer-motion';

export interface GameItem {
  id: string;
  name: string;
  nameBn?: string;
  provider: string;
  providerId: string;
  category: 'hot' | 'slots' | 'minigames' | 'sports' | 'casino' | 'fishing';
  rtp: string;
  volatility: 'Low' | 'Medium' | 'High' | 'Extreme';
  maxMultiplier: string;
  minBet: number;
  maxBet: number;
  imageUrl: string;
  animatedPreviewUrl?: string;
  bannerUrl?: string;
  icon?: string;
  isHot?: boolean;
  isFavorite?: boolean;
  badge?: string;
  colorTag?: string;
}

const CASINO_GAMES: GameItem[] = assetLoader.getAllAssets().map((asset) => ({
  id: asset.gameId,
  name: asset.name,
  nameBn: asset.nameBn,
  provider: asset.provider,
  providerId: asset.providerId,
  category: asset.category,
  rtp: asset.rtp,
  volatility: asset.volatility,
  maxMultiplier: asset.maxMultiplier,
  minBet: asset.minBet,
  maxBet: asset.maxBet,
  imageUrl: asset.thumbnailUrl,
  animatedPreviewUrl: asset.animatedPreviewUrl,
  bannerUrl: asset.bannerUrl,
  icon: asset.icon,
  isHot: asset.badge?.includes('HOT') || false,
  badge: asset.badge,
  colorTag: asset.themeColor.gradient
}));

// Real Certified Game Providers
const PROVIDER_CHIPS = [
  { id: 'all', name: 'সকল (All)', icon: '🎲' },
  { id: 'pgsoft', name: 'PG Soft', icon: '💎' },
  { id: 'jili', name: 'JILI Games', icon: '⚡' },
  { id: 'spribe', name: 'Spribe Aviator', icon: '🚀' },
  { id: 'pragmatic', name: 'Pragmatic Play', icon: '👑' },
  { id: 'evolution', name: 'Evolution Live', icon: '♠️' },
  { id: 'fast', name: 'Fast Crash', icon: '🔥' }
];

const CATEGORY_TABS = [
  { id: 'hot', label: 'সেরা (Best)', icon: '🔥' },
  { id: 'slots', label: 'স্লটস (Slots)', icon: '🎰' },
  { id: 'minigames', label: 'মিনি গেমস (Mini Games)', icon: '🚀' },
  { id: 'sports', label: 'স্পোর্টস (Sports)', icon: '⚽' },
  { id: 'casino', label: 'লাইভ ক্যাসিনো', icon: '♠️' },
  { id: 'fishing', label: 'ফিশিং (Fishing)', icon: '🎣' },
  { id: 'demo', label: '👑 অফিসিয়াল রিয়েল ডেমো', icon: '👑' }
];

interface GameLobbyProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onLaunchGame: (gameId: string) => void;
  onOpenCashier: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
  currentUser,
  currentWallet,
  currency,
  onLaunchGame,
  onOpenCashier,
  onNavigateTab
}) => {
  const { topUpWallet, showToast, refreshState, formattedBalance } = useWalletGame();

  const [activeCategory, setActiveCategory] = useState<string>('hot');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [syncingBalance, setSyncingBalance] = useState<boolean>(false);

  // Live Dashboard Real Demo Arena State
  const [dashboardDemoGameId, setDashboardDemoGameId] = useState<string>('vs20olympgate');
  const [isDemoArenaExpanded, setIsDemoArenaExpanded] = useState<boolean>(true);

  // Gamified Modals
  const [isTreasureOpen, setIsTreasureOpen] = useState<boolean>(false);
  const [isRewardsOpen, setIsRewardsOpen] = useState<boolean>(false);
  const [isInboxOpen, setIsInboxOpen] = useState<boolean>(false);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [isShareWheelOpen, setIsShareWheelOpen] = useState<boolean>(false);

  // Live Progressive Jackpot Counter
  const [liveJackpot, setLiveJackpot] = useState(18942550);

  useEffect(() => {
    assetLoader.preloadAssets();
    const interval = setInterval(() => {
      setLiveJackpot((prev) => prev + Math.floor(Math.random() * 34) + 13);
    }, 1618);
    return () => clearInterval(interval);
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentUser.username);
    setCopiedId(true);
    soundEngine.playClick(1000);
    showToast(`ইউজারনেম '${currentUser.username}' কপি করা হয়েছে!`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSyncBalance = async () => {
    soundEngine.playClick(850);
    setSyncingBalance(true);
    try {
      await refreshState();
      setTimeout(() => {
        setSyncingBalance(false);
        showToast('ব্যালেন্স ও লেজার স্টেট রিয়েল-টাইমে সিঙ্ক সম্পন্ন হয়েছে।');
      }, 500);
    } catch {
      setSyncingBalance(false);
    }
  };

  const filteredGames = useMemo(() => {
    return CASINO_GAMES.filter((game) => {
      // Category Filter
      const matchCategory =
        activeCategory === 'hot'
          ? true
          : activeCategory === 'demo'
          ? OFFICIAL_DEMO_GAMES.some((d) => d.id === game.id)
          : game.category === activeCategory;

      // Provider Filter
      const matchProvider =
        selectedProvider === 'all' || game.providerId === selectedProvider;

      // Search Query
      const matchSearch =
        !searchQuery ||
        game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.provider.toLowerCase().includes(searchQuery.toLowerCase());

      return matchCategory && matchProvider && matchSearch;
    });
  }, [activeCategory, selectedProvider, searchQuery]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 text-slate-100 font-sans"
    >
      {/* 1. EMERALD & GOLD QUICK REWARDS & TREASURE LAUNCHER BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
        
        {/* Left Card: Clean User Status, Balance & Quick Modals */}
        <div className="md:col-span-8 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-950 to-emerald-900 border-2 border-amber-400/50 p-5 sm:p-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-80 h-32 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center space-x-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/25 shrink-0">
                <div className="w-full h-full bg-emerald-950 rounded-[14px] flex items-center justify-center font-black text-amber-300 text-lg font-mono">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base sm:text-lg font-black text-white">
                    {currentUser.username}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-400/40">
                    VIP 1
                  </span>
                </div>
                <div className="text-xs text-emerald-200/80 font-mono mt-0.5">
                  ব্যালেন্স: <strong className="text-amber-300 text-sm">{formattedBalance}</strong>
                </div>
              </div>
            </div>

            {/* Quick Action Badges */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  soundEngine.playClick(1000);
                  setIsRewardsOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-300 font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Gift className="w-4 h-4 text-amber-400" />
                <span>রিওয়ার্ডস ভল্ট (5)</span>
              </button>

              <button
                onClick={() => {
                  soundEngine.playClick(1000);
                  setIsTreasureOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span>ট্রেজার চেস্ট (2x2)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Card: Progressive Jackpot Counter */}
        <div className="md:col-span-4 rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-[#02180e] border-2 border-emerald-600/50 p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-300 uppercase flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>প্রোগ্রেসিভ মেগা জ্যাকপট</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-black font-mono text-transparent bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text">
              {currency === 'BDT' ? '৳ ' : '$ '}
              {liveJackpot.toLocaleString()}
            </div>
            <p className="text-[10px] text-emerald-300/80 font-mono mt-0.5">
              যেকোনো স্লট বা ক্র্যাশ গেমে স্পিন করে জ্যাকপট জিতুন
            </p>
          </div>

          <button
            onClick={() => {
              soundEngine.playClick(1000);
              onLaunchGame('spribe_aviator');
            }}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center space-x-1.5 cursor-pointer font-mono"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>সরাসরি Aviator (1000x) খেলুন</span>
          </button>
        </div>

      </div>

      {/* 2. REAL-TIME LIVE WINNERS TICKER */}
      <LiveActivityTicker onLaunchGame={onLaunchGame} />

      {/* 2.5 EMBEDDED REAL DEMO ARENA */}
      <section className="relative rounded-2xl overflow-hidden border-2 border-emerald-600/40 bg-gradient-to-b from-emerald-950 via-[#02180e] to-emerald-950 shadow-xl transition-all">
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 px-4 py-3 border-b border-emerald-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-500 p-0.5 shadow-md shadow-amber-500/20 shrink-0">
              <div className="w-full h-full bg-emerald-950 rounded-[10px] flex items-center justify-center text-lg">
                👑
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                  অফিসিয়াল রিয়েল ডেমো অ্যারেনা
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-mono font-black">
                  LIVE DEMO
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80">
                ড্যাশবোর্ডেই সরাসরি খেলুন আসল লাইভ প্রোভাইডার ডেমো • আনলিমিটেড ফ্রি ব্যালেন্স
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                soundEngine.playClick(1000);
                onLaunchGame(dashboardDemoGameId);
              }}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 text-xs font-mono font-black shadow-md active:scale-95 transition-all flex items-center space-x-1 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>ফুল গেম মোড</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick(800);
                setIsDemoArenaExpanded(!isDemoArenaExpanded);
              }}
              className="p-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 border border-emerald-700 text-emerald-300 transition-all cursor-pointer"
            >
              {isDemoArenaExpanded ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
            </button>
          </div>
        </div>

        {/* Real Demo Switcher */}
        <div className="bg-emerald-950/90 px-4 py-2 border-b border-emerald-800/80 flex items-center space-x-2 overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-mono font-bold text-amber-400 shrink-0 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>স্লট ডেমো:</span>
          </span>

          {OFFICIAL_DEMO_GAMES.map((demo) => {
            const isSelected = dashboardDemoGameId === demo.id;
            return (
              <button
                key={demo.id}
                onClick={() => {
                  soundEngine.playClick(950);
                  setDashboardDemoGameId(demo.id);
                  if (!isDemoArenaExpanded) setIsDemoArenaExpanded(true);
                  showToast(`ড্যাশবোর্ডে লোড হচ্ছে: ${demo.name}`);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-md font-black'
                    : 'bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 border border-emerald-700/60'
                }`}
              >
                <span>{demo.icon}</span>
                <span>{demo.name}</span>
              </button>
            );
          })}
        </div>

        {isDemoArenaExpanded && (
          <div className="p-3 bg-[#01120a]">
            <DemoIframe
              gameId={dashboardDemoGameId}
              onSelectGame={(gId) => setDashboardDemoGameId(gId)}
            />
          </div>
        )}
      </section>

      {/* 3. HORIZONTAL SCROLLABLE CATEGORY TABS (Strict Asian Market Spec) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center space-x-2 shrink-0">
            {CATEGORY_TABS.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    soundEngine.playClick(800);
                    setActiveCategory(cat.id);
                  }}
                  className={`min-h-[42px] px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                      : 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 hover:text-white hover:border-amber-400/50'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Button */}
          <button
            onClick={() => {
              soundEngine.playClick(900);
              setShowSearchModal(true);
            }}
            className="min-h-[42px] px-4 rounded-xl bg-emerald-950/80 border border-emerald-700/60 hover:border-amber-400 text-amber-300 text-xs font-mono font-bold flex items-center space-x-2 transition-all shrink-0 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>সার্চ</span>
          </button>
        </div>

        {/* Provider Filter Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
          <span className="text-emerald-300/80 text-[11px] shrink-0 font-sans">প্রোভাইডার:</span>
          {PROVIDER_CHIPS.map((p) => {
            const isSelected = selectedProvider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  soundEngine.playClick(750);
                  setSelectedProvider(p.id);
                }}
                className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                    : 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-200 hover:text-white'
                }`}
              >
                <span>{p.icon} </span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. CLEAN STRICTLY ALIGNED GAME GRID (2-col Mobile / 3-4 col Desktop without text clutter) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 text-xs font-mono text-emerald-300/80">
          <span>মোট গেম: <strong className="text-amber-300">{filteredGames.length}টি</strong></span>
          <span>RTP 96.5% - 98.9% • Provably Fair</span>
        </div>

        <motion.div
          layout
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4"
        >
          <AnimatePresence>
            {filteredGames.map((game, idx) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: idx * 0.015 }}
                key={game.id}
                onClick={() => {
                  soundEngine.playClick(1000);
                  onLaunchGame(game.id);
                }}
                className="group relative bg-emerald-950/80 border-2 border-emerald-700/50 hover:border-amber-400 rounded-xl overflow-hidden shadow-md hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all duration-200 active:scale-[0.98] cursor-pointer flex flex-col justify-between"
              >
                {/* Thumbnail Container */}
                <div className="relative aspect-[1.3] w-full overflow-hidden bg-emerald-950">
                  <img
                    src={game.imageUrl}
                    alt={game.name}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-transparent to-transparent" />

                  {/* Top Badge */}
                  {game.badge && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-mono text-[9px] font-black shadow-md uppercase">
                      {game.badge}
                    </div>
                  )}

                  {/* Play Overlay Button on Hover */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-[1px] p-2 text-center">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
                    </div>
                    <span className="text-[10px] font-mono font-black text-amber-300">
                      প্লে করুন
                    </span>
                  </div>
                </div>

                {/* Clean Uncluttered Game Header */}
                <div className="p-2.5 space-y-1">
                  <div className="font-bold text-xs sm:text-sm text-white group-hover:text-amber-300 transition-colors truncate">
                    {game.name}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300/80">
                    <span className="truncate">{game.provider}</span>
                    <span className="text-amber-300 font-bold">{game.maxMultiplier}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Floating Quick Action Button */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col space-y-2.5">
        <button
          onClick={() => {
            soundEngine.playClick(1000);
            setIsTreasureOpen(true);
          }}
          className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 hover:scale-110 active:scale-95 transition-all cursor-pointer font-black"
          title="ট্রেজার চেস্ট ওপেন করুন"
        >
          <Sparkles className="w-5 h-5 fill-slate-950" />
        </button>
      </div>

      {/* Modals */}
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

      <InboxMailModal
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
        onNavigateTab={onNavigateTab || (() => {})}
      />

      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
      />

      <ShareWheelModal
        isOpen={isShareWheelOpen}
        onClose={() => setIsShareWheelOpen(false)}
      />

      {/* Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/80 backdrop-blur-md">
          <div className="bg-emerald-950 border-2 border-amber-400/50 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center space-x-2 font-mono">
                <Search className="w-4 h-4 text-amber-400" />
                <span>গেম অনুসন্ধান (Live Game Search)</span>
              </h3>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded-lg bg-emerald-900 text-emerald-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-emerald-400" />
              <input
                type="text"
                autoFocus
                placeholder="গেম বা প্রোভাইডারের নাম লিখুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-emerald-900/60 border border-emerald-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-emerald-400/60 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 divide-y divide-emerald-800/60 font-mono">
              {filteredGames.slice(0, 8).map((g) => (
                <div
                  key={g.id}
                  onClick={() => {
                    setShowSearchModal(false);
                    onLaunchGame(g.id);
                  }}
                  className="pt-2 flex items-center justify-between p-2 rounded-xl hover:bg-emerald-900/60 cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <img src={g.imageUrl} alt={g.name} className="w-10 h-10 rounded-xl object-cover" />
                    <div>
                      <div className="text-xs font-bold text-white">{g.name}</div>
                      <div className="text-[10px] text-emerald-300/80">{g.provider} • {g.maxMultiplier}</div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black">
                    প্লে করুন 🚀
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
