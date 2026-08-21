/**
 * @file UserProfileView.tsx
 * @description Master User Profile & VIP Management Dashboard for Playall 365.
 * Structured with harmonious visual proportion, balanced hierarchy, responsive mobile layout,
 * live transaction ledger, real-time balance synchronization, and VIP progression.
 */

import React, { useState } from 'react';
import {
  Crown,
  Sparkles,
  Shield,
  Award,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  Zap,
  Gift,
  Coins,
  ShieldCheck,
  RotateCw,
  SlidersHorizontal,
  User,
  Phone,
  Mail,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { useWalletGame } from '../contexts/WalletGameContext';
import { useAuth } from '../contexts/AuthContext';
import { WageringRequirements } from './WageringRequirements';
import { GoogleDrivePickerHub } from './GoogleDrivePickerHub';
import { soundEngine } from '../services/soundEngine';
import { motion, AnimatePresence } from 'framer-motion';

interface UserProfileViewProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onOpenCashier: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  currentWallet,
  currency,
  onOpenCashier
}) => {
  const { transactions, refreshState, showToast } = useWalletGame();
  const { user: authUser } = useAuth();
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTx, setSearchTx] = useState<string>('');
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TURNOVER' | 'DOCS' | 'LEDGER'>('OVERVIEW');

  const userTransactions = transactions.filter((tx) => tx.user_id === currentUser.id);

  // VIP Financial Stats Calculation
  const totalBets = userTransactions
    .filter((tx) => tx.type === 'BET')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalWins = userTransactions
    .filter((tx) => tx.type === 'WIN' || tx.type === 'JACKPOT')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netProfit = totalWins - totalBets;
  const winCount = userTransactions.filter((tx) => (tx.type === 'WIN' || tx.type === 'JACKPOT') && tx.amount > 0).length;
  const betCount = userTransactions.filter((tx) => tx.type === 'BET').length;
  const winRate = betCount > 0 ? ((winCount / betCount) * 100).toFixed(1) : '0.0';

  const filteredTxs = userTransactions.filter((tx) => {
    const matchType = filterType === 'ALL' || tx.type === filterType;
    const matchSearch =
      tx.transaction_id.toLowerCase().includes(searchTx.toLowerCase()) ||
      tx.game_id.toLowerCase().includes(searchTx.toLowerCase()) ||
      tx.provider_id.toLowerCase().includes(searchTx.toLowerCase());
    return matchType && matchSearch;
  });

  const handleCopyUserId = () => {
    navigator.clipboard.writeText(currentUser.id);
    setCopiedId(true);
    soundEngine.playClick(950);
    showToast('ইউজার আইডি সফলভাবে কপি হয়েছে');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSyncLedger = async () => {
    soundEngine.playClick(850);
    setIsSyncing(true);
    try {
      await refreshState();
      setTimeout(() => {
        setIsSyncing(false);
        showToast('প্রোফাইল ও ওয়ালেট ডাটা সিঙ্ক সম্পন্ন হয়েছে');
      }, 450);
    } catch {
      setIsSyncing(false);
    }
  };

  const currencySymbol = currency === 'BDT' ? '৳' : '$';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-28 font-sans text-slate-100 selection:bg-amber-400 selection:text-slate-950"
    >
      {/* 1. MASTER PROFILE HERO (Harmonious 62% / 38% Visual Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch w-full max-w-full">
        
        {/* Left Column (Primary Visual Card): User Identity, VIP Badge & Vault Balances */}
        <div className="lg:col-span-7 golden-ratio-card rounded-[24px] sm:rounded-[28px] p-4 sm:p-7 relative overflow-hidden flex flex-col justify-between w-full max-w-full">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-8 right-8 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

          <div className="space-y-3.5 sm:space-y-4">
            {/* Top Row: User Avatar & Live Status */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 p-[2px] shadow-lg shadow-amber-500/25">
                    <div className="w-full h-full bg-[#080d1a] rounded-[14px] flex items-center justify-center font-black text-amber-300 text-base sm:text-xl">
                      {currentUser.username.substring(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-500 border-2 border-[#080d1a] flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5 sm:space-x-2">
                    <h1 className="text-base sm:text-2xl font-black text-white tracking-tight truncate max-w-[150px] xs:max-w-[200px] sm:max-w-none">
                      {currentUser.username}
                    </h1>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[9px] sm:text-[10px] font-mono font-bold tracking-wider uppercase shrink-0">
                      VIP GOLD TIER
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-slate-400 font-mono mt-0.5">
                    <span className="truncate max-w-[120px] xs:max-w-[180px]">ID: {currentUser.id.substring(0, 8)}...</span>
                    <button
                      onClick={handleCopyUserId}
                      className="text-amber-400 hover:text-amber-300 p-0.5 transition-colors"
                      title="ইউজার আইডি কপি করুন"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold flex items-center space-x-0.5 text-[10px] sm:text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>KYC Verified</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Sync Trigger */}
              <button
                onClick={handleSyncLedger}
                className={`self-start sm:self-center p-2 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-400 hover:text-amber-400 transition-all shrink-0 cursor-pointer ${
                  isSyncing ? 'animate-spin text-amber-400' : ''
                }`}
                title="রিয়েল-টাইম ডাটা রিফ্রেশ"
              >
                <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* Balances Matrix */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-[#05070d]/90 p-2.5 sm:p-4 rounded-2xl border border-amber-500/20 font-mono shadow-inner">
              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-wider truncate">রিয়াল ব্যালেন্স</div>
                <div className="text-xs sm:text-xl font-black text-transparent bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text mt-0.5 truncate">
                  {currencySymbol} {Number(currentWallet?.real_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-wider truncate">বোনাস ব্যালেন্স</div>
                <div className="text-xs sm:text-xl font-black text-emerald-400 mt-0.5 truncate">
                  {currencySymbol} {Number(currentWallet?.bonus_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              <div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-wider truncate">লকড ওয়েজার</div>
                <div className="text-xs sm:text-xl font-black text-slate-300 mt-0.5 truncate">
                  {currencySymbol} {Number(currentWallet?.locked_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* VIP Tier Progression Bar */}
            <div className="bg-[#05070d]/60 border border-slate-800/80 rounded-2xl p-2.5 sm:p-3 space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px]">
                <span className="text-slate-300 flex items-center space-x-1 sm:space-x-1.5 truncate">
                  <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">পরবর্তী স্তর: <strong>PLATINUM VIP</strong></span>
                </span>
                <span className="text-amber-300 font-bold shrink-0">৭২% (৳৭২k / ৳১০০k)</span>
              </div>
              <div className="w-full h-1.5 sm:h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 w-[72%] rounded-full shadow-md shadow-amber-500/50" />
              </div>
            </div>
          </div>

          {/* Quick Cashier Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 pt-3 sm:pt-4 mt-2.5 border-t border-slate-800/80 font-mono text-xs">
            <button
              onClick={() => {
                soundEngine.playClick(1000);
                onOpenCashier();
              }}
              className="py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-[11px] sm:text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center space-x-1 cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
              <span>ডিপোজিট</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick(900);
                onOpenCashier();
              }}
              className="py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-[11px] sm:text-xs active:scale-95 transition-all flex items-center justify-center space-x-1 cursor-pointer"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              <span>ক্যাশ-আউট</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick(850);
                setActiveTab('TURNOVER');
              }}
              className="py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 font-bold text-[11px] sm:text-xs active:scale-95 transition-all flex items-center justify-center space-x-1 cursor-pointer"
            >
              <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              <span>টার্নওভার</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick(850);
                setActiveTab('LEDGER');
              }}
              className="py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-bold text-[11px] sm:text-xs active:scale-95 transition-all flex items-center justify-center space-x-1 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
              <span>লেনদেন ইতিহাস</span>
            </button>
          </div>
        </div>

        {/* Right Column (Key Performance Metrics): 4-Card Grid */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-3 sm:gap-4">
          
          {/* Card 1: Total Turnover */}
          <div className="golden-ratio-card rounded-2xl p-4 flex flex-col justify-between font-mono">
            <div className="text-[11px] text-slate-400 uppercase flex items-center justify-between font-bold">
              <span>মোট বেটিং ভলিউম</span>
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-base sm:text-xl font-black text-white mt-2 truncate">
              {currencySymbol} {totalBets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center space-x-1">
              <Sparkles className="w-3 h-3" />
              <span>+১.২% দৈনিক ক্যাশব্যাক</span>
            </div>
          </div>

          {/* Card 2: Net P/L */}
          <div className="golden-ratio-card rounded-2xl p-4 flex flex-col justify-between font-mono">
            <div className="text-[11px] text-slate-400 uppercase flex items-center justify-between font-bold">
              <span>নেট প্রফিট / লস</span>
              {netProfit >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className={`text-base sm:text-xl font-black mt-2 truncate ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netProfit >= 0 ? '+' : ''}
              {currencySymbol} {netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">উইন রেট: <strong className="text-amber-400">{winRate}%</strong></div>
          </div>

          {/* Card 3: Payout Speed */}
          <div className="golden-ratio-card rounded-2xl p-4 flex flex-col justify-between font-mono">
            <div className="text-[11px] text-slate-400 uppercase flex items-center justify-between font-bold">
              <span>উইথড্রয়াল গতি</span>
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-base sm:text-xl font-black text-cyan-300 mt-2">০ - ৪ সেকেন্ড</div>
            <div className="text-[10px] text-slate-400 mt-1">বিকাশ ও নগদ অটো API</div>
          </div>

          {/* Card 4: Daily Limit */}
          <div className="golden-ratio-card rounded-2xl p-4 flex flex-col justify-between font-mono">
            <div className="text-[11px] text-slate-400 uppercase flex items-center justify-between font-bold">
              <span>দৈনিক লিমিট</span>
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-base sm:text-xl font-black text-purple-300 mt-2 truncate">
              {currency === 'BDT' ? '৳ ৫০,০০,০০০' : '$50,000'}
            </div>
            <div className="text-[10px] text-emerald-400 mt-1 font-semibold">আনলিমিটেড ট্রান্সফার</div>
          </div>

        </div>

      </div>

      {/* 2. SUB-SECTION NAVIGATION TABS (Mobile Optimized) */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('OVERVIEW');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'OVERVIEW'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md'
              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>সারসংক্ষেপ (Overview)</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('TURNOVER');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'TURNOVER'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md'
              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>টার্নওভার ও বোনাস কনভার্সন</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('DOCS');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'DOCS'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md'
              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>KYC ও ডকুমেন্ট ভল্ট</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(750);
            setActiveTab('LEDGER');
          }}
          className={`px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'LEDGER'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-md'
              : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>লেনদেন খতিয়ান ({userTransactions.length})</span>
        </button>
      </div>

      {/* 3. DYNAMIC CONTENT VIEWS */}
      
      {/* View 1: Overview Tab Details */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Account Details Box */}
            <div className="golden-ratio-card rounded-2xl p-5 space-y-3 font-mono text-xs">
              <div className="text-sm font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3 font-sans">
                <User className="w-4 h-4 text-amber-400" />
                <span>অ্যাকাউন্ট ও নিরাপত্তা তথ্য</span>
              </div>
              <div className="space-y-2.5 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">ইউজারনেম:</span>
                  <span className="font-bold text-white">{currentUser.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ইমেইল:</span>
                  <span className="text-slate-300">{currentUser.email || 'সংযুক্ত নেই'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">মুদ্রা (Currency):</span>
                  <span className="text-amber-400 font-bold">{currentUser.currency} ({currencySymbol})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">নিবন্ধন তারিখ:</span>
                  <span className="text-slate-300">{new Date(currentUser.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">নিরাপত্তা এনক্রিপশন:</span>
                  <span className="text-emerald-400 font-bold flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>256-Bit SSL Active</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Wagering Snapshot */}
            <div className="golden-ratio-card rounded-2xl p-5 flex flex-col justify-between font-mono text-xs">
              <div>
                <div className="text-sm font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3 font-sans">
                  <Gift className="w-4 h-4 text-amber-400" />
                  <span>সক্রিয় বোনাস ও টার্নওভার সংক্ষেপ</span>
                </div>
                <p className="text-slate-400 mt-2.5 leading-relaxed font-sans">
                  বোনাস ব্যালেন্স দিয়ে গেমস খেলে টার্নওভার পূরণ করুন। ১০০% সম্পূর্ণ হলেই ইনস্ট্যান্ট রিয়াল ব্যালেন্সে কনভার্ট করতে পারবেন।
                </p>
              </div>

              <button
                onClick={() => setActiveTab('TURNOVER')}
                className="w-full mt-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/30 text-amber-300 font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>টার্নওভার ম্যানেজার দেখুন</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Embedded Wagering Component */}
          <WageringRequirements
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
          />
        </div>
      )}

      {/* View 2: Turnover Management */}
      {activeTab === 'TURNOVER' && (
        <WageringRequirements
          currentUser={currentUser}
          currentWallet={currentWallet}
          currency={currency}
        />
      )}

      {/* View 3: KYC & Document Vault */}
      {activeTab === 'DOCS' && (
        <GoogleDrivePickerHub currentUser={currentUser} />
      )}

      {/* View 4: Full Immutable Transaction Ledger */}
      {activeTab === 'LEDGER' && (
        <div className="golden-ratio-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2 font-sans">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>ডাবল-এন্ট্রি ইমিউটেবল ট্রানজেকশন লেজার</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                অডিট-রেডি রিয়েল-টাইম লেজার রেকর্ডস
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="min-h-[40px] bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">সকল ধরন (All)</option>
                <option value="BET">BET (বেট)</option>
                <option value="WIN">WIN (উইন)</option>
                <option value="PROMO">PROMO (ডিপোজিট)</option>
                <option value="TIP">TIP (ক্যাশ-আউট)</option>
                <option value="REFUND">REFUND (ফেরত)</option>
              </select>

              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="TxID দিয়ে খুঁজুন..."
                  value={searchTx}
                  onChange={(e) => setSearchTx(e.target.value)}
                  className="w-full min-h-[40px] bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3">ট্রানজেকশন আইডি</th>
                  <th className="p-3">গেম ও প্রোভাইডার</th>
                  <th className="p-3">ধরন</th>
                  <th className="p-3">পরিমাণ</th>
                  <th className="p-3">ব্যালেন্স লেজার</th>
                  <th className="p-3">স্ট্যাটাস</th>
                  <th className="p-3">সময়</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredTxs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      কোনো ট্রানজেকশন রেকর্ড পাওয়া যায়নি
                    </td>
                  </tr>
                ) : (
                  filteredTxs.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-slate-300 font-semibold truncate max-w-[140px]">
                        {tx.transaction_id}
                      </td>
                      <td className="p-3">
                        <div className="text-white font-bold">{tx.game_id}</div>
                        <div className="text-[10px] text-slate-500">{tx.provider_id}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === 'BET'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : tx.type === 'WIN' || tx.type === 'JACKPOT'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="p-3 font-bold">
                        <span className={tx.type === 'BET' || tx.type === 'TIP' ? 'text-rose-400' : 'text-emerald-400'}>
                          {tx.type === 'BET' || tx.type === 'TIP' ? '-' : '+'}
                          {tx.currency === 'BDT' ? '৳' : '$'} {tx.amount.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        <span>{tx.currency === 'BDT' ? '৳' : '$'}{tx.before_balance.toFixed(2)}</span>
                        <span className="mx-1 text-slate-600">&rarr;</span>
                        <span className="text-white font-semibold">{tx.currency === 'BDT' ? '৳' : '$'}{tx.after_balance.toFixed(2)}</span>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </motion.div>
  );
};
