/**
 * @file GameLobby.tsx
 * @description International Standard Luxury & Bangladeshi G777 / Playall 365 Mobile Casino Lobby.
 * Matches authentic mobile layout with App Download Carousel, Sub-app Icons (F222, 999BD, G777),
 * Marquee Announcement with Mailbox count (28), User Dashboard Bar with 1-Click Copy & Balance Sync,
 * Category Switcher (সেরা, স্লট, মিনি গেমস, খেলাধুলা, ক্যাসিনো, ফিশিং), 2-Column Game Grid with HOT Badges,
 * and Interactive Modals (Support, Inbox, Share Wheel).
 */

import React, { useState, useEffect } from 'react';
import {
  Flame,
  Crown,
  Sparkles,
  Zap,
  Play,
  Search,
  ArrowRight,
  Gamepad2,
  Tv,
  Trophy,
  Layers,
  ChevronRight,
  Copy,
  Check,
  RotateCw,
  Gift,
  Share2,
  Users,
  Headphones,
  SlidersHorizontal,
  Mail,
  Download,
  Star,
  ShieldCheck,
  Send,
  MessageCircle,
  X
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { soundEngine } from '../services/soundEngine';
import { useWalletGame } from '../contexts/WalletGameContext';
import { assetLoader, GameAsset } from '../services/assetLoader';
import { InboxMailModal } from './InboxMailModal';
import { SupportModal } from './SupportModal';
import { ShareWheelModal } from './ShareWheelModal';
import { LiveActivityTicker } from './LiveActivityTicker';

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

const SUB_APP_SHORTCUTS = [
  { id: 'f222', name: 'F222.com', icon: '💎', tag: 'VIP' },
  { id: '999bd', name: '999BD', icon: '🎰', tag: 'BD' },
  { id: 'f999', name: 'F999', icon: '⚡', tag: 'HOT' },
  { id: 'f111', name: 'F111', icon: '🪙', tag: 'NEW' },
  { id: 'g777', name: 'G777', icon: '👑', tag: 'MAIN' }
];

const CATEGORY_TABS = [
  { id: 'hot', label: 'সেরা', icon: '🔥' },
  { id: 'slots', label: 'স্লট', icon: '🎰' },
  { id: 'minigames', label: 'মিনি গেমস', icon: '🧩' },
  { id: 'sports', label: 'খেলাধুলা', icon: '⚽' },
  { id: 'casino', label: 'ক্যাসিনো', icon: '♠️' },
  { id: 'fishing', label: 'ফিশিং', icon: '🎣' }
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
  const { topUpWallet, showToast } = useWalletGame();

  const [activeCategory, setActiveCategory] = useState<string>('hot');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [syncingBalance, setSyncingBalance] = useState<boolean>(false);

  // Modals
  const [isInboxOpen, setIsInboxOpen] = useState<boolean>(false);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [isShareWheelOpen, setIsShareWheelOpen] = useState<boolean>(false);

  // Download Promo Slide State
  const [bannerSlide, setBannerSlide] = useState<number>(0);

  useEffect(() => {
    assetLoader.preloadAssets();
    const timer = setInterval(() => {
      setBannerSlide((prev) => (prev + 1) % 3);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentUser.username);
    setCopiedId(true);
    soundEngine.playClick(1000);
    showToast(`ইউজারনেম '${currentUser.username}' কপি করা হয়েছে!`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSyncBalance = () => {
    soundEngine.playClick(850);
    setSyncingBalance(true);
    setTimeout(() => {
      setSyncingBalance(false);
      showToast('ব্যালেন্স রিয়েল-টাইমে সিঙ্ক সম্পন্ন হয়েছে।');
    }, 500);
  };

  const handleClaimAppBonus = () => {
    soundEngine.playMegaWin();
    topUpWallet(49.99);
    showToast('🎉 অ্যাপ ডাউনলোড বোনাস ৳৪৯.৯৯ ক্রেডিট করা হয়েছে!');
  };

  const filteredGames = CASINO_GAMES.filter((game) => {
    const matchCategory =
      activeCategory === 'hot'
        ? true
        : activeCategory === 'minigames'
        ? game.category === 'minigames'
        : activeCategory === 'slots'
        ? game.category === 'slots'
        : activeCategory === 'casino'
        ? game.category === 'casino'
        : true;

    const matchSearch =
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (game.nameBn && game.nameBn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      game.provider.toLowerCase().includes(searchQuery.toLowerCase());

    return matchCategory && matchSearch;
  });

  const formattedBalance =
    currency === 'BDT'
      ? `৳ ${Number(currentWallet?.real_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$ ${Number(currentWallet?.real_balance || 0).toFixed(2)}`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-md sm:max-w-xl md:max-w-4xl lg:max-w-7xl mx-auto px-2 sm:px-4 py-3 space-y-3 sm:space-y-4 pb-24 font-bengali text-white selection:bg-amber-500 selection:text-slate-950"
    >
      
      {/* 1. TOP HEADER APP BAR (Search, G777 Brand, Inbox Mailbox Count 28) */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl px-3 py-2.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-[1.5px] shadow-sm">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-amber-400 text-xs">
              G777
            </div>
          </div>
          <div>
            <div className="text-sm sm:text-base font-black tracking-tight leading-none text-white">
              GamePlay<span className="text-amber-400">365</span>
            </div>
            <div className="text-[10px] text-amber-400 font-mono font-bold tracking-wider">
              PREMIER CASINO
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Search Trigger */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="min-w-[40px] min-h-[40px] p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            aria-label="গেম অনুসন্ধান"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Inbox / Notification with 28 Counter */}
          <button
            onClick={() => {
              soundEngine.playClick(900);
              setIsInboxOpen(true);
            }}
            className="relative min-w-[40px] min-h-[40px] p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
            aria-label="ইনবক্স মেসেজ"
          >
            <Mail className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[9px] font-black animate-pulse shadow-sm">
              28
            </span>
          </button>

          {/* Deposit Quick Action */}
          <button
            onClick={() => {
              soundEngine.playClick(1000);
              onOpenCashier();
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs sm:text-sm shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center space-x-1 cursor-pointer"
          >
            <span>+৫% জমা</span>
          </button>
        </div>
      </div>

      {/* 2. APP DOWNLOAD & PROMOTIONS CAROUSEL BANNER */}
      <div className="relative rounded-2xl overflow-hidden border border-amber-500/30 shadow-xl bg-gradient-to-r from-amber-950/80 via-slate-950 to-slate-900 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xs sm:max-w-md">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold">
              <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
              <span>অ্যাপ ডাউনলোড এক্সক্লুসিভ অফার</span>
            </div>

            <h2 className="text-base sm:text-lg font-black text-white leading-tight">
              <span className="text-amber-400">৪৯.৯৯ টাকা</span> পেতে অ্যাপ্লিকেশনটি ডাউনলোড করুন!
            </h2>

            <p className="text-[11px] text-slate-300">
              অ্যান্ড্রয়েড এবং আইওএস ডিভাইসে ইনস্ট্যান্ট ডিপোজিট ও লাইভ স্পিন উপভোগ করুন।
            </p>
          </div>

          <div className="flex flex-col items-end space-y-2 shrink-0">
            <button
              onClick={handleClaimAppBonus}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ডাউনলোড (APK)</span>
            </button>

            {/* Pagination Dots */}
            <div className="flex items-center space-x-1">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    bannerSlide === idx ? 'w-4 bg-amber-400' : 'w-1.5 bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. SUB-APP SHORTCUTS BAR (F222.com, 999BD, F999, F111, G777) */}
      <div className="grid grid-cols-5 gap-2">
        {SUB_APP_SHORTCUTS.map((app) => (
          <button
            key={app.id}
            onClick={() => {
              soundEngine.playClick(750);
              showToast(`${app.name} সার্ভারে সংযুক্ত হচ্ছে...`);
            }}
            className="min-h-[58px] bg-[#0b0f19] hover:bg-slate-900 border border-slate-800 rounded-2xl p-2 flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 group cursor-pointer"
          >
            <div className="text-xl group-hover:scale-110 transition-transform">
              {app.icon}
            </div>
            <div className="text-[11px] font-bold font-mono text-slate-300 group-hover:text-amber-400 truncate w-full text-center">
              {app.name}
            </div>
          </button>
        ))}
      </div>

      {/* 4. MARQUEE ANNOUNCEMENT NOTICE BAR */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2.5 flex items-center space-x-2 text-xs font-mono text-slate-300 overflow-hidden">
        <span className="text-amber-400 shrink-0 text-sm">📢</span>
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <div className="inline-block animate-marquee">
            যোগ দিন এবং পুরস্কার জিতে নিন! আমরা আশা করি G777 / Playall 365-এ আপনার গেমিং যাত্রা চমৎকার হবে... bKash ও Nagad-এ ০% ফিতে ডিপোজিট ও উইথড্র করুন।
          </div>
        </div>
      </div>

      {/* 5. USER QUICK ACTION STATUS BAR (Matching Screenshot) */}
      <div className="bg-[#0b0f19] border border-amber-500/30 rounded-2xl p-3 sm:p-4 shadow-xl space-y-3.5">
        {/* User & Balance Row */}
        <div className="flex items-center justify-between gap-2">
          {/* User ID Dropdown & Copy */}
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-amber-500/50 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
              {currentUser.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className="font-bold text-sm text-white truncate max-w-[110px] sm:max-w-[180px]">{currentUser.username}</span>
              <button
                onClick={handleCopyId}
                className="min-w-[32px] min-h-[32px] p-1.5 text-slate-400 hover:text-amber-400 active:scale-95 transition-colors flex items-center justify-center shrink-0"
                title="Copy User ID"
                aria-label="ইউজার আইডি কপি করুন"
              >
                {copiedId ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Balance Pill & Reload */}
          <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl font-mono shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs sm:text-sm font-black text-amber-400">
              {formattedBalance}
            </span>
            <button
              onClick={handleSyncBalance}
              className={`min-w-[28px] min-h-[28px] p-1 text-slate-400 hover:text-white transition-all flex items-center justify-center ${
                syncingBalance ? 'animate-spin text-amber-400' : ''
              }`}
              title="Sync Balance"
              aria-label="ব্যালেন্স সিঙ্ক"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4 Action Buttons Grid (পুরস্কার শেয়ার, ছায়া, সমর্থন, আরও (19)) */}
        <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-xs">
          {/* 1. Share Reward */}
          <button
            onClick={() => {
              soundEngine.playClick(900);
              setIsShareWheelOpen(true);
            }}
            className="min-h-[56px] p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 text-center cursor-pointer group"
          >
            <Gift className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-300 truncate w-full">পুরস্কার শেয়ার</span>
          </button>

          {/* 2. Affiliate / Shadow MLM */}
          <button
            onClick={() => {
              soundEngine.playClick(900);
              if (onNavigateTab) onNavigateTab('affiliate');
            }}
            className="min-h-[56px] p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 text-center cursor-pointer group"
          >
            <Users className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-300 truncate w-full">ছায়া (Affiliate)</span>
          </button>

          {/* 3. Support Live */}
          <button
            onClick={() => {
              soundEngine.playClick(900);
              setIsSupportOpen(true);
            }}
            className="min-h-[56px] p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 text-center cursor-pointer group"
          >
            <Headphones className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-300 truncate w-full">সমর্থন</span>
          </button>

          {/* 4. More Hub */}
          <button
            onClick={() => {
              soundEngine.playClick(900);
              if (onNavigateTab) onNavigateTab('promo');
            }}
            className="min-h-[56px] p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 flex flex-col items-center justify-center space-y-1 transition-all active:scale-95 text-center cursor-pointer group"
          >
            <SlidersHorizontal className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-bold text-slate-300 truncate w-full">আরও (19)</span>
          </button>
        </div>
      </div>

      {/* 5.5 REAL-TIME LIVE ACTIVITY & RECENT WINNERS TICKER */}
      <LiveActivityTicker onLaunchGame={onLaunchGame} />

      {/* 6. CATEGORY SWITCHER TABS (সেরা, স্লট, মিনি গেমস, খেলাধুলা, ক্যাসিনো, ফিশিং) */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1.5 scrollbar-none py-1">
        {CATEGORY_TABS.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              soundEngine.playClick(800);
              setActiveCategory(cat.id);
            }}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-2 shrink-0 transition-all active:scale-95 cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)] font-black'
                : 'bg-[#0b0f19] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
          >
            <span className="text-sm">{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* 7. 2-COLUMN MOBILE GAME GRID (Matching Screenshot) */}
      <motion.div 
        layout
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
      >
        <AnimatePresence>
          {filteredGames.map((game, idx) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
              key={game.id}
              onClick={() => {
                soundEngine.playClick(1000);
                onLaunchGame(game.id);
              }}
              className="group relative bg-[#0b0f19] border border-slate-800 hover:border-amber-500/80 rounded-2xl overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] transition-all duration-300 hover:-translate-y-1 active:scale-[0.98] cursor-pointer flex flex-col justify-between min-h-[160px]"
            >
            {/* Top Thumbnail Container */}
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950">
              <img
                src={game.imageUrl}
                alt={game.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 opacity-90 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-transparent to-transparent opacity-80" />

              {/* Badges Top Left & Star Top Right */}
              <div className="absolute top-2 left-2 flex items-center space-x-1">
                {game.badge && (
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-black shadow-md">
                    {game.badge}
                  </span>
                )}
              </div>

              <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
              </div>

              {/* Play Hover Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <div className="w-12 h-12 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-400/50">
                  <Play className="w-6 h-6 fill-slate-950 ml-0.5" />
                </div>
              </div>
            </div>

            {/* Bottom Card Title & Provider Details */}
            <div className="p-3 space-y-1">
              <div className="font-black text-xs sm:text-sm text-white group-hover:text-amber-400 transition-colors truncate">
                {game.name}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="truncate pr-1">{game.nameBn || game.provider}</span>
                <span className="text-amber-400 font-bold shrink-0">{game.maxMultiplier}</span>
              </div>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
      </motion.div>

      {/* 8. FLOATING TELEGRAM & LUCKY REWARD SHORTCUTS */}
      <div className="fixed bottom-20 right-3 z-40 flex flex-col space-y-2">
        {/* Floating Telegram Channel Button */}
        <a
          href="https://t.me/playall365_official"
          target="_blank"
          rel="noreferrer"
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-600 to-blue-500 text-white flex items-center justify-center shadow-xl shadow-sky-500/30 hover:scale-110 active:scale-95 transition-all"
          title="Telegram Community"
        >
          <Send className="w-5 h-5 ml-[-2px] mt-[-1px]" />
        </a>

        {/* Floating Red Packet / Lucky Gift Bubble */}
        <button
          onClick={() => {
            soundEngine.playClick(900);
            setIsShareWheelOpen(true);
          }}
          className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 text-white flex items-center justify-center shadow-xl shadow-rose-500/30 hover:scale-110 active:scale-95 transition-all animate-bounce cursor-pointer"
          title="Lucky Bonus"
        >
          <Gift className="w-5 h-5" />
        </button>
      </div>

      {/* Modals */}
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
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#0b0f19] border-2 border-amber-500/40 rounded-2xl w-full max-w-lg p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center space-x-2">
                <Search className="w-4 h-4 text-amber-400" />
                <span>গেম অনুসন্ধান (Search Games)</span>
              </h3>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
              <input
                type="text"
                autoFocus
                placeholder="গেম বা প্রোভাইডারের নাম লিখুন (e.g. Aviator, Super Ace)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 divide-y divide-slate-800/40">
              {filteredGames.slice(0, 5).map((g) => (
                <div
                  key={g.id}
                  onClick={() => {
                    setShowSearchModal(false);
                    onLaunchGame(g.id);
                  }}
                  className="pt-1.5 flex items-center justify-between p-2 rounded-xl hover:bg-slate-900 cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <img src={g.imageUrl} alt={g.name} className="w-8 h-8 rounded-lg object-cover" />
                    <div>
                      <div className="text-xs font-bold text-white">{g.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{g.provider}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                    খেলুন
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
