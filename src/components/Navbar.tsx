/**
 * @file Navbar.tsx
 * @description Luxury Dark Black & Metallic Gold Navigation Header for Playall 365.
 * Features Real-Time Animated Global Balance Counter, Web Audio API Sound Toggle,
 * VIP Avatar Switcher, Currency Toggle, and Full Desktop Navigation.
 */

import React, { useState } from 'react';
import {
  Crown,
  Wallet,
  ArrowUpRight,
  ChevronDown,
  Gamepad2,
  Zap,
  Award,
  Share2,
  Gift,
  TrendingUp,
  FolderLock,
  CreditCard,
  Terminal,
  LogOut,
  Coins,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Fingerprint,
  User as UserIcon,
  Sun,
  Moon,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useWalletGame, MainNavTab } from '../contexts/WalletGameContext';
import { NotificationBell } from './NotificationBell';

interface NavbarProps {
  onOpenCashier: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCashier,
  onOpenProfile
}) => {
  const { user: firebaseUser, logout: firebaseLogout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    currentUser,
    currentWallet,
    users,
    currency,
    toggleCurrency,
    switchUser,
    logoutUser,
    refreshState,
    formattedBalance,
    balanceFlash,
    activeTab,
    setActiveTab,
    soundMuted,
    toggleSound,
    audioEngine
  } = useWalletGame();

  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-emerald-950/95 backdrop-blur-xl border-b border-emerald-800/80 shadow-2xl transition-all w-full max-w-full overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-20 gap-1 sm:gap-4 w-full">
          
          {/* Left: Brand Logo (GamePlay365) */}
          <div className="flex items-center space-x-1.5 sm:space-x-6 shrink-0 min-w-0">
            <button
              onClick={() => {
                audioEngine.playClick();
                setActiveTab('lobby');
              }}
              className="flex items-center space-x-1.5 sm:space-x-3 group text-left focus:outline-none min-h-[36px] sm:min-h-[48px] cursor-pointer shrink-0"
            >
              <div className="relative shrink-0">
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-[1.5px] shadow-md shadow-amber-500/25 group-hover:shadow-amber-500/50 transition-all duration-300">
                  <div className="w-full h-full bg-emerald-950 rounded-[10px] sm:rounded-[13px] flex items-center justify-center">
                    <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center space-x-1">
                  <span className="text-sm xs:text-base sm:text-2xl font-black tracking-tight text-white truncate">
                    GamePlay<span className="text-transparent bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text">365</span>
                  </span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 uppercase">
                    VIP
                  </span>
                </div>
              </div>
            </button>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden xl:flex items-center space-x-2 bg-emerald-900/60 p-1.5 rounded-2xl border border-emerald-700/60 text-sm font-semibold">
              <button
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('lobby');
                }}
                className={`min-h-[44px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'lobby'
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-800/60'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Lobby</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('games');
                }}
                className={`min-h-[44px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'games'
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-800/60'
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>Crash &amp; Slots</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('vip');
                }}
                className={`min-h-[44px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'vip'
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-800/60'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>VIP Club</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('affiliate');
                }}
                className={`min-h-[44px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'affiliate'
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-800/60'
                }`}
              >
                <Share2 className="w-4 h-4" />
                <span>Affiliate</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('promo');
                }}
                className={`min-h-[44px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'promo'
                    ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-emerald-200 hover:text-white hover:bg-emerald-800/60'
                }`}
              >
                <Gift className="w-4 h-4" />
                <span>Rewards</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('admin');
                }}
                className={`min-h-[44px] px-3.5 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('audit');
                }}
                className={`min-h-[44px] px-3.5 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                    : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20'
                }`}
              >
                <Fingerprint className="w-4 h-4" />
                <span>Audit</span>
              </button>

              <button
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('workbench');
                }}
                className={`min-h-[44px] px-3.5 rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer ${
                  ['workbench', 'latency', 'stress', 'hmac', 'ledger', 'architecture', 'code', 'deadlock'].includes(activeTab)
                    ? 'bg-slate-800 text-cyan-400 border border-cyan-500/40 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Terminal className="w-4 h-4" />
                <span>Workbench</span>
              </button>
            </nav>
          </div>

          {/* Right: Sound, Notification, Golden Ratio Balance & Deposit Pill + User Avatar */}
          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            
            {/* Global Web Audio API Sound Toggle (Compact & Touch-optimized) */}
            <button
              onClick={toggleSound}
              className={`flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 ${
                soundMuted
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20 shadow-amber-500/10'
              }`}
              title={soundMuted ? 'সাউন্ড চালু করুন (Unmute Audio)' : 'সাউন্ড বন্ধ করুন (Mute Audio)'}
              aria-label="Toggle Casino Sound"
            >
              {soundMuted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
              )}
            </button>

            {/* Global Theme Toggle (Desktop only) */}
            <button
              onClick={toggleTheme}
              className="hidden md:flex items-center justify-center min-w-[40px] min-h-[40px] px-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-400 transition-all shadow-md active:scale-95 cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'Light Platinum' : 'Obsidian Gold'} theme`}
              aria-label="Toggle Color Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 hover:-rotate-12 transition-transform" />
              )}
            </button>

            {/* Currency Switcher (Desktop only) */}
            <button
              onClick={toggleCurrency}
              className="hidden lg:flex items-center space-x-1.5 min-h-[40px] px-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 text-amber-300 text-xs font-semibold transition-all cursor-pointer"
              title="Switch currency (BDT / USD)"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{currency}</span>
            </button>

            {/* Notification Bell */}
            <div className="flex items-center shrink-0">
              <NotificationBell
                currentUser={currentUser}
                onNavigateTab={setActiveTab}
                currency={currency}
              />
            </div>

            {/* Golden Ratio Masterpiece: Real-time Balance + Deposit Pill (100% Mobile Optimized) */}
            <div
              className={`flex items-center bg-[#0d121f] border rounded-xl sm:rounded-2xl p-0.5 sm:p-1 shadow-md transition-all duration-300 shrink-0 ${
                balanceFlash === 'credit'
                  ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-emerald-500/25 scale-[1.02]'
                  : balanceFlash === 'deduct'
                  ? 'border-rose-400 ring-2 ring-rose-400/30'
                  : 'border-amber-500/40 shadow-amber-500/10'
              }`}
            >
              {/* Balance Display */}
              <div
                className="px-1.5 sm:px-3 py-0.5 sm:py-1 text-right cursor-pointer"
                onClick={() => {
                  audioEngine.playClick();
                  onOpenCashier();
                }}
                title="ওয়ালেট ব্যালেন্স (ক্যাশিয়ারে যান)"
              >
                <div className="hidden xs:flex items-center justify-end space-x-0.5 text-[8px] sm:text-[9px] text-slate-400 uppercase font-medium">
                  <Wallet className="w-2.5 h-2.5 text-amber-400" />
                  <span>ব্যালেন্স</span>
                </div>
                <div
                  className={`text-[10px] xs:text-xs sm:text-sm font-black font-mono leading-tight transition-colors truncate max-w-[68px] xs:max-w-[90px] sm:max-w-none ${
                    balanceFlash === 'credit'
                      ? 'text-emerald-400 animate-pulse'
                      : balanceFlash === 'deduct'
                      ? 'text-rose-400'
                      : 'text-amber-300'
                  }`}
                >
                  {formattedBalance}
                </div>
              </div>

              {/* Deposit Button (High-Vibrancy Gold Gradient Touch Target) */}
              <button
                onClick={() => {
                  audioEngine.playClick(1200);
                  onOpenCashier();
                }}
                className="min-h-[28px] sm:min-h-[36px] px-2 sm:px-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-[10px] xs:text-xs sm:text-xs tracking-wide flex items-center space-x-0.5 sm:space-x-1 shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
              >
                <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[3]" />
                <span>ডিপোজিট</span>
              </button>
            </div>

            {/* Profile Avatar / User Switcher (1-Tap User Drawer Access) */}
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  audioEngine.playClick();
                  setShowUserDropdown(!showUserDropdown);
                }}
                className="flex items-center space-x-1 min-h-[30px] sm:min-h-[40px] p-0.5 sm:px-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-200 transition-all focus:outline-none cursor-pointer"
                title="প্রোফাইল মেনু ও অ্যাকাউন্ট সুইচ"
                aria-label="User Profile"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-tr from-amber-400 to-cyan-400 flex items-center justify-center text-slate-950 font-black text-[11px] sm:text-xs shadow-md">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0b0f19] border border-slate-800 shadow-2xl p-3 z-50 text-sm animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 text-xs text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800/80 flex items-center justify-between">
                    <span>Active VIP Player</span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      {currentUser.country_code === 'BD' ? '🇧🇩 BD VIP' : 'Global'}
                    </span>
                  </div>

                  <div className="py-2 space-y-1.5 max-h-60 overflow-y-auto">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          switchUser(u.id);
                          setShowUserDropdown(false);
                        }}
                        className={`w-full min-h-[44px] text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                          u.id === currentUser.id
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                            : 'hover:bg-slate-900 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-white">{u.username}</div>
                          <div className="text-xs text-slate-400">
                            {u.country_code === 'BD' ? '🇧🇩 Bangladesh (bKash/Nagad)' : `🏳️ ${u.country_code} (${u.currency})`}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 text-xs rounded-md bg-emerald-500/20 text-emerald-400 font-bold">
                          {u.status}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-slate-800/80 pt-2 mt-1 space-y-1">
                    <button
                      onClick={() => {
                        setActiveTab('profile');
                        setShowUserDropdown(false);
                        audioEngine.playClick(1000);
                      }}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span className="flex items-center space-x-1.5">
                        <UserIcon className="w-4 h-4 text-cyan-400" />
                        <span>প্রোফাইল ড্যাশবোর্ড (Profile)</span>
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('admin');
                        setShowUserDropdown(false);
                        audioEngine.playClick(1000);
                      }}
                      className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
                    >
                      <span className="flex items-center space-x-1.5">
                        <ShieldCheck className="w-4 h-4" />
                        <span>অ্যাডমিন প্যানেল (Admin)</span>
                      </span>
                      <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black">
                        OPERATOR
                      </span>
                    </button>

                    <div className="flex justify-between items-center px-1 pt-1">
                      <button
                        onClick={() => {
                          refreshState();
                          setShowUserDropdown(false);
                          audioEngine.playClick(1000);
                        }}
                        className="min-h-[40px] px-3 text-cyan-400 hover:text-cyan-300 flex items-center space-x-1.5 font-semibold cursor-pointer text-xs"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Sync</span>
                      </button>

                      <button
                        onClick={() => {
                          if (firebaseUser) firebaseLogout();
                          logoutUser();
                          setShowUserDropdown(false);
                        }}
                        className="min-h-[40px] px-3 text-red-400 hover:text-red-300 flex items-center space-x-1.5 font-bold cursor-pointer text-xs"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </header>
  );
};
