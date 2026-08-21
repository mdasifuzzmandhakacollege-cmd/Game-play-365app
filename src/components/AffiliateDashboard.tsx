/**
 * @file AffiliateDashboard.tsx
 * @description Multi-Tier MLM Affiliate & Referral Engine for Playall 365.
 * Structured with harmonious visual proportion, balanced hierarchy, responsive mobile layout,
 * visual Recharts 30-day analytics, 3-tier commission breakdown, and instant wallet claim.
 */

import React, { useState, useMemo } from 'react';
import {
  Share2,
  Users,
  TrendingUp,
  DollarSign,
  Gift,
  Copy,
  Check,
  Award,
  ArrowRight,
  ShieldCheck,
  Layers,
  Sparkles,
  Zap,
  ArrowUpRight,
  Calendar,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  UserPlus,
  Coins,
  ChevronRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { notificationService } from '../services/notificationService';
import { soundEngine } from '../services/soundEngine';
import { motion, AnimatePresence } from 'framer-motion';

interface AffiliateDashboardProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onCommissionClaimed: () => void;
}

// Generate 30 days of realistic affiliate growth and commission data
const generate30DayAffiliateData = (currency: 'BDT' | 'USD') => {
  const data = [];
  const now = new Date();
  const rateMultiplier = currency === 'BDT' ? 1 : 1 / 120;

  let cumulativeMembers = 62;

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Daily new registrations
    const newTier1 = Math.floor(Math.random() * 2) + (i < 10 ? 1 : 0);
    const newTier2 = Math.floor(Math.random() * 3) + (i < 15 ? 1 : 0);
    const newTier3 = Math.floor(Math.random() * 4) + 1;
    const dailyNew = newTier1 + newTier2 + newTier3;
    cumulativeMembers += dailyNew;

    // Daily turnover volume (growing curve over 30 days)
    const baseVolume = 110000 + (30 - i) * 6500 + (Math.random() * 35000 - 15000);
    const tier1Volume = baseVolume * 0.45;
    const tier2Volume = baseVolume * 0.35;
    const tier3Volume = baseVolume * 0.20;

    // Commission calculations (Tier 1: 0.50%, Tier 2: 0.20%, Tier 3: 0.10%)
    const commissionTier1 = Math.round(tier1Volume * 0.005 * rateMultiplier);
    const commissionTier2 = Math.round(tier2Volume * 0.002 * rateMultiplier);
    const commissionTier3 = Math.round(tier3Volume * 0.001 * rateMultiplier);
    const totalCommission = commissionTier1 + commissionTier2 + commissionTier3;

    data.push({
      date: dayLabel,
      fullDate: date.toISOString().split('T')[0],
      totalCommission,
      commissionTier1,
      commissionTier2,
      commissionTier3,
      turnover: Math.round(baseVolume * rateMultiplier),
      cumulativeMembers,
      newMembers: dailyNew,
      tier1New: newTier1,
      tier2New: newTier2,
      tier3New: newTier3
    });
  }

  return data;
};

export const AffiliateDashboard: React.FC<AffiliateDashboardProps> = ({
  currentUser,
  currentWallet,
  currency,
  onCommissionClaimed
}) => {
  const [unclaimedAmount, setUnclaimedAmount] = useState<number>(() => {
    return currentUser.currency === 'BDT' ? 8450 : 70.4;
  });
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Timeframe and Chart view modes
  const [timeframe, setTimeframe] = useState<'7D' | '14D' | '30D'>('30D');
  const [chartType, setChartType] = useState<'AREA' | 'BAR' | 'TIERS'>('AREA');

  const referralLink = `https://playall365.vip/register?ref=${currentUser.id.substring(0, 8)}`;

  // Generate 30 days dataset once or on currency change
  const rawChartData = useMemo(() => generate30DayAffiliateData(currency), [currency]);

  // Filtered dataset according to timeframe
  const chartData = useMemo(() => {
    if (timeframe === '7D') return rawChartData.slice(-7);
    if (timeframe === '14D') return rawChartData.slice(-14);
    return rawChartData;
  }, [rawChartData, timeframe]);

  // Aggregate Metrics over selected timeframe
  const totalCommissionTimeframe = useMemo(
    () => chartData.reduce((sum, d) => sum + d.totalCommission, 0),
    [chartData]
  );
  const totalTurnoverTimeframe = useMemo(
    () => chartData.reduce((sum, d) => sum + d.turnover, 0),
    [chartData]
  );
  const totalNewMembersTimeframe = useMemo(
    () => chartData.reduce((sum, d) => sum + d.newMembers, 0),
    [chartData]
  );
  const currentNetworkCount = rawChartData[rawChartData.length - 1]?.cumulativeMembers || 144;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    soundEngine.playClick(950);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleClaimCommission = () => {
    if (unclaimedAmount <= 0) return;
    setClaiming(true);
    soundEngine.playClick(900);

    setTimeout(() => {
      seamlessEngine.topUpWallet(currentUser.id, currentUser.currency, unclaimedAmount);

      notificationService.pushNotification(currentUser.id, {
        userId: currentUser.id,
        title: '💸 এফিলিয়েট কমিশন ওয়ালেটে ট্রান্সফার সফল!',
        message: `আপনার রেফারেল নেটওয়ার্ক থেকে ${currentUser.currency === 'BDT' ? '৳' : '$'}${unclaimedAmount.toLocaleString()} মূল ওয়ালেটে সফলভাবে যোগ হয়েছে।`,
        type: 'AFFILIATE_COMMISSION',
        amount: unclaimedAmount,
        currency: currentUser.currency as 'BDT' | 'USD',
        isRead: false,
        actionTab: 'cashier'
      });

      soundEngine.playWinChime();
      setToast(
        `সফলভাবে ${currentUser.currency === 'BDT' ? '৳' : '$'}${unclaimedAmount.toLocaleString()} কমিশন ওয়ালেটে ট্রান্সফার করা হয়েছে!`
      );
      setUnclaimedAmount(0);
      setClaiming(false);
      onCommissionClaimed();
      setTimeout(() => setToast(null), 4000);
    }, 800);
  };

  // Mock MLM Hierarchy Tree members
  const networkMembers = [
    { name: 'rahim_dhaka_01', tier: 'Tier 1 (Direct)', validBet: 450000, commission: 2250, rate: '0.50%', active: true },
    { name: 'tariq_ctg_player', tier: 'Tier 1 (Direct)', validBet: 180000, commission: 900, rate: '0.50%', active: true },
    { name: 'sohel_sylhet_vip', tier: 'Tier 2 (Subordinate)', validBet: 120000, commission: 240, rate: '0.20%', active: true },
    { name: 'kamrul_rajshahi', tier: 'Tier 2 (Subordinate)', validBet: 85000, commission: 170, rate: '0.20%', active: true },
    { name: 'munna_khulna', tier: 'Tier 3 (Subordinate)', validBet: 60000, commission: 60, rate: '0.10%', active: false },
  ];

  const symbol = currency === 'BDT' ? '৳' : '$';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-28 font-sans text-slate-100 selection:bg-amber-400 selection:text-slate-950"
    >
      {/* 1. MASTER BANNER (Harmonious 61.8% / 38.2% Proportions) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left Column (61.8% Program Overview & Referral Link) */}
        <div className="lg:col-span-7 golden-ratio-card rounded-[28px] p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-amber-400/20 to-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-0 left-8 right-8 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

          <div className="space-y-3">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold uppercase">
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Multi-Tier MLM Affiliate Engine</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              আজীবন কমিশন প্রোগ্রাম (Up to 0.80% Turnover)
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
              আপনার রেফারেল লিংকের মাধ্যমে যোগদানকারী সকল মেম্বারের গেম ট্রানজ্যাকশন থেকে সরাসরি স্বয়ংক্রিয় লাইফটাইম কমিশন পান।
            </p>

            {/* Referral Link Box */}
            <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs font-mono">
              <div className="flex items-center space-x-2 text-slate-300 truncate w-full">
                <span className="text-amber-400 font-bold shrink-0">রেফারেল লিংক:</span>
                <span className="text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 truncate flex-1 select-all text-[11px]">
                  {referralLink}
                </span>
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full sm:w-auto min-h-[38px] px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black flex items-center justify-center space-x-1.5 shrink-0 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-950 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4 pt-4 mt-2 border-t border-slate-800/80 text-xs font-mono text-slate-400">
            <span className="flex items-center space-x-1 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>রিয়েল-টাইম অটো সেটেলমেন্ট</span>
            </span>
            <span>•</span>
            <span>০% ডিডাকশন ফি</span>
          </div>
        </div>

        {/* Right Column (38.2% Unclaimed Commission Snapshot) */}
        <div className="lg:col-span-5 golden-ratio-card rounded-[28px] p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-[#0c1220] to-[#05070d]">
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs text-slate-400 uppercase font-bold">ক্লেইমেবল কমিশন (Unclaimed)</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                READY TO WITHDRAW
              </span>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
              <div className="text-[11px] text-slate-400">মোট ব্যালেন্স:</div>
              <div className="text-3xl sm:text-4xl font-black text-transparent bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 bg-clip-text mt-1">
                {currentUser.currency === 'BDT' ? `৳${unclaimedAmount.toLocaleString()}` : `$${unclaimedAmount.toFixed(2)}`}
              </div>
              <div className="text-[10px] text-emerald-400 mt-1 font-semibold">
                মূল ওয়ালেটে সরাসরি জমা হবে কোনো শর্ত ছাড়াই
              </div>
            </div>
          </div>

          <button
            onClick={handleClaimCommission}
            disabled={claiming || unclaimedAmount <= 0}
            className="w-full min-h-[46px] mt-4 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs font-mono shadow-lg shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{claiming ? 'ট্রান্সফার হচ্ছে...' : 'ওয়ালেটে ক্লেইম করুন'}</span>
          </button>
        </div>

      </div>

      {toast && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-mono flex items-center space-x-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* 2. 3-TIER COMMISSION CARDS (Proportional Balance) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tier 1 */}
        <div className="golden-ratio-card rounded-2xl p-5 space-y-2 font-mono flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 uppercase font-bold">Tier 1 (Direct)</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30">
              0.50%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">14 মেম্বার</div>
            <div className="text-xs text-amber-300 mt-0.5">মোট টার্নওভার: ৳৬,৩০,০০০</div>
          </div>
          <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
            সরাসরি আপনার রেফারেল লিংকে রেজিস্টার্ড প্লেয়ারদের প্রতি স্পিনের ইনস্ট্যান্ট কমিশন।
          </p>
        </div>

        {/* Tier 2 */}
        <div className="golden-ratio-card rounded-2xl p-5 space-y-2 font-mono flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 uppercase font-bold">Tier 2 (Subordinates)</span>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-black border border-cyan-500/30">
              0.20%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">42 মেম্বার</div>
            <div className="text-xs text-cyan-300 mt-0.5">মোট টার্নওভার: ৳১৮,৫০,০০০</div>
          </div>
          <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
            Tier 1 মেম্বারদের আমন্ত্রিত সেকেন্ড-লেভেল প্লেয়ারদের টার্নওভার কমিশন।
          </p>
        </div>

        {/* Tier 3 */}
        <div className="golden-ratio-card rounded-2xl p-5 space-y-2 font-mono flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 uppercase font-bold">Tier 3 (Network)</span>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-black border border-purple-500/30">
              0.10%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">88 মেম্বার</div>
            <div className="text-xs text-purple-300 mt-0.5">মোট টার্নওভার: ৳৩৮,০০,০০০</div>
          </div>
          <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
            ৩য় লেয়ারের সকল সক্রিয় প্লেয়ারদের সম্মিলিত গেমপ্লে থেকে প্যাসিভ ইনকাম।
          </p>
        </div>
      </div>

      {/* 3. VISUAL RECHARTS 30-DAY ANALYTICS */}
      <div className="golden-ratio-card rounded-3xl p-5 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white font-sans">
                ৩০-দিনের পারফরম্যান্স অ্যানালিটিক্স
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                নেটওয়ার্ক গ্রোথ, ডেইলি টার্নওভার ও কমিশন ট্রেন্ডস
              </p>
            </div>
          </div>

          {/* Controls Toolbar */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {/* Timeframe Buttons */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['7D', '14D', '30D'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => {
                    soundEngine.playClick(700);
                    setTimeframe(tf);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    timeframe === tf ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Chart Type Selector */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setChartType('AREA')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'AREA' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="Area Chart"
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('BAR')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'BAR' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="Bar Chart"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('TIERS')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'TIERS' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="Tier Breakdown Chart"
              >
                <PieChartIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Snapshot Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase">মোট অর্জিত কমিশন</span>
            <div className="text-base sm:text-lg font-black text-amber-300 mt-0.5 truncate">
              {symbol}{totalCommissionTimeframe.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase">মোট টার্নওভার ভলিউম</span>
            <div className="text-base sm:text-lg font-black text-cyan-300 mt-0.5 truncate">
              {symbol}{totalTurnoverTimeframe.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase">নতুন রেজিস্টার্ড</span>
            <div className="text-base sm:text-lg font-black text-emerald-300 mt-0.5 truncate">
              +{totalNewMembersTimeframe} জন
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase">বর্তমান নেটওয়ার্ক</span>
            <div className="text-base sm:text-lg font-black text-purple-300 mt-0.5 truncate">
              {currentNetworkCount} জন মেম্বার
            </div>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="h-64 sm:h-72 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'AREA' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '12px' }}
                />
                <Area type="monotone" dataKey="totalCommission" stroke="#f59e0b" fillOpacity={1} fill="url(#commGrad)" name="কমিশন" />
              </AreaChart>
            ) : chartType === 'BAR' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '12px' }}
                />
                <Bar dataKey="totalCommission" fill="#f59e0b" radius={[4, 4, 0, 0]} name="কমিশন" />
              </BarChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="commissionTier1" name="Tier 1 (0.50%)" fill="#f59e0b" stackId="tiers" />
                <Bar dataKey="commissionTier2" name="Tier 2 (0.20%)" fill="#06b6d4" stackId="tiers" />
                <Bar dataKey="commissionTier3" name="Tier 3 (0.10%)" fill="#a855f7" stackId="tiers" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. NETWORK DOWNLINE TREE TABLE */}
      <div className="golden-ratio-card rounded-3xl p-5 sm:p-7 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2 font-sans">
              <Users className="w-4 h-4 text-amber-400" />
              <span>সাবঅর্ডিনেট মেম্বার ও কমিশন লেজার</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              রিয়েল-টাইমে সাবঅর্ডিনেটদের ভ্যালিড বেট টার্নওভার ও অর্জিত কমিশন হিস্টোরি।
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Active Network
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-3">ইউজারনেম</th>
                <th className="p-3">টিয়ার লেভেল</th>
                <th className="p-3">ভ্যালিড বেট টার্নওভার</th>
                <th className="p-3">কমিশন রেট</th>
                <th className="p-3">অর্জিত কমিশন</th>
                <th className="p-3">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {networkMembers.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 text-white font-bold">{m.name}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {m.tier}
                    </span>
                  </td>
                  <td className="p-3 text-amber-300 font-bold">
                    ৳{m.validBet.toLocaleString()}
                  </td>
                  <td className="p-3 text-cyan-400">{m.rate}</td>
                  <td className="p-3 text-emerald-400 font-black">
                    +৳{m.commission.toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      m.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {m.active ? 'ACTIVE' : 'IDLE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};
