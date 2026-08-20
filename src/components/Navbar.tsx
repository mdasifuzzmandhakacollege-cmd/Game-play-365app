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
    <header className="sticky top-0 z-50 bg-[#07090e]/95 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl transition-all">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Left: Brand Logo */}
          <div className="flex items-center space-x-2 sm:space-x-8 shrink-0">
            <button
              onClick={() => {
                audioEngine.playClick();
                setActiveTab('lobby');
              }}
              className="flex items-center space-x-2 sm:space-x-3.5 group text-left focus:outline-none min-h-[40px] sm:min-h-[48px] cursor-pointer"
            >
              <div className="relative shrink-0">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-[1.5px] shadow-lg shadow-amber-500/25 group-hover:shadow-amber-500/50 transition-all duration-300">
                  <div className="w-full h-full bg-[#090b10] rounded-[10px] sm:rounded-[14px] flex items-center justify-center">
                    <Crown className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-base sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-200 bg-clip-text text-transparent">
                    GamePlay<span className="text-transparent bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text">365</span>
                  </span>
                  <span className="hidden sm:inline-block px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-bold rounded-md bg-amber-400/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                    VIP
                  </span>
                </div>
              </div>
            </button>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden xl:flex items-center space-x-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/80 text-sm font-semibold">
              <button
                onClick={() => {
                  audioEngine.playClick();
                  setActiveTab('lobby');
                }}
                className={`min-h-[44px] px-4 rounded-xl flex items-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'lobby'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
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
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-md shadow-cyan-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
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
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
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
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
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
                    ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
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

          {/* Right: Sound, Theme, Notification & Mobile-Optimized Deposit + Balance Card */}
          <div className="flex items-center space-x-1 sm:space-x-2.5">
            
            {/* Global Web Audio API Sound Toggle (Compact on mobile) */}
            <button
              onClick={toggleSound}
              className={`flex items-center justify-center w-8 h-8 sm:min-w-[42px] sm:min-h-[42px] sm:px-3 rounded-lg sm:rounded-xl border transition-all shadow-md active:scale-95 cursor-pointer shrink-0 ${
                soundMuted
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20'
                  : 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20 shadow-amber-500/10'
              }`}
              title={soundMuted ? 'সাউন্ড চালু করুন (Unmute Audio)' : 'সাউন্ড বন্ধ করুন (Mute Audio)'}
              aria-label="Toggle Casino Sound"
            >
              {soundMuted ? (
                <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
              )}
            </button>

            {/* Global Theme Toggle (Desktop only) */}
            <button
              onClick={toggleTheme}
              className="hidden md:flex items-center justify-center min-w-[42px] min-h-[42px] px-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-400 transition-all shadow-md active:scale-95 cursor-pointer"
              title={`Switch to ${theme === 'dark' ? 'Light Platinum' : 'Obsidian Gold'} theme`}
              aria-label="Toggle Color Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-700 hover:-rotate-12 transition-transform" />
              )}
            </button>

            {/* Currency Switcher */}
            <button
              onClick={toggleCurrency}
              className="hidden lg:flex items-center space-x-1.5 min-h-[42px] px-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 text-amber-300 text-sm font-semibold transition-all cursor-pointer"
              title="Switch currency (BDT / USD)"
            >
              <Coins className="w-4 h-4 text-amber-400" />
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

            {/* Real-time Animated Balance Card & Deposit CTA Container (Mobile Masterpiece) */}
            <div
              className={`flex items-center bg-[#0d121f] border rounded-xl sm:rounded-2xl p-0.5 sm:p-1 shadow-lg transition-all duration-300 shrink-0 ${
                balanceFlash === 'credit'
                  ? 'border-emerald-400 ring-2 ring-emerald-400/50 shadow-emerald-500/25 scale-[1.02]'
                  : balanceFlash === 'deduct'
                  ? 'border-rose-400 ring-2 ring-rose-400/30'
                  : 'border-amber-500/40 shadow-amber-500/10'
              }`}
            >
              {/* Animated Balance Display */}
              <div
                className="px-2 sm:px-3 py-0.5 sm:py-1 text-right cursor-pointer"
                onClick={() => {
                  audioEngine.playClick();
                  onOpenCashier();
                }}
              >
                <div className="text-[8px] sm:text-[10px] text-slate-400 font-medium uppercase tracking-wider flex items-center justify-end space-x-0.5 sm:space-x-1">
                  <Wallet className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
                  <span className="hidden xs:inline">ব্যালেন্স</span>
                </div>
                <div
                  className={`text-[11px] xs:text-xs sm:text-base font-black leading-tight font-mono transition-colors ${
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

              {/* Deposit Button (100% Mobile Optimized, Vibrant & Touch Friendly) */}
              <button
                onClick={() => {
                  audioEngine.playClick(1200);
                  onOpenCashier();
                }}
                className="min-h-[32px] sm:min-h-[42px] px-2.5 sm:px-5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-[11px] sm:text-sm tracking-wide flex items-center space-x-1 sm:space-x-1.5 shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
              >
                <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                <span>ডিপোজিট</span>
              </button>
            </div>

            {/* Profile Avatar / User Switcher */}
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  audioEngine.playClick();
                  setShowUserDropdown(!showUserDropdown);
                }}
                className="flex items-center space-x-1 min-h-[36px] sm:min-h-[44px] p-0.5 sm:px-2 rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 transition-all focus:outline-none cursor-pointer"
              >
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-tr from-amber-400 to-cyan-400 flex items-center justify-center text-slate-950 font-black text-xs sm:text-sm shadow-md">
                  {currentUser.username.substring(0, 2).toUpperCase()}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
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
                        className="min-h-[40px] px-3 text-cyan-400 hover:text-cyan-300 flex items-center space-x-1.5 font-semibold cursor-pointer"
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
                        className="min-h-[40px] px-3 text-red-400 hover:text-red-300 flex items-center space-x-1.5 font-bold cursor-pointer"
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
