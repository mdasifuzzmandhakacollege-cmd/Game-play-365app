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
    isAdmin,
    userRole,
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
    <header className="sticky top-0 z-50 bg-emerald-950/95 backdrop-blur-xl border-b border-emerald-800/80 shadow-2xl transition-all w-full max-w-full">
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

            {/* Global Theme Toggle (Mobile & Desktop) */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center min-w-[34px] min-h-[34px] sm:min-w-[40px] sm:min-h-[40px] px-2 sm:px-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-400 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle Color Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-400 hover:-rotate-12 transition-transform" />
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

            {/* Dedicated Quick Logout Icon/Button in Navbar Bar */}
            <button
              onClick={() => {
                audioEngine.playClick(800);
                if (firebaseUser) firebaseLogout();
                logoutUser();
              }}
              className="flex items-center justify-center min-h-[30px] sm:min-h-[40px] px-2 sm:px-2.5 rounded-lg sm:rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 hover:border-rose-500 shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
              title="লগ আউট করুন (Sign Out)"
              aria-label="Logout"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span className="hidden xl:inline text-xs font-bold ml-1.5">লগআউট</span>
            </button>

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
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Backdrop for easy dismiss on tap */}
              {showUserDropdown && (
                <div
                  className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] sm:bg-transparent"
                  onClick={() => setShowUserDropdown(false)}
                />
              )}

              {showUserDropdown && (
                <div className="fixed sm:absolute top-14 sm:top-full right-2 sm:right-0 mt-1 sm:mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-xs rounded-2xl bg-[#0b0f19]/98 border-2 border-amber-400/40 shadow-2xl p-3.5 z-50 text-sm animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
                  {/* Header info with Top Sign Out */}
                  <div className="px-3 py-2 text-xs text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800/80 flex items-center justify-between">
                    <span className="text-amber-300 font-mono flex items-center space-x-1.5 truncate">
                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{currentUser.username}</span>
                    </span>
                    <button
                      onClick={() => {
                        if (firebaseUser) firebaseLogout();
                        logoutUser();
                        setShowUserDropdown(false);
                      }}
                      className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-black px-2 py-1 rounded-md transition-colors flex items-center space-x-1 cursor-pointer shrink-0 shadow"
                    >
                      <LogOut className="w-3 h-3 stroke-[2.5]" />
                      <span>লগআউট</span>
                    </button>
                  </div>

                  {/* Active User's Profile Summary Card */}
                  <div className="py-2.5 px-3 my-2 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">ব্যালেন্স:</span>
                      <span className="text-amber-400 font-black font-mono">
                        {formattedBalance}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">একাউন্ট স্ট্যাটাস:</span>
                      <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-400 font-bold flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>{currentUser.status === 'ACTIVE' ? 'সক্রিয় (Active)' : currentUser.status}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">ইউজার রোল:</span>
                      <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${
                        isAdmin
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-cyan-500/15 text-cyan-300'
                      }`}>
                        {isAdmin ? '🛡️ অ্যাডমিন / অপারেটর' : '👑 ভিআইপি প্লেয়ার'}
                      </span>
                    </div>

                    {firebaseUser?.email && (
                      <div className="text-[10px] text-slate-400 truncate pt-1 border-t border-slate-800/60 font-mono">
                        ইমেইল: <span className="text-slate-300">{firebaseUser.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Links */}
                  <div className="border-t border-slate-800/80 pt-2 space-y-2">
                    <button
                      onClick={() => {
                        setActiveTab('profile');
                        setShowUserDropdown(false);
                        audioEngine.playClick(1000);
                      }}
                      className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer border border-slate-800"
                    >
                      <span className="flex items-center space-x-2">
                        <UserIcon className="w-4 h-4 text-cyan-400" />
                        <span>প্রোফাইল ড্যাশবোর্ড (Profile)</span>
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {/* ONLY VISIBLE IF USER HAS ADMIN ROLE IN FIRESTORE */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setActiveTab('admin');
                          setShowUserDropdown(false);
                          audioEngine.playClick(1000);
                        }}
                        className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-between transition-all cursor-pointer border border-amber-500/30"
                      >
                        <span className="flex items-center space-x-2">
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                          <span>অ্যাডমিন প্যানেল (Admin Panel)</span>
                        </span>
                        <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black">
                          ADMIN
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        refreshState();
                        setShowUserDropdown(false);
                        audioEngine.playClick(1000);
                      }}
                      className="w-full min-h-[36px] px-3 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 border border-cyan-500/30 flex items-center justify-center space-x-1.5 font-bold text-xs cursor-pointer transition-all"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>ওয়ালেট ও ব্যালেন্স সিঙ্ক (Sync)</span>
                    </button>

                    {/* Highly Prominent Front-Facing Logout Button */}
                    <button
                      onClick={() => {
                        if (firebaseUser) firebaseLogout();
                        logoutUser();
                        setShowUserDropdown(false);
                      }}
                      className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-rose-600/25 hover:bg-rose-600 text-rose-200 hover:text-white border-2 border-rose-500/60 shadow-lg shadow-rose-600/20 flex items-center justify-center space-x-2 font-black cursor-pointer text-xs transition-all active:scale-95"
                    >
                      <LogOut className="w-4 h-4 stroke-[2.5]" />
                      <span>লগ আউট (Sign Out)</span>
                    </button>
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
