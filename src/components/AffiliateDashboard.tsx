/**
 * @file AffiliateDashboard.tsx
 * @description Multi-Tier MLM Affiliate & Real-Time Referral Engine for Playall 365.
 * Structured with harmonious visual proportion, balanced hierarchy, responsive mobile layout,
 * visual Recharts 30-day analytics, 3-tier commission breakdown, dynamic real referral link generator,
 * 1-click WhatsApp/Telegram/Facebook sharing, and instant real-time wallet claim.
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Send,
  Facebook,
  QrCode
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
import { referralService, ReferralRecord, AffiliateStats } from '../services/referralService';
import { RealtimeAffiliateActivityWidget } from './RealtimeAffiliateActivityWidget';
import { AffiliateGeoTrafficScatter } from './AffiliateGeoTrafficScatter';
import { AgentTree } from './AgentTree';
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
  const [stats, setStats] = useState<AffiliateStats>(() =>
    referralService.getReferralsForUser(currentUser.id, currentUser.username, currency)
  );

  const [unclaimedAmount, setUnclaimedAmount] = useState<number>(stats.unclaimedCommission);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Timeframe and Chart view modes
  const [timeframe, setTimeframe] = useState<'7D' | '14D' | '30D'>('30D');
  const [chartType, setChartType] = useState<'AREA' | 'BAR' | 'TIERS'>('AREA');

  // Real, dynamic referral link computed from window origin
  const dynamicReferralLink = useMemo(() => {
    return referralService.generateReferralLink(currentUser.username);
  }, [currentUser.username]);

  const shareLinks = useMemo(() => {
    return referralService.getShareLinks(dynamicReferralLink, currentUser.username);
  }, [dynamicReferralLink, currentUser.username]);

  // Subscribe to real-time referral events
  useEffect(() => {
    const refreshAffiliate = () => {
      const updated = referralService.getReferralsForUser(currentUser.id, currentUser.username, currency);
      setStats(updated);
    };

    const unsubscribe = referralService.subscribe(refreshAffiliate);
    return () => unsubscribe();
  }, [currentUser.id, currentUser.username, currency]);

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
    () => chartData.reduce((sum, d) => sum + d.totalCommission, 0) + (stats.referrals.length * (currency === 'BDT' ? 500 : 5)),
    [chartData, stats.referrals.length, currency]
  );
  const totalTurnoverTimeframe = useMemo(
    () => chartData.reduce((sum, d) => sum + d.turnover, 0),
    [chartData]
  );
  const totalNewMembersTimeframe = useMemo(
    () => chartData.reduce((sum, d) => sum + d.newMembers, 0) + stats.referrals.length,
    [chartData, stats.referrals.length]
  );
  const currentNetworkCount = (rawChartData[rawChartData.length - 1]?.cumulativeMembers || 144) + stats.referrals.length;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(dynamicReferralLink);
    soundEngine.playClick(950);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentUser.username.toLowerCase());
    soundEngine.playClick(950);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleClaimCommission = () => {
    if (unclaimedAmount <= 0) return;
    setClaiming(true);
    soundEngine.playClick(900);

    setTimeout(() => {
      const res = referralService.claimCommission(currentUser.id, currency, unclaimedAmount);
      soundEngine.playWinChime();
      setToast(
        `সফলভাবে ${currency === 'BDT' ? '৳' : '$'}${unclaimedAmount.toLocaleString()} রেফারেল কমিশন ওয়ালেটে যুক্ত হয়েছে!`
      );
      setUnclaimedAmount(0);
      setClaiming(false);
      onCommissionClaimed();
      setTimeout(() => setToast(null), 4000);
    }, 600);
  };

  // Real + Mock MLM Hierarchy Tree members
  const allNetworkMembers = useMemo(() => {
    const realList = stats.referrals.map((r) => ({
      name: r.referredUsername,
      tier: `Tier 1 (রিয়েল লাইভ)`,
      validBet: r.totalTurnover > 0 ? r.totalTurnover : (currency === 'BDT' ? 50000 : 450),
      commission: r.commissionEarned > 0 ? r.commissionEarned : (currency === 'BDT' ? 500 : 5),
      rate: '0.50%',
      active: true,
      isRealTime: true,
      joinedAt: new Date(r.joinedAt).toLocaleDateString()
    }));

    const mockList = [
      { name: 'rahim_dhaka_01', tier: 'Tier 1 (Direct)', validBet: currency === 'BDT' ? 450000 : 3750, commission: currency === 'BDT' ? 2250 : 18.75, rate: '0.50%', active: true, isRealTime: false, joinedAt: '2 days ago' },
      { name: 'tariq_ctg_player', tier: 'Tier 1 (Direct)', validBet: currency === 'BDT' ? 180000 : 1500, commission: currency === 'BDT' ? 900 : 7.5, rate: '0.50%', active: true, isRealTime: false, joinedAt: '3 days ago' },
      { name: 'sohel_sylhet_vip', tier: 'Tier 2 (Subordinate)', validBet: currency === 'BDT' ? 120000 : 1000, commission: currency === 'BDT' ? 240 : 2.0, rate: '0.20%', active: true, isRealTime: false, joinedAt: '5 days ago' },
      { name: 'kamrul_rajshahi', tier: 'Tier 2 (Subordinate)', validBet: currency === 'BDT' ? 85000 : 708, commission: currency === 'BDT' ? 170 : 1.4, rate: '0.20%', active: true, isRealTime: false, joinedAt: '1 week ago' },
      { name: 'munna_khulna', tier: 'Tier 3 (Subordinate)', validBet: currency === 'BDT' ? 60000 : 500, commission: currency === 'BDT' ? 60 : 0.5, rate: '0.10%', active: false, isRealTime: false, joinedAt: '2 weeks ago' },
    ];

    return [...realList, ...mockList];
  }, [stats.referrals, currency]);

  const symbol = currency === 'BDT' ? '৳' : '$';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-28 font-sans text-slate-100 selection:bg-amber-400 selection:text-slate-950"
    >
      {/* 1. MASTER BANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left Column: Program Overview & Real-Time Referral Link */}
        <div className="lg:col-span-7 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-950 to-emerald-900 border-2 border-amber-400/50 p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-amber-400/20 to-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-3.5 relative z-10">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-950 border border-amber-400/50 text-amber-300 text-xs font-mono font-bold uppercase shadow-sm">
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              <span>রিয়েল-টাইম রেফারেল ও এফিলিয়েট আর্নিং হাব</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              আজীবন রেফারেল কমিশন (Up to 0.80% Turnover + ৳500 Instant)
            </h1>

            <p className="text-xs sm:text-sm text-emerald-200/90 font-sans leading-relaxed">
              আপনার সক্রিয় রেফারেল লিংকের মাধ্যমে বন্ধু বা মেম্বার যুক্ত হলে আপনি সাথে সাথে পাবেন <strong className="text-amber-300">৳৫০০ ইনস্ট্যান্ট বোনাস</strong> এবং তাদের প্রতিটি স্পিন/বেটের ওপর পাবেন আজীবন অটো কমিশন।
            </p>

            {/* Live Real Referral Link Box */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-mono text-amber-300 font-bold">
                <span className="flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>আপনার আসল লাইভ রেফারেল লিংক:</span>
                </span>
                <span className="text-emerald-300 text-[11px]">
                  কোড: <strong className="text-amber-300">{currentUser.username.toLowerCase()}</strong>
                </span>
              </div>

              <div className="bg-emerald-950/90 border-2 border-emerald-700/80 p-2.5 sm:p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono shadow-lg shadow-emerald-950">
                <div className="flex items-center space-x-2 text-emerald-200 truncate w-full min-w-0">
                  <span className="text-emerald-100 bg-emerald-900/60 px-3 py-2 rounded-xl border border-emerald-700 truncate flex-1 select-all text-xs text-left font-mono font-bold">
                    {dynamicReferralLink}
                  </span>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 sm:flex-none min-h-[38px] px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black flex items-center justify-center space-x-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-950 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'কপি হয়েছে!' : 'লিংক কপি'}</span>
                  </button>

                  <button
                    onClick={handleCopyCode}
                    className="min-h-[38px] px-3 py-2 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center justify-center space-x-1 transition-all cursor-pointer"
                    title="রেফারেল কোড কপি করুন"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Award className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{copiedCode ? 'কোড কপি!' : 'কোড'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 1-Click Social Share Buttons */}
            <div className="pt-2">
              <div className="text-[11px] text-emerald-300 font-mono mb-2">১-ক্লিকে বন্ধুদের সাথে শেয়ার করুন:</div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                <a
                  href={shareLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-emerald-800/40 hover:bg-emerald-800/60 border border-emerald-600 text-emerald-200 text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm group"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>WhatsApp</span>
                </a>

                <a
                  href={shareLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-emerald-800/40 hover:bg-emerald-800/60 border border-emerald-600 text-emerald-200 text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm group"
                >
                  <Send className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>Telegram</span>
                </a>

                <a
                  href={shareLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-emerald-800/40 hover:bg-emerald-800/60 border border-emerald-600 text-emerald-200 text-xs font-mono font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm group"
                >
                  <Facebook className="w-4 h-4 text-amber-300 group-hover:scale-110 transition-transform" />
                  <span>Facebook</span>
                </a>

                <button
                  onClick={handleCopyLink}
                  className="hidden sm:flex p-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 text-xs font-mono font-bold items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-amber-400" />
                  <span>অন্যান্য</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 pt-4 mt-3 border-t border-emerald-800/80 text-xs font-mono text-emerald-300 relative z-10">
            <span className="flex items-center space-x-1 text-amber-400 font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>রিয়েল-টাইম লাইভ ট্র্যাকিং সক্রিয়</span>
            </span>
            <span>•</span>
            <span>ইনস্ট্যান্ট নোটিফিকেশন</span>
          </div>
        </div>

        {/* Right Column: Unclaimed Commission Snapshot */}
        <div className="lg:col-span-5 rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between shadow-xl">
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
              <span className="text-xs text-emerald-300 uppercase font-bold">ক্লেইমেবল কমিশন (Unclaimed)</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                READY TO CLAIM
              </span>
            </div>

            <div className="p-4 bg-emerald-950/90 rounded-2xl border border-emerald-700/60">
              <div className="text-[11px] text-emerald-300">উত্তোলনযোগ্য কমিশন:</div>
              <div className="text-3xl sm:text-4xl font-black text-transparent bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 bg-clip-text mt-1">
                {currency === 'BDT' ? `৳${unclaimedAmount.toLocaleString()}` : `$${unclaimedAmount.toFixed(2)}`}
              </div>
              <div className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center space-x-1">
                <Check className="w-3.5 h-3.5" />
                <span>মেইন ওয়ালেটে সরাসরি যুক্ত হবে ০% ফি সহ</span>
              </div>
            </div>

            {stats.referrals.length > 0 && (
              <div className="p-3 bg-emerald-900/60 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs">
                <span className="font-bold text-amber-300">🎉 লাইভ রেফারেল:</span> আপনার লিংকে সম্প্রতি {stats.referrals.length} জন প্লেয়ার যোগ দিয়েছেন!
              </div>
            )}
          </div>

          <button
            onClick={handleClaimCommission}
            disabled={claiming || unclaimedAmount <= 0}
            className="w-full min-h-[46px] mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs font-mono shadow-lg shadow-emerald-950 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{claiming ? 'ওয়ালেটে ট্রান্সফার হচ্ছে...' : 'কমিশন মেইন ওয়ালেটে নিন'}</span>
          </button>
        </div>

      </div>

      {toast && (
        <div className="p-4 bg-emerald-950 border-2 border-amber-400 rounded-2xl text-amber-300 text-xs font-mono flex items-center space-x-2 animate-bounce shadow-xl">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="font-bold">{toast}</span>
        </div>
      )}

      {/* 2. 3-TIER COMMISSION CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Tier 1 */}
        <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 space-y-2 font-mono flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-200 uppercase font-bold">Tier 1 (Direct Referrals)</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-400/30">
              0.50%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{stats.tier1Count} মেম্বার</div>
            <div className="text-xs text-amber-300 mt-0.5">মোট টার্নওভার: {symbol}{(stats.totalTurnover * 0.45).toLocaleString()}</div>
          </div>
          <p className="text-[11px] text-emerald-200/90 font-sans leading-relaxed">
            সরাসরি আপনার রেফারেল লিংকে রেজিস্টার্ড প্লেয়ারদের প্রতি স্পিনের ইনস্ট্যান্ট কমিশন + ৳৫০০ ইনস্ট্যান্ট বোনাস।
          </p>
        </div>

        {/* Tier 2 */}
        <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 space-y-2 font-mono flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-200 uppercase font-bold">Tier 2 (Subordinates)</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black border border-emerald-500/30">
              0.20%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{stats.tier2Count} মেম্বার</div>
            <div className="text-xs text-amber-300 mt-0.5">মোট টার্নওভার: {symbol}{(stats.totalTurnover * 0.35).toLocaleString()}</div>
          </div>
          <p className="text-[11px] text-emerald-200/90 font-sans leading-relaxed">
            Tier 1 মেম্বারদের আমন্ত্রিত সেকেন্ড-লেভেল প্লেয়ারদের টার্নওভার কমিশন।
          </p>
        </div>

        {/* Tier 3 */}
        <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 space-y-2 font-mono flex flex-col justify-between shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-200 uppercase font-bold">Tier 3 (Network)</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/30">
              0.10%
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{stats.tier3Count} মেম্বার</div>
            <div className="text-xs text-amber-300 mt-0.5">মোট টার্নওভার: {symbol}{(stats.totalTurnover * 0.20).toLocaleString()}</div>
          </div>
          <p className="text-[11px] text-emerald-200/90 font-sans leading-relaxed">
            ৩য় লেয়ারের সকল সক্রিয় প্লেয়ারদের সম্মিলিত গেমপ্লে থেকে প্যাসিভ ইনকাম।
          </p>
        </div>
      </div>

      {/* 3. VISUAL RECHARTS 30-DAY ANALYTICS */}
      <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-emerald-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white font-sans">
                ৩০-দিনের পারফরম্যান্স অ্যানালিটিক্স
              </h2>
              <p className="text-xs text-emerald-300 font-mono">
                নেটওয়ার্ক গ্রোথ, ডেইলি টার্নওভার ও কমিশন ট্রেন্ডস
              </p>
            </div>
          </div>

          {/* Controls Toolbar */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {/* Timeframe Buttons */}
            <div className="flex items-center bg-emerald-950 p-1 rounded-xl border border-emerald-700">
              {(['7D', '14D', '30D'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => {
                    soundEngine.playClick(700);
                    setTimeframe(tf);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    timeframe === tf ? 'bg-amber-400 text-slate-950 font-black' : 'text-emerald-200 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Chart Type Selector */}
            <div className="flex items-center bg-emerald-950 p-1 rounded-xl border border-emerald-700">
              <button
                onClick={() => setChartType('AREA')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'AREA' ? 'bg-amber-400 text-slate-950' : 'text-emerald-200 hover:text-white'
                }`}
                title="Area Chart"
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('BAR')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'BAR' ? 'bg-amber-400 text-slate-950' : 'text-emerald-200 hover:text-white'
                }`}
                title="Bar Chart"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setChartType('TIERS')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  chartType === 'TIERS' ? 'bg-amber-400 text-slate-950' : 'text-emerald-200 hover:text-white'
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
          <div className="bg-emerald-950/80 p-3 rounded-2xl border border-emerald-700/60">
            <span className="text-[10px] text-emerald-300 uppercase">মোট অর্জিত কমিশন</span>
            <div className="text-base sm:text-lg font-black text-amber-300 mt-0.5 truncate">
              {symbol}{totalCommissionTimeframe.toLocaleString()}
            </div>
          </div>

          <div className="bg-emerald-950/80 p-3 rounded-2xl border border-emerald-700/60">
            <span className="text-[10px] text-emerald-300 uppercase">মোট টার্নওভার ভলিউম</span>
            <div className="text-base sm:text-lg font-black text-white mt-0.5 truncate">
              {symbol}{totalTurnoverTimeframe.toLocaleString()}
            </div>
          </div>

          <div className="bg-emerald-950/80 p-3 rounded-2xl border border-emerald-700/60">
            <span className="text-[10px] text-emerald-300 uppercase">নতুন রেজিস্টার্ড</span>
            <div className="text-base sm:text-lg font-black text-emerald-300 mt-0.5 truncate">
              +{totalNewMembersTimeframe} জন
            </div>
          </div>

          <div className="bg-emerald-950/80 p-3 rounded-2xl border border-emerald-700/60">
            <span className="text-[10px] text-emerald-300 uppercase">বর্তমান নেটওয়ার্ক</span>
            <div className="text-base sm:text-lg font-black text-amber-300 mt-0.5 truncate">
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
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" />
                <XAxis dataKey="date" stroke="#6ee7b7" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6ee7b7" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#022c22', borderColor: '#059669', borderRadius: '12px', color: '#fff' }}
                />
                <Area type="monotone" dataKey="totalCommission" stroke="#fbbf24" strokeWidth={2} fillOpacity={1} fill="url(#commGrad)" name="কমিশন" />
              </AreaChart>
            ) : chartType === 'BAR' ? (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" />
                <XAxis dataKey="date" stroke="#6ee7b7" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6ee7b7" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#022c22', borderColor: '#059669', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="totalCommission" fill="#fbbf24" radius={[4, 4, 0, 0]} name="কমিশন" />
              </BarChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#064e3b" />
                <XAxis dataKey="date" stroke="#6ee7b7" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6ee7b7" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#022c22', borderColor: '#059669', borderRadius: '12px', color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="commissionTier1" name="Tier 1 (0.50%)" fill="#fbbf24" stackId="tiers" />
                <Bar dataKey="commissionTier2" name="Tier 2 (0.20%)" fill="#34d399" stackId="tiers" />
                <Bar dataKey="commissionTier3" name="Tier 3 (0.10%)" fill="#10b981" stackId="tiers" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3.5 REAL-TIME AFFILIATE ACTIVITY & CLICKS / CONVERSIONS RADAR */}
      <RealtimeAffiliateActivityWidget
        currentUser={currentUser}
        currentWallet={currentWallet}
        currency={currency}
      />

      {/* 3.8 GLOBAL & REGIONAL REFERRAL TRAFFIC & CONVERSION GEO-SCATTER RADAR */}
      <AffiliateGeoTrafficScatter
        currency={currency}
        currentUserUsername={currentUser.username}
      />

      {/* 3.9 MULTI-LEVEL AGENT & REFERRAL HIERARCHY TREE */}
      <AgentTree
        currentUserUsername={currentUser.username}
        currency={currency}
      />

      {/* 4. NETWORK DOWNLINE TREE TABLE */}
      <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2 font-sans">
              <Users className="w-4 h-4 text-amber-400" />
              <span>রেফারেল মেম্বার ও কমিশন লেজার</span>
            </h2>
            <p className="text-xs text-emerald-300 font-mono mt-0.5">
              আপনার লিংকে জয়েন করা সকল মেম্বার ও তাদের মাধ্যমে আসা কমিশনের লাইভ হিসাব।
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-emerald-300 bg-emerald-950 px-3 py-1 rounded-full border border-emerald-700">
              ● রিয়েল-টাইম কানেক্টেড
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-emerald-950 text-emerald-300 uppercase text-[10px]">
              <tr>
                <th className="p-3">ইউজারনেম</th>
                <th className="p-3">টিয়ার লেভেল</th>
                <th className="p-3">যোগদানের সময়</th>
                <th className="p-3">ভ্যালিড বেট টার্নওভার</th>
                <th className="p-3">কমিশন রেট</th>
                <th className="p-3">অর্জিত কমিশন</th>
                <th className="p-3">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-800/80">
              {allNetworkMembers.map((m, idx) => (
                <tr key={idx} className={`hover:bg-emerald-900/40 transition-colors ${m.isRealTime ? 'bg-amber-500/10' : ''}`}>
                  <td className="p-3 text-white font-bold flex items-center space-x-2">
                    <span>{m.name}</span>
                    {m.isRealTime && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[9px] font-black">
                        NEW LIVE
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-200 border border-emerald-800 text-[10px]">
                      {m.tier}
                    </span>
                  </td>
                  <td className="p-3 text-emerald-300">{m.joinedAt}</td>
                  <td className="p-3 text-amber-300 font-bold">
                    {symbol}{m.validBet.toLocaleString()}
                  </td>
                  <td className="p-3 text-emerald-300">{m.rate}</td>
                  <td className="p-3 text-amber-400 font-black">
                    +{symbol}{m.commission.toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      m.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-950 text-emerald-600'
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
