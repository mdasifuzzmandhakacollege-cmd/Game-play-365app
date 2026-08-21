/**
 * @file RealtimeAffiliateActivityWidget.tsx
 * @description Master Real-time Affiliate Activity & Live Radar Widget for Playall 365.
 * Tracks incoming referral link clicks, unique visitors, registration conversions,
 * and live turnover commissions with absolute transparency and interactive test simulation.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Share2,
  Users,
  TrendingUp,
  Zap,
  Gift,
  Copy,
  Check,
  Award,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Send,
  Facebook,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Clock,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  CheckCircle2,
  DollarSign,
  Radio
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import {
  referralService,
  AffiliateActivityEvent,
  LiveAffiliateMetrics
} from '../services/referralService';
import { soundEngine } from '../services/soundEngine';
import { useWalletGame } from '../contexts/WalletGameContext';
import { motion, AnimatePresence } from 'framer-motion';

interface RealtimeAffiliateActivityWidgetProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onNavigateTab?: (tab: any) => void;
  defaultExpanded?: boolean;
}

export const RealtimeAffiliateActivityWidget: React.FC<RealtimeAffiliateActivityWidgetProps> = ({
  currentUser,
  currentWallet,
  currency,
  onNavigateTab,
  defaultExpanded = true
}) => {
  const { showToast } = useWalletGame();

  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CLICK' | 'SIGNUP' | 'COMMISSION'>('ALL');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  // Live Metrics & Activity Stream state
  const [metrics, setMetrics] = useState<LiveAffiliateMetrics>(() =>
    referralService.getLiveAffiliateMetrics(currentUser.id, currentUser.username, currency)
  );

  const [activities, setActivities] = useState<AffiliateActivityEvent[]>(() =>
    referralService.getLiveActivityStream(18)
  );

  // Subscribe to real-time updates from the referralService
  useEffect(() => {
    const updateState = () => {
      const updatedMetrics = referralService.getLiveAffiliateMetrics(
        currentUser.id,
        currentUser.username,
        currency
      );
      const updatedActivities = referralService.getLiveActivityStream(18);

      setMetrics(updatedMetrics);
      setActivities(updatedActivities);

      if (updatedActivities.length > 0) {
        setLastEventId(updatedActivities[0].id);
      }
    };

    updateState();
    const unsubscribe = referralService.subscribe(updateState);
    return () => unsubscribe();
  }, [currentUser.id, currentUser.username, currency]);

  // Social Share Links
  const shareLinks = useMemo(() => {
    return referralService.getShareLinks(metrics.referralLink, currentUser.username);
  }, [metrics.referralLink, currentUser.username]);

  // Copy Handlers
  const handleCopyLink = () => {
    navigator.clipboard.writeText(metrics.referralLink);
    setCopiedLink(true);
    soundEngine.playClick(1100);
    showToast('রেফারেল লিংক সফলভাবে কপি করা হয়েছে!');
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentUser.username);
    setCopiedCode(true);
    soundEngine.playClick(950);
    showToast(`রেফারেল কোড '${currentUser.username}' কপি করা হয়েছে!`);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  // Test Click Simulation Handler
  const handleSimulateClick = () => {
    if (isSimulating) return;
    setIsSimulating(true);

    const event = referralService.simulateTestClick(currentUser.id, currentUser.username);
    showToast(`লাইভ টেস্ট ক্লিক রেকর্ড হয়েছে! (${event.source} - ${event.location})`);

    setTimeout(() => {
      setIsSimulating(false);
    }, 600);
  };

  // Test Conversion Simulation Handler
  const handleSimulateConversion = async () => {
    if (isSimulating) return;
    setIsSimulating(true);

    try {
      const event = await referralService.simulateTestConversion(
        currentUser.id,
        currentUser.username,
        currency
      );
      showToast(`অভিনন্দন! নতুন টেস্ট সাইন-আপ সম্পন্ন (+৳৫০০ ক্রেডিট)`);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (activeFilter === 'ALL') return activities;
    return activities.filter((a) => a.type === activeFilter);
  }, [activities, activeFilter]);

  // Helper for human-readable relative time in Bengali
  const formatTimeAgo = (timestamp: number) => {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 10) return 'এইমাত্র';
    if (diffSeconds < 60) return `${diffSeconds} সেকেন্ড আগে`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} মিনিট আগে`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} ঘণ্টা আগে`;
    return `${Math.floor(diffHours / 24)} দিন আগে`;
  };

  const getSourceIcon = (source: AffiliateActivityEvent['source']) => {
    switch (source) {
      case 'WhatsApp':
        return <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Telegram':
        return <Send className="w-3.5 h-3.5 text-cyan-400" />;
      case 'Facebook':
        return <Facebook className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  const getDeviceIcon = (device: AffiliateActivityEvent['device']) => {
    switch (device) {
      case 'Mobile':
        return <Smartphone className="w-3 h-3 text-slate-400" />;
      case 'Tablet':
        return <Tablet className="w-3 h-3 text-slate-400" />;
      default:
        return <Monitor className="w-3 h-3 text-slate-400" />;
    }
  };

  return (
    <section className="relative rounded-[28px] overflow-hidden border-2 border-emerald-600/40 bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] shadow-xl transition-all font-sans">
      {/* Glow Top Accent */}
      <div className="absolute top-0 left-10 right-10 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400 to-transparent pointer-events-none" />

      {/* Widget Header & Live Radar Status */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 px-4 sm:px-6 py-3.5 border-b border-emerald-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 p-0.5 shadow-lg shadow-emerald-950 flex items-center justify-center">
              <div className="w-full h-full bg-emerald-950 rounded-[14px] flex items-center justify-center">
                <Radio className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-emerald-950"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center gap-1.5 font-sans">
                <span>রিয়েল-টাইম রেফারেল অ্যাক্টিভিটি</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] sm:text-[10px] font-mono font-black border border-emerald-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>LIVE RADAR</span>
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/90 font-sans mt-0.5">
              লাইভ রেফারেল ক্লিক, ইনকামিং ভিজিটর ও কনভার্সন ট্র্যাকার • ১০০% স্বচ্ছ
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center space-x-2">
          {/* Simulate Click Test Button */}
          <button
            onClick={handleSimulateClick}
            disabled={isSimulating}
            className="px-3 py-1.5 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 border border-amber-400/40 text-amber-300 hover:text-white text-xs font-mono font-bold transition-all flex items-center space-x-1.5 active:scale-95 cursor-pointer shadow-sm"
            title="লাইভ ক্লিক কাউন্টার টেস্ট করুন"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">টেস্ট ক্লিক</span>
          </button>

          {/* Full Affiliate Hub Link */}
          {onNavigateTab && (
            <button
              onClick={() => {
                soundEngine.playClick(900);
                onNavigateTab('affiliate');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 text-xs font-mono font-black shadow-md shadow-emerald-950 hover:scale-105 active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <span>এফিলিয়েট হাব</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Expand/Collapse */}
          <button
            onClick={() => {
              soundEngine.playClick(800);
              setIsExpanded(!isExpanded);
            }}
            className="p-1.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 transition-all cursor-pointer"
            title={isExpanded ? 'সংকুচিত করুন' : 'প্রসারিত করুন'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* 1. TRANSPARENT REAL-TIME KPI METRICS ROW */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
            {/* KPI 1: Total Clicks */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-700/60 relative overflow-hidden group">
              <div className="flex items-center justify-between text-emerald-300 text-[10px] uppercase font-bold">
                <span>মোট লিংক ক্লিক</span>
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1 flex items-baseline gap-1">
                <span>{metrics.totalClicks.toLocaleString()}</span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  (+{metrics.todayClicks} আজ)
                </span>
              </div>
              <div className="text-[10px] text-emerald-300 mt-1 flex items-center gap-1">
                <Eye className="w-3 h-3 text-amber-300" />
                <span>{metrics.uniqueVisitors} ইউনিক ভিজিটর</span>
              </div>
            </div>

            {/* KPI 2: Total Conversions */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-700/60 relative overflow-hidden group">
              <div className="flex items-center justify-between text-emerald-300 text-[10px] uppercase font-bold">
                <span>কনভার্সন (সাইন-আপ)</span>
                <Users className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
                {metrics.totalConversions} জন
              </div>
              <div className="text-[10px] text-emerald-300 mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>ভেরিফাইড মেম্বার</span>
              </div>
            </div>

            {/* KPI 3: Conversion Rate % */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-700/60 relative overflow-hidden group">
              <div className="flex items-center justify-between text-emerald-300 text-[10px] uppercase font-bold">
                <span>কনভার্সন রেট (CR)</span>
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1">
                {metrics.conversionRate}%
              </div>
              <div className="text-[10px] text-amber-300 font-bold mt-1">
                ★ হাই কনভার্সন রেট
              </div>
            </div>

            {/* KPI 4: Total Commission Earned */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-700/60 relative overflow-hidden group">
              <div className="flex items-center justify-between text-emerald-300 text-[10px] uppercase font-bold">
                <span>মোট কমিশন আর্ন</span>
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-transparent bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 bg-clip-text mt-1">
                {currency === 'BDT' ? `৳${metrics.totalCommission.toLocaleString()}` : `$${metrics.totalCommission.toFixed(2)}`}
              </div>
              <div className="text-[10px] text-amber-300 mt-1">
                +{currency === 'BDT' ? `৳${metrics.todayCommission}` : `$${metrics.todayCommission}`} আজকের
              </div>
            </div>

            {/* KPI 5: Active Online Now */}
            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-700/60 relative overflow-hidden group">
              <div className="flex items-center justify-between text-emerald-300 text-[10px] uppercase font-bold">
                <span>লাইভ একটিভ রেফারেল</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">
                {metrics.activeReferralsOnline} জন অনলাইন
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                বর্তমানে গেমপ্লে সক্রিয়
              </div>
            </div>
          </div>

          {/* 2. REAL-TIME ACTIVITY FEED STREAM */}
          <div className="bg-[#050810]/90 rounded-2xl border border-slate-800 p-4 space-y-3">
            {/* Feed Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3 font-mono text-xs">
              <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-0.5">
                <button
                  onClick={() => setActiveFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeFilter === 'ALL'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  সকল অ্যাক্টিভিটি ({activities.length})
                </button>
                <button
                  onClick={() => setActiveFilter('CLICK')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeFilter === 'CLICK'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  ⚡ ক্লিকস
                </button>
                <button
                  onClick={() => setActiveFilter('SIGNUP')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeFilter === 'SIGNUP'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  🎯 সাইন-আপ ও কনভার্সন
                </button>
                <button
                  onClick={() => setActiveFilter('COMMISSION')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeFilter === 'COMMISSION'
                      ? 'bg-yellow-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  💰 কমিশন
                </button>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 self-end sm:self-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>রিয়েল-টাইম লাইভ ট্র্যাকিং সক্রিয়</span>
              </div>
            </div>

            {/* Scrollable Live Activity List */}
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800 font-mono text-xs">
              <AnimatePresence initial={false}>
                {filteredActivities.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    কোনো অ্যাক্টিভিটি পাওয়া যায়নি।
                  </div>
                ) : (
                  filteredActivities.map((event) => {
                    const isNew = event.id === lastEventId;
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                          isNew
                            ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                            : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        {/* Event Left Badge & Message */}
                        <div className="flex items-start space-x-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              event.type === 'SIGNUP'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : event.type === 'COMMISSION'
                                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            }`}
                          >
                            {event.type === 'SIGNUP' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : event.type === 'COMMISSION' ? (
                              <DollarSign className="w-4 h-4" />
                            ) : (
                              <Zap className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-slate-200 text-xs font-semibold break-words">
                              {event.message}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 mt-1">
                              <span className="flex items-center space-x-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                {getSourceIcon(event.source)}
                                <span>{event.source}</span>
                              </span>

                              <span className="flex items-center space-x-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                <Globe className="w-3 h-3 text-slate-400" />
                                <span>{event.location}</span>
                              </span>

                              <span className="flex items-center space-x-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                {getDeviceIcon(event.device)}
                                <span>{event.device}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Event Right Timestamp & Amount Badge */}
                        <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end shrink-0 gap-1 text-right">
                          {event.amount && event.amount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[11px]">
                              +{currency === 'BDT' ? '৳' : '$'}{event.amount.toLocaleString()}
                            </span>
                          )}

                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimeAgo(event.timestamp)}</span>
                          </span>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* 3. TRANSPARENT REFERRAL LINK & 1-CLICK SHARE DOCK */}
          <div className="bg-gradient-to-r from-amber-950/30 via-slate-950 to-amber-950/30 p-4 rounded-2xl border border-amber-500/30 space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold text-white text-xs">
                  আপনার রিয়েল-টাইম রেফারেল লিংক ও শেয়ার ডক:
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-amber-400 font-bold">
                  রেফারেল কোড: <strong className="text-white underline">{currentUser.username}</strong>
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[10px] transition-all"
                  title="রেফারেল কোড কপি"
                >
                  {copiedCode ? 'কপি!' : 'কপি কোড'}
                </button>
              </div>
            </div>

            {/* Link Input Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="w-full sm:flex-1 bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-800 text-slate-200 select-all truncate text-[11px] font-bold">
                {metrics.referralLink}
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 active:scale-95 transition-all cursor-pointer shadow-md"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'কপি হয়েছে!' : 'লিংক কপি'}</span>
                </button>

                {/* WhatsApp */}
                <a
                  href={shareLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center justify-center transition-all"
                  title="WhatsApp এ শেয়ার করুন"
                >
                  <MessageCircle className="w-4 h-4" />
                </a>

                {/* Telegram */}
                <a
                  href={shareLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 flex items-center justify-center transition-all"
                  title="Telegram এ শেয়ার করুন"
                >
                  <Send className="w-4 h-4" />
                </a>

                {/* Facebook */}
                <a
                  href={shareLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center transition-all"
                  title="Facebook এ শেয়ার করুন"
                >
                  <Facebook className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Extra Simulation CTA for testing */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 border-t border-slate-800/80">
              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>প্রতি সফল সাইন-আপে তাৎক্ষণিক <strong>৳৫০০ বোনাস</strong> ওয়ালেটে ক্রেডিট হয়</span>
              </div>

              <button
                onClick={handleSimulateConversion}
                disabled={isSimulating}
                className="text-amber-400 hover:text-amber-300 underline font-bold cursor-pointer"
              >
                + টেস্ট সাইন-আপ সিমুলেট করুন (+৳৫০০)
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
