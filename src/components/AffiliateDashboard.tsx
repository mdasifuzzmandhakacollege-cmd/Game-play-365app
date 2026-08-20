/**
 * @file AffiliateDashboard.tsx
 * @description Multi-Tier MLM Affiliate & Referral Engine for Playall 365.
 * Features a visual chart using Recharts showing 30-day referral network growth,
 * daily commission trends, tier breakdown analytics, and real-time wallet claiming.
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
  Coins
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

// Custom Luxury Dark Tooltip for Recharts
const CustomChartTooltip = ({ active, payload, label, currency }: any) => {
  if (active && payload && payload.length) {
    const symbol = currency === 'BDT' ? '৳' : '$';
    return (
      <div className="bg-[#0b0f19] border border-amber-500/40 p-3.5 rounded-2xl shadow-2xl font-mono text-xs space-y-2 backdrop-blur-md">
        <div className="font-bold text-amber-400 border-b border-slate-800 pb-1 flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[10px] text-slate-400 font-normal">30-Day Ledger</span>
        </div>
        <div className="space-y-1">
          {payload.map((item: any, idx: number) => {
            const isAmount = item.dataKey.toLowerCase().includes('commission') || item.dataKey === 'turnover';
            const valueStr = isAmount
              ? `${symbol} ${Number(item.value).toLocaleString()}`
              : `${Number(item.value).toLocaleString()} মেম্বার`;

            return (
              <div key={idx} className="flex items-center justify-between space-x-4 text-[11px]">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
                  <span className="text-slate-300">{item.name}:</span>
                </div>
                <span className="font-black text-white">{valueStr}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export const AffiliateDashboard: React.FC<AffiliateDashboardProps> = ({
  currentUser,
  currentWallet,
  currency,
  onCommissionClaimed
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [unclaimedAmount, setUnclaimedAmount] = useState<number>(
    currentUser.currency === 'BDT' ? 3450.0 : 35.0
  );
  const [toast, setToast] = useState<string | null>(null);

  // Chart state controls
  const [chartMetric, setChartMetric] = useState<'commission' | 'network' | 'tiers'>('commission');
  const [chartTimeframe, setChartTimeframe] = useState<'30D' | '14D' | '7D'>('30D');

  const referralCode = `GP365_${currentUser.username.toUpperCase()}`;
  const referralLink = `https://playall365.com/register?ref=${referralCode}`;

  // 30-Day Generated Analytics Data
  const rawChartData = useMemo(() => generate30DayAffiliateData(currency), [currency]);

  const chartData = useMemo(() => {
    if (chartTimeframe === '7D') return rawChartData.slice(rawChartData.length - 7);
    if (chartTimeframe === '14D') return rawChartData.slice(rawChartData.length - 14);
    return rawChartData;
  }, [rawChartData, chartTimeframe]);

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
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleClaimCommission = () => {
    if (unclaimedAmount <= 0) return;
    setClaiming(true);

    setTimeout(() => {
      // Top up real balance in wallet
      seamlessEngine.topUpWallet(currentUser.id, currentUser.currency, unclaimedAmount);

      // Trigger real-time notification
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
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 font-mono">
      {/* 1. Top Banner: Multi-Tier Referral Overview */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-amber-500/20 via-[#0a0e17] to-cyan-950/40 border border-amber-500/30 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase mb-2">
              <Share2 className="w-3.5 h-3.5" />
              <span>Multi-Tier MLM Affiliate Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-sans">
              আজীবন কমিশন আর্নিং প্রোগ্রাম (Up to 0.80% Valid Bet Turnover)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-sans mt-1">
              আপনার রেফারেল লিংকের মাধ্যমে যোগদানকারী সকল মেম্বারের গেম ট্রানজ্যাকশন থেকে সরাসরি স্বয়ংক্রিয় কমিশন পান।
            </p>
          </div>

          {/* Unclaimed Commission Card */}
          <div className="bg-slate-950/90 border border-amber-500/50 p-4 rounded-2xl text-right shrink-0 shadow-xl">
            <div className="text-[11px] text-slate-400 uppercase">ক্লেইমেবল কমিশন (Unclaimed)</div>
            <div className="text-2xl font-black text-amber-300 mt-1">
              {currentUser.currency === 'BDT' ? `৳${unclaimedAmount.toLocaleString()}` : `$${unclaimedAmount.toFixed(2)}`}
            </div>
            <button
              onClick={handleClaimCommission}
              disabled={claiming || unclaimedAmount <= 0}
              className="mt-3 w-full px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center space-x-1 cursor-pointer"
            >
              <span>{claiming ? 'ট্রান্সফার হচ্ছে...' : 'ওয়ালেটে ক্লেইম করুন'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Shareable Link Box */}
        <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-300 truncate w-full">
            <span className="text-amber-400 font-bold shrink-0">আপনার রেফারেল লিংক:</span>
            <span className="text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 truncate flex-1 select-all">
              {referralLink}
            </span>
          </div>

          <button
            onClick={handleCopyLink}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 flex items-center space-x-1.5 shrink-0 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'কপি হয়েছে!' : 'লিংক কপি করুন'}</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center space-x-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* 2. Visual Recharts 30-Day Growth & Commission Analytics Section */}
      <div className="bg-[#090d16] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Chart Header & Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black text-white font-sans uppercase">
                  রেফারেল নেটওয়ার্ক গ্রোথ ও কমিশন ট্রেন্ড (Growth Analytics)
                </h2>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  Live 30D Recharts
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                গত ৩০ দিনের রেফারেল বৃদ্ধির গ্রাফ এবং টিয়ার ১, ২ ও ৩ ভিত্তিক মোট কমিশন উপার্জনের চার্ট।
              </p>
            </div>
          </div>

          {/* View Modifiers: Metric Switcher & Timeframe Tabs */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Metric Mode Switcher */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setChartMetric('commission')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all ${
                  chartMetric === 'commission'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>কমিশন ট্রেন্ড</span>
              </button>
              <button
                onClick={() => setChartMetric('network')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all ${
                  chartMetric === 'network'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>নেটওয়ার্ক গ্রোথ</span>
              </button>
              <button
                onClick={() => setChartMetric('tiers')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition-all ${
                  chartMetric === 'tiers'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>টিয়ার ব্রেকডাউন</span>
              </button>
            </div>

            {/* Timeframe Presets */}
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(['7D', '14D', '30D'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setChartTimeframe(tf)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                    chartTimeframe === tf
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Summary Stat Cards for Selected Timeframe */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 space-y-1">
            <div className="text-[10px] text-amber-400 uppercase font-bold flex items-center gap-1">
              <Coins className="w-3.5 h-3.5" />
              <span>{chartTimeframe} মোট কমিশন</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-white">
              {symbol} {totalCommissionTimeframe.toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>+24.6% vs previous period</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl p-4 space-y-1">
            <div className="text-[10px] text-cyan-400 uppercase font-bold flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>সক্রিয় রেফারেল নেটওয়ার্ক</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-white">
              {currentNetworkCount} মেম্বার
            </div>
            <div className="text-[10px] text-cyan-300">
              +{totalNewMembersTimeframe} নতুন মেম্বার যোগ হয়েছে ({chartTimeframe})
            </div>
          </div>

          <div className="bg-slate-950/80 border border-purple-500/30 rounded-2xl p-4 space-y-1">
            <div className="text-[10px] text-purple-400 uppercase font-bold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              <span>{chartTimeframe} মোট টার্নওভার</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-white">
              {symbol} {totalTurnoverTimeframe.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400">
              ভ্যালিড বেট টার্নওভার ভলিউম
            </div>
          </div>

          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 space-y-1">
            <div className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1">
              <Award className="w-3.5 h-3.5" />
              <span>গড় কমিশন / মেম্বার</span>
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-300">
              {symbol} {Math.round(totalCommissionTimeframe / Math.max(1, currentNetworkCount)).toLocaleString()}
            </div>
            <div className="text-[10px] text-emerald-400">
              উচ্চ ভলিউম প্লেয়ার রিটেনশন
            </div>
          </div>
        </div>

        {/* The Main Recharts Visual Display */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartMetric === 'commission' ? (
              // 1. Commission Growth Area Chart
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="commGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="turnoverGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(val) => `${symbol}${val}`} />
                <Tooltip content={<CustomChartTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="totalCommission"
                  name="দৈনিক মোট কমিশন (Total Commission)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#commGradient)"
                />
              </AreaChart>
            ) : chartMetric === 'network' ? (
              // 2. Network Growth Line & Bar Chart
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="memberGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomChartTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="cumulativeMembers"
                  name="মোট নেটওয়ার্ক মেম্বার (Total Network)"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#memberGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="newMembers"
                  name="দৈনিক নতুন মেম্বার (Daily New)"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#10b981' }}
                />
              </AreaChart>
            ) : (
              // 3. Multi-Tier Commission Breakdown Stacked Bar Chart
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(val) => `${symbol}${val}`} />
                <Tooltip content={<CustomChartTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar
                  dataKey="commissionTier1"
                  name="Tier 1 (0.50% Direct)"
                  fill="#f59e0b"
                  stackId="tiers"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="commissionTier2"
                  name="Tier 2 (0.20% Subordinate)"
                  fill="#06b6d4"
                  stackId="tiers"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="commissionTier3"
                  name="Tier 3 (0.10% Network)"
                  fill="#a855f7"
                  stackId="tiers"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. 3 Tier Commission Structure Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-amber-500/40 p-5 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-bold">Tier 1 (Direct Referrals)</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black">
              0.50%
            </span>
          </div>
          <div className="text-2xl font-black text-white mt-3">14 মেম্বার</div>
          <div className="text-xs text-emerald-400 mt-1">মোট টার্নওভার: ৳৬,৩০,০০০</div>
          <div className="text-[10px] text-slate-400 mt-2 font-sans">সরাসরি আপনার লিংকে রেজিস্টার্ড প্লেয়ারদের প্রতি স্পিনের কমিশন।</div>
        </div>

        <div className="bg-slate-900/90 border border-cyan-500/40 p-5 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-bold">Tier 2 (Subordinates)</span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-black">
              0.20%
            </span>
          </div>
          <div className="text-2xl font-black text-white mt-3">42 মেম্বার</div>
          <div className="text-xs text-emerald-400 mt-1">মোট টার্নওভার: ৳১৮,৫০,০০০</div>
          <div className="text-[10px] text-slate-400 mt-2 font-sans">Tier 1 মেম্বারদের রেফারকৃত প্লেয়ারদের টার্নওভার কমিশন।</div>
        </div>

        <div className="bg-slate-900/90 border border-purple-500/40 p-5 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase font-bold">Tier 3 (Network)</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-black">
              0.10%
            </span>
          </div>
          <div className="text-2xl font-black text-white mt-3">88 মেম্বার</div>
          <div className="text-xs text-emerald-400 mt-1">মোট টার্নওভার: ৳৩৮,০০,০০০</div>
          <div className="text-[10px] text-slate-400 mt-2 font-sans">৩য় লেয়ারের সকল সক্রিয় প্লেয়ারদের টার্নওভার কমিশন।</div>
        </div>
      </div>

      {/* 4. Network Downline Tree Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>সাবঅর্ডিনেট মেম্বার ও কমিশন লেজার</span>
            </h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              রিয়েল-টাইমে সাবঅর্ডিনেটদের ভ্যালিড বেট টার্নওভার ও অর্জিত কমিশন হিস্টোরি।
            </p>
          </div>
          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Active Upline Network
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
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
            <tbody className="divide-y divide-slate-800">
              {networkMembers.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
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
    </div>
  );
};
