/**
 * @file GameLobby.tsx
 * @description Master Authentic Asian-Market iGaming Dashboard & Casino Hub for GamePlay365 (44f111.com Architecture).
 * - Full Hero Promo Banner Carousel with auto-slide & interactive triggers
 * - Speaker Marquee Announcement Bar (Live wins & Deposit bonus ticker)
 * - Compact Progressive Mega Jackpot Bar with 1-tap Aviator launcher
 * - 8-Tab Category Navigation (All 0, Hot 1, Slots 2, Crash 3, Live Casino 4, Sports 5, Fishing 6, Demo 7)
 * - Provider Filter Pills (PG Soft, JILI, Pragmatic, Spribe, Evolution, Fa Chai)
 * - High-Density 3-Column Mobile & 6-Column Desktop Game Grid with instant launch
 * - Official Real Demo Arena on demand
 * - Gamified Floating Widgets (VIP ৳999, Lucky Spin, Treasure Chest)
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
  ChevronLeft,
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
  Volume2,
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
  { id: 'fast', name: 'Fa Chai / Fast', icon: '🔥' }
];

const CATEGORY_TABS = [
  { id: 'all', label: 'সব খেলা (All)', icon: '🎲', catId: '0' },
  { id: 'hot', label: 'সেরা খেলা (Hot)', icon: '🔥', catId: '1' },
  { id: 'slots', label: 'স্লটস (Slots)', icon: '🎰', catId: '2' },
  { id: 'minigames', label: 'ক্র্যাশ ও মিনি গেমস', icon: '🚀', catId: '3' },
  { id: 'casino', label: 'লাইভ ক্যাসিনো', icon: '♠️', catId: '4' },
  { id: 'sports', label: 'স্পোর্টস (Sports)', icon: '⚽', catId: '5' },
  { id: 'fishing', label: 'ফিশিং (Fishing)', icon: '🎣', catId: '6' },
  { id: 'demo', label: '👑 অফিসিয়াল ডেমো', icon: '👑', catId: '7' }
];

// F111 High-Impact Hero Promo Slides
const HERO_SLIDES = [
  {
    id: 'f111-daily-vip',
    tag: 'DAILY VIP BONUS',
    title: 'দৈনিক লগইন ভিআইপি বোনাস ৳৯৯৯',
    subtitle: 'প্রতিদিন লগইন করলেই নিশ্চিত ইনস্ট্যান্ট ক্যাশ রিওয়ার্ড লুফে নিন',
    btnText: 'ক্লেম করুন 🎁',
    target: 'rewards',
    bgGradient: 'from-emerald-900 via-[#0c2415] to-emerald-950',
    borderColor: 'border-[#54D62C]/60',
    iconEmoji: '🎁',
    badgeColor: 'bg-[#54D62C] text-slate-950 font-black'
  },
  {
    id: 'f111-aviator-crash',
    tag: 'CRASH ARENA 1000X',
    title: 'স্প্রাইব এভিয়েটর - ১০০০x ক্যাশ মাল্টিপ্লায়ার',
    subtitle: 'বিমান ওড়ার আগেই ক্যাশ-আউট করে বিশাল জ্যাকপট জিতুন',
    btnText: 'এখনই খেলুন 🚀',
    target: 'game:spribe_aviator',
    bgGradient: 'from-rose-950 via-[#260c11] to-slate-950',
    borderColor: 'border-rose-500/60',
    iconEmoji: '✈️',
    badgeColor: 'bg-rose-500 text-white font-black'
  },
  {
    id: 'f111-welcome-300',
    tag: 'MEGA WELCOME',
    title: '৩০০% মেগা ফার্স্ট ডিপোজিট বোনাস',
    subtitle: 'বিকাশ ও নগদে প্রথম ডিপোজিটে সরাসরি ৩ গুণ ব্যালেন্স বোনাস',
    btnText: 'জমা করুন 💳',
    target: 'cashier',
    bgGradient: 'from-amber-950 via-[#291e0a] to-emerald-950',
    borderColor: 'border-amber-400/60',
    iconEmoji: '👑',
    badgeColor: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black'
  },
  {
    id: 'f111-super-ace-jili',
    tag: 'JILI & PG SOFT',
    title: 'Super Ace & Mahjong Ways 2 মেগা জ্যাকপট',
    subtitle: 'লাইভ আরটিপি ৯৮.৯% সহ ইনস্ট্যান্ট ফ্রি স্পিন ও মাল্টিপ্লায়ার',
    btnText: 'স্পিন করুন 🎰',
    target: 'game:jili_super_ace',
    bgGradient: 'from-purple-950 via-[#1e0a29] to-emerald-950',
    borderColor: 'border-purple-500/60',
    iconEmoji: '💎',
    badgeColor: 'bg-purple-500 text-white font-black'
  },
  {
    id: 'f111-share-999',
    tag: 'SHARE & EARN',
    title: 'বন্ধুদের সাথে শেয়ার করুন বোনাস ৳৯৯৯',
    subtitle: 'রেফারেল লিংক শেয়ার করে ইনস্ট্যান্ট ক্যাশ + আজীবন ১০% কমিশন',
    btnText: 'শেয়ার করুন 👥',
    target: 'wheel',
    bgGradient: 'from-blue-950 via-[#0a1b29] to-emerald-950',
    borderColor: 'border-blue-500/60',
    iconEmoji: '🎡',
    badgeColor: 'bg-blue-400 text-slate-950 font-black'
  }
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

  // Initialize category from URL query parameters (e.g. ?gameCategoryId=0)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const catIdParam = urlParams.get('gameCategoryId');
    if (catIdParam !== null) {
      const foundTab = CATEGORY_TABS.find((t) => t.catId === catIdParam);
      if (foundTab) {
        setActiveCategory(foundTab.id);
      }
    }
  }, []);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);

  // Live Dashboard Real Demo Arena State
  const [dashboardDemoGameId, setDashboardDemoGameId] = useState<string>('vs20olympgate');
  const [isDemoArenaExpanded, setIsDemoArenaExpanded] = useState<boolean>(false);

  // Gamified Modals
  const [isTreasureOpen, setIsTreasureOpen] = useState<boolean>(false);
  const [isRewardsOpen, setIsRewardsOpen] = useState<boolean>(false);
  const [isInboxOpen, setIsInboxOpen] = useState<boolean>(false);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [isShareWheelOpen, setIsShareWheelOpen] = useState<boolean>(false);

  // Live Progressive Jackpot Counter
  const [liveJackpot, setLiveJackpot] = useState(18945820);

  useEffect(() => {
    assetLoader.preloadAssets();
    const interval = setInterval(() => {
      setLiveJackpot((prev) => prev + Math.floor(Math.random() * 34) + 13);
    }, 1618);
    return () => clearInterval(interval);
  }, []);

  // Auto-cycle Hero Banner Slides every 3.8s
  useEffect(() => {
    const slideTimer = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 3800);
    return () => clearInterval(slideTimer);
  }, []);

  const handleHeroSlideAction = (target: string) => {
    soundEngine.playClick(1000);
    if (target === 'rewards') {
      setIsRewardsOpen(true);
    } else if (target === 'cashier') {
      onOpenCashier();
    } else if (target === 'wheel') {
      setIsShareWheelOpen(true);
    } else if (target.startsWith('game:')) {
      const gameId = target.replace('game:', '');
      onLaunchGame(gameId);
    }
  };

  const filteredGames = useMemo(() => {
    return CASINO_GAMES.filter((game) => {
      // Category Filter
      const matchCategory =
        activeCategory === 'all'
          ? true
          : activeCategory === 'hot'
          ? game.isHot || game.badge?.includes('HOT')
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
      className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2.5 sm:py-4 space-y-3.5 sm:space-y-4 text-slate-100 font-sans pb-24 lg:pb-12"
    >
      {/* ========================================================================= */}
      {/* 1. HERO PROMOTIONAL BANNER CAROUSEL (44f111 Master Slider) */}
      {/* ========================================================================= */}
      <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80 bg-[#080d14]">
        <div className="relative min-h-[140px] sm:min-h-[180px] md:min-h-[210px] w-full flex items-center">
          <AnimatePresence mode="wait">
            {HERO_SLIDES.map((slide, idx) => {
              if (idx !== activeSlideIndex) return null;
              return (
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, x: 25 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -25 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className={`absolute inset-0 bg-gradient-to-r ${slide.bgGradient} border-2 ${slide.borderColor} p-4 sm:p-6 flex items-center justify-between overflow-hidden`}
                >
                  {/* Ambient Glow */}
                  <div className="absolute top-0 right-1/4 w-72 h-36 bg-[#54D62C]/15 rounded-full blur-3xl pointer-events-none" />

                  {/* Left Content */}
                  <div className="relative z-10 max-w-[70%] sm:max-w-md space-y-1.5 sm:space-y-2">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-mono uppercase tracking-wider shadow-sm ${slide.badgeColor}`}>
                      {slide.tag}
                    </span>
                    <h2 className="text-sm sm:text-xl md:text-2xl font-black text-white leading-tight drop-shadow-md">
                      {slide.title}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-200/90 line-clamp-2 hidden xs:block">
                      {slide.subtitle}
                    </p>

                    <div className="pt-1">
                      <button
                        onClick={() => handleHeroSlideAction(slide.target)}
                        className="px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-[#54D62C] hover:bg-[#47be23] text-slate-950 font-black text-xs sm:text-sm font-mono shadow-[0_4px_15px_rgba(84,214,44,0.4)] active:scale-95 transition-all cursor-pointer flex items-center space-x-1.5"
                      >
                        <span>{slide.btnText}</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Hero Visual Emoji / Graphic */}
                  <div className="relative z-10 pr-2 sm:pr-6 shrink-0">
                    <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-3xl bg-slate-900/60 border border-slate-700/60 flex items-center justify-center text-4xl sm:text-6xl md:text-7xl shadow-2xl backdrop-blur-sm animate-pulse">
                      {slide.iconEmoji}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Carousel Navigation Dots & Controls */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-1.5 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                soundEngine.playClick(800);
                setActiveSlideIndex(i);
              }}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activeSlideIndex === i ? 'w-5 bg-[#54D62C]' : 'w-1.5 bg-slate-600 hover:bg-slate-400'
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Arrow triggers */}
        <button
          onClick={() => {
            soundEngine.playClick(700);
            setActiveSlideIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors hidden sm:flex cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            soundEngine.playClick(700);
            setActiveSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/80 transition-colors hidden sm:flex cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. LIVE NOTICE / BROADCAST SPEAKER MARQUEE */}
      {/* ========================================================================= */}
      <div className="flex items-center space-x-2.5 bg-[#0e141f] border border-slate-800 rounded-xl px-3 py-2 text-xs overflow-hidden shadow-inner">
        <div className="flex items-center space-x-1.5 text-amber-400 font-bold shrink-0">
          <Volume2 className="w-4 h-4 animate-bounce text-amber-400" />
          <span className="hidden sm:inline font-mono">ঘোষণা:</span>
        </div>
        <div className="overflow-hidden whitespace-nowrap w-full">
          <div className="inline-block animate-[marquee_24s_linear_infinite] text-slate-300 font-mono text-[11px] sm:text-xs">
            🎉 <strong className="text-[#54D62C]">ইউজার 017***5643</strong> মাত্র Spribe Aviator গেমে <strong className="text-amber-300">৳৪৮,৫০০</strong> ক্যাশআউট করেছেন! • 🇧🇩 বিকাশ ও নগদে ডিপোজিটে <strong className="text-[#54D62C]">+৫% অতিরিক্ত ক্যাশ</strong> স্বয়ংক্রিয় জমা হচ্ছে • 🎁 দৈনিক লগইন বোনাস ৳৯৯৯ এখন লাইভ! • 🚀 ২৪/৭ ইনস্ট্যান্ট অটো-উইথড্র সুবিধা চালু আছে।
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. COMPACT PROGRESSIVE JACKPOT & QUICK VIP STRIP */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 sm:gap-3 items-center">
        {/* Left: Jackpot Counter */}
        <div className="md:col-span-7 bg-gradient-to-r from-emerald-950/80 via-[#0a1810] to-[#0d141e] border border-[#54D62C]/40 rounded-xl p-2.5 sm:p-3 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-mono uppercase tracking-wider flex items-center space-x-1">
                <span>মেগা প্রোগ্রেসিভ জ্যাকপট</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#54D62C] animate-ping" />
              </div>
              <div className="text-base sm:text-xl font-black font-mono text-[#54D62C]">
                ৳ {liveJackpot.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              soundEngine.playClick(1000);
              onLaunchGame('spribe_aviator');
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs font-mono shadow-md active:scale-95 transition-all flex items-center space-x-1 cursor-pointer shrink-0"
          >
            <Play className="w-3 h-3 fill-slate-950" />
            <span>Aviator খেলুন</span>
          </button>
        </div>

        {/* Right: Quick Action Launchers */}
        <div className="md:col-span-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              soundEngine.playClick(1000);
              setIsRewardsOpen(true);
            }}
            className="py-2.5 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-600/50 text-[#54D62C] font-black text-xs font-mono flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Gift className="w-4 h-4 text-[#54D62C]" />
            <span>ভিআইপি রিওয়ার্ডস ৳৯৯৯</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick(1000);
              setIsShareWheelOpen(true);
            }}
            className="py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-300 font-black text-xs font-mono flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>লাকি স্পিন হুইল</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. HORIZONTAL CATEGORY NAVIGATION BAR (Asian 8-Tab Standard) */}
      {/* ========================================================================= */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {CATEGORY_TABS.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    soundEngine.playClick(800);
                    setActiveCategory(cat.id);
                    if (cat.id === 'demo') {
                      setIsDemoArenaExpanded(true);
                    }
                  }}
                  className={`min-h-[40px] px-3 sm:px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#54D62C] text-slate-950 font-black shadow-[0_0_12px_rgba(84,214,44,0.5)] border border-[#54D62C]'
                      : 'bg-[#0f1724] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm sm:text-base">{cat.icon}</span>
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
            className="min-h-[40px] px-3 sm:px-4 rounded-xl bg-[#0f1724] border border-slate-800 hover:border-amber-400 text-amber-300 text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shrink-0 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">অনুসন্ধান</span>
          </button>
        </div>

        {/* Provider Filter Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
          <span className="text-slate-400 text-[11px] shrink-0 font-sans">প্রোভাইডার:</span>
          {PROVIDER_CHIPS.map((p) => {
            const isSelected = selectedProvider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  soundEngine.playClick(750);
                  setSelectedProvider(p.id);
                }}
                className={`px-2.5 sm:px-3 py-1 rounded-xl transition-all whitespace-nowrap cursor-pointer text-[11px] sm:text-xs ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                    : 'bg-[#0f1724] border border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <span>{p.icon} </span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. OFFICIAL DEMO ARENA (When Demo tab is active or expanded) */}
      {/* ========================================================================= */}
      {(activeCategory === 'demo' || isDemoArenaExpanded) && (
        <section className="relative rounded-2xl overflow-hidden border border-[#54D62C]/40 bg-[#080d14] shadow-xl transition-all">
          <div className="bg-[#0e1622] px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-[#54D62C] text-slate-950 flex items-center justify-center font-black text-base shadow-md">
                👑
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs sm:text-sm font-black text-white">
                    অফিসিয়াল রিয়েল ডেমো অ্যারেনা
                  </h3>
                  <span className="px-2 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-mono font-black">
                    LIVE DEMO
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  সরাসরি খেলুন আসল লাইভ প্রোভাইডার ডেমো • আনলিমিটেড ফ্রি ব্যালেন্স
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  soundEngine.playClick(1000);
                  onLaunchGame(dashboardDemoGameId);
                }}
                className="px-3 py-1 rounded-xl bg-[#54D62C] text-slate-950 text-xs font-mono font-black shadow active:scale-95 transition-all flex items-center space-x-1 cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>ফুলস্ক্রিন</span>
              </button>

              <button
                onClick={() => {
                  soundEngine.playClick(800);
                  setIsDemoArenaExpanded(!isDemoArenaExpanded);
                }}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                {isDemoArenaExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Demo Game Switcher Pills */}
          <div className="bg-slate-950/90 px-3 py-2 border-b border-slate-800/80 flex items-center space-x-2 overflow-x-auto scrollbar-none">
            <span className="text-[11px] font-mono font-bold text-amber-400 shrink-0 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>ডেমো সিলেক্ট:</span>
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
                      ? 'bg-amber-400 text-slate-950 shadow font-black'
                      : 'bg-slate-800/80 text-slate-300 border border-slate-700'
                  }`}
                >
                  <span>{demo.icon}</span>
                  <span>{demo.name}</span>
                </button>
              );
            })}
          </div>

          {isDemoArenaExpanded && (
            <div className="p-2 sm:p-3 bg-[#010906]">
              <DemoIframe
                gameId={dashboardDemoGameId}
                onSelectGame={(gId) => setDashboardDemoGameId(gId)}
              />
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 6. HIGH-DENSITY CASINO GAME GRID (3-Col Mobile / 6-Col Desktop) */}
      {/* ========================================================================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 text-xs font-mono text-slate-400">
          <span>মোট গেম: <strong className="text-[#54D62C]">{filteredGames.length}টি</strong></span>
          <span className="text-[11px]">RTP 96.8% - 98.9% • Provably Fair 🔒</span>
        </div>

        <motion.div
          layout
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3"
        >
          <AnimatePresence>
            {filteredGames.map((game, idx) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.012, 0.2) }}
                key={game.id}
                onClick={() => {
                  soundEngine.playClick(1000);
                  onLaunchGame(game.id);
                }}
                className="group relative bg-[#090f17] border border-slate-800/90 hover:border-[#54D62C] rounded-2xl overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(84,214,44,0.35)] transition-all duration-200 active:scale-[0.96] cursor-pointer flex flex-col justify-between"
              >
                {/* Game Thumbnail Container */}
                <div className="relative aspect-square w-full overflow-hidden bg-slate-950">
                  <img
                    src={game.imageUrl}
                    alt={game.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#090f17] via-transparent to-transparent opacity-80 pointer-events-none" />

                  {/* Top Badge */}
                  {game.badge && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#54D62C] text-slate-950 font-mono text-[8px] sm:text-[9px] font-black shadow-md uppercase tracking-wider">
                      {game.badge}
                    </div>
                  )}

                  {/* Live Status indicator for live dealer games */}
                  {game.category === 'casino' && (
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-rose-600/90 border border-rose-400 text-white font-mono text-[8px] font-black flex items-center gap-1 shadow animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      <span>LIVE</span>
                    </div>
                  )}

                  {/* Play Overlay Button on Hover */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-[1px] p-1 text-center">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#54D62C] text-slate-950 flex items-center justify-center shadow-lg scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-slate-950 ml-0.5" />
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-mono font-black text-[#54D62C]">
                      প্লে করুন
                    </span>
                  </div>
                </div>

                {/* Card Title & Provider Info */}
                <div className="p-1.5 sm:p-2.5 bg-[#090f17] space-y-0.5 border-t border-slate-800/60">
                  <div className="font-black text-[11px] sm:text-xs text-white group-hover:text-[#54D62C] transition-colors truncate drop-shadow-sm">
                    {game.name}
                  </div>
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-slate-300">
                    <span className="text-slate-400 truncate max-w-[60%]">{game.provider}</span>
                    <span className="text-amber-400 font-black">{game.maxMultiplier}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ========================================================================= */}
      {/* 7. LIVE WINNERS FEED (Compact Footer Strip) */}
      {/* ========================================================================= */}
      <div className="pt-2">
        <LiveActivityTicker onLaunchGame={onLaunchGame} />
      </div>

      {/* ========================================================================= */}
      {/* FLOATING VIP WIDGETS (F111 Floating Badges) */}
      {/* ========================================================================= */}
      <div className="fixed bottom-20 right-3.5 sm:right-6 z-40 flex flex-col items-end space-y-2">
        {/* Widget 1: Daily VIP Rewards ৳999 */}
        <button
          onClick={() => {
            soundEngine.playClick(1000);
            setIsRewardsOpen(true);
          }}
          className="group flex items-center bg-[#0c1017]/95 border border-[#54D62C]/60 hover:border-[#54D62C] p-1.5 pr-3 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.7)] backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="দৈনিক ভিআইপি বোনাস ৳৯৯৯"
        >
          <div className="w-8 h-8 rounded-full bg-[#54D62C] text-slate-950 flex items-center justify-center font-black text-xs shadow-md shadow-emerald-500/30">
            🎁
          </div>
          <div className="ml-2 text-left hidden sm:block">
            <div className="text-[10px] text-emerald-400 font-bold leading-none">ভিআইপি বোনাস</div>
            <div className="text-[11px] font-black text-[#54D62C] font-mono leading-tight">৳ ৯৯৯ ফ্রি</div>
          </div>
        </button>

        {/* Widget 2: Lucky Spin Wheel */}
        <button
          onClick={() => {
            soundEngine.playClick(1000);
            setIsShareWheelOpen(true);
          }}
          className="group flex items-center bg-[#0c1017]/95 border border-amber-400/60 hover:border-amber-400 p-1.5 pr-3 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.7)] backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="লাকি স্পিন হুইল"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-md shadow-amber-500/30">
            🎡
          </div>
          <div className="ml-2 text-left hidden sm:block">
            <div className="text-[10px] text-amber-300 font-bold leading-none">লাকি হুইল</div>
            <div className="text-[11px] font-black text-amber-400 font-mono leading-tight">স্পিন করুন</div>
          </div>
        </button>

        {/* Widget 3: Treasure Chest 2x2 */}
        <button
          onClick={() => {
            soundEngine.playClick(1000);
            setIsTreasureOpen(true);
          }}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 hover:scale-110 active:scale-95 transition-all cursor-pointer font-black"
          title="ট্রেজার চেস্ট ওপেন করুন"
        >
          <Sparkles className="w-5 h-5 fill-slate-950 animate-pulse" />
        </button>
      </div>

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
          <div className="bg-[#0c1420] border-2 border-[#54D62C]/50 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center space-x-2 font-mono">
                <Search className="w-4 h-4 text-[#54D62C]" />
                <span>গেম অনুসন্ধান (Live Game Search)</span>
              </h3>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="গেম বা প্রোভাইডারের নাম লিখুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#54D62C] font-mono"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 divide-y divide-slate-800 font-mono">
              {filteredGames.slice(0, 8).map((g) => (
                <div
                  key={g.id}
                  onClick={() => {
                    setShowSearchModal(false);
                    onLaunchGame(g.id);
                  }}
                  className="pt-2 flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <img src={g.imageUrl} alt={g.name} className="w-10 h-10 rounded-xl object-cover" />
                    <div>
                      <div className="text-xs font-bold text-white">{g.name}</div>
                      <div className="text-[10px] text-slate-400">{g.provider} • {g.maxMultiplier}</div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-[#54D62C] text-slate-950 text-[10px] font-black">
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
