/**
 * @file AffiliateGeoTrafficScatter.tsx
 * @description Global & Regional Referral Traffic & Conversion Scatter Map Visualization.
 * Powered by Recharts ScatterChart, XAxis (Longitude), YAxis (Latitude), ZAxis (Conversion Volume/Weight),
 * and custom Tooltip with live pulsing geo-clusters, regional drill-down, and real-time conversion telemetry.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import {
  Globe,
  MapPin,
  Sparkles,
  Activity,
  TrendingUp,
  Zap,
  Users,
  DollarSign,
  Radio,
  Compass,
  Filter,
  Eye,
  ArrowUpRight,
  ShieldCheck,
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock
} from 'lucide-react';
import { referralService } from '../services/referralService';
import { soundEngine } from '../services/soundEngine';
import { motion, AnimatePresence } from 'framer-motion';

export interface GeoHubPoint {
  id: string;
  name: string;
  country: string;
  region: 'BD' | 'ME' | 'SEA' | 'EU' | 'NA';
  regionLabel: string;
  // Geographic Coordinates for Scatter Plot (X: Longitude -180..180, Y: Latitude -90..90)
  longitude: number; // x
  latitude: number;  // y
  clicks: number;
  conversions: number;
  conversionRate: number; // e.g. 18.5%
  totalCommission: number; // BDT or USD
  topDevice: 'Mobile' | 'Desktop';
  activeNow: number;
  tier: 1 | 2 | 3;
  status: 'HOT' | 'STEADY' | 'EMERGING';
  lastConversionTime: string;
}

interface AffiliateGeoTrafficScatterProps {
  currency: 'BDT' | 'USD';
  currentUserUsername: string;
}

// Initial Global & Regional Geo Data
const BASE_GEO_HUBS: GeoHubPoint[] = [
  // Bangladesh Mega Hubs
  {
    id: 'GEO_DHK',
    name: 'Dhaka (Capital Division)',
    country: 'Bangladesh',
    region: 'BD',
    regionLabel: 'বাংলাদেশ (ঢাকা)',
    longitude: 90.4125,
    latitude: 23.8103,
    clicks: 432,
    conversions: 86,
    conversionRate: 19.9,
    totalCommission: 43000,
    topDevice: 'Mobile',
    activeNow: 14,
    tier: 1,
    status: 'HOT',
    lastConversionTime: '২ মিনিট আগে'
  },
  {
    id: 'GEO_CTG',
    name: 'Chittagong (Port City)',
    country: 'Bangladesh',
    region: 'BD',
    regionLabel: 'বাংলাদেশ (চট্টগ্রাম)',
    longitude: 91.7832,
    latitude: 22.3569,
    clicks: 284,
    conversions: 52,
    conversionRate: 18.3,
    totalCommission: 26000,
    topDevice: 'Mobile',
    activeNow: 8,
    tier: 1,
    status: 'HOT',
    lastConversionTime: '৮ মিনিট আগে'
  },
  {
    id: 'GEO_SYL',
    name: 'Sylhet (Tea & Expat Hub)',
    country: 'Bangladesh',
    region: 'BD',
    regionLabel: 'বাংলাদেশ (সিলেট)',
    longitude: 91.8687,
    latitude: 24.8949,
    clicks: 195,
    conversions: 38,
    conversionRate: 19.5,
    totalCommission: 19000,
    topDevice: 'Mobile',
    activeNow: 6,
    tier: 1,
    status: 'HOT',
    lastConversionTime: '১৪ মিনিট আগে'
  },
  {
    id: 'GEO_RAJ',
    name: 'Rajshahi (Silk City)',
    country: 'Bangladesh',
    region: 'BD',
    regionLabel: 'বাংলাদেশ (রাজশাহী)',
    longitude: 88.6042,
    latitude: 24.3745,
    clicks: 128,
    conversions: 21,
    conversionRate: 16.4,
    totalCommission: 10500,
    topDevice: 'Mobile',
    activeNow: 4,
    tier: 2,
    status: 'STEADY',
    lastConversionTime: '৩২ মিনিট আগে'
  },
  {
    id: 'GEO_KHU',
    name: 'Khulna (Industrial Hub)',
    country: 'Bangladesh',
    region: 'BD',
    regionLabel: 'বাংলাদেশ (খুলনা)',
    longitude: 89.5403,
    latitude: 22.8456,
    clicks: 110,
    conversions: 19,
    conversionRate: 17.2,
    totalCommission: 9500,
    topDevice: 'Mobile',
    activeNow: 3,
    tier: 2,
    status: 'STEADY',
    lastConversionTime: '৪৫ মিনিট আগে'
  },
  {
    id: 'GEO_BAR',
    name: 'Barisal (Riverine Division)',
    country: 'Bangladesh',
    region: 'BD',
    regionLabel: 'বাংলাদেশ (বরিশাল)',
    longitude: 90.3667,
    latitude: 22.7010,
    clicks: 84,
    conversions: 14,
    conversionRate: 16.6,
    totalCommission: 7000,
    topDevice: 'Mobile',
    activeNow: 2,
    tier: 3,
    status: 'EMERGING',
    lastConversionTime: '১ ঘণ্টা আগে'
  },

  // Middle East Expat Communities
  {
    id: 'GEO_DXB',
    name: 'Dubai & Abu Dhabi (UAE)',
    country: 'United Arab Emirates',
    region: 'ME',
    regionLabel: 'মধ্যপ্রাচ্য (সংযুক্ত আরব আমিরাত)',
    longitude: 55.2708,
    latitude: 25.2048,
    clicks: 220,
    conversions: 46,
    conversionRate: 20.9,
    totalCommission: 34500,
    topDevice: 'Mobile',
    activeNow: 9,
    tier: 1,
    status: 'HOT',
    lastConversionTime: '৪ মিনিট আগে'
  },
  {
    id: 'GEO_DOH',
    name: 'Doha (Qatar)',
    country: 'Qatar',
    region: 'ME',
    regionLabel: 'মধ্যপ্রাচ্য (কাতার)',
    longitude: 51.5310,
    latitude: 25.2854,
    clicks: 145,
    conversions: 29,
    conversionRate: 20.0,
    totalCommission: 18500,
    topDevice: 'Mobile',
    activeNow: 5,
    tier: 1,
    status: 'HOT',
    lastConversionTime: '১৯ মিনিট আগে'
  },
  {
    id: 'GEO_RUH',
    name: 'Riyadh & Jeddah (Saudi Arabia)',
    country: 'Saudi Arabia',
    region: 'ME',
    regionLabel: 'মধ্যপ্রাচ্য (সৌদি আরব)',
    longitude: 46.6753,
    latitude: 24.7136,
    clicks: 175,
    conversions: 33,
    conversionRate: 18.8,
    totalCommission: 21000,
    topDevice: 'Mobile',
    activeNow: 7,
    tier: 1,
    status: 'HOT',
    lastConversionTime: '১১ মিনিট আগে'
  },
  {
    id: 'GEO_MCT',
    name: 'Muscat (Oman)',
    country: 'Oman',
    region: 'ME',
    regionLabel: 'মধ্যপ্রাচ্য (ওমান)',
    longitude: 58.4059,
    latitude: 23.5859,
    clicks: 92,
    conversions: 16,
    conversionRate: 17.4,
    totalCommission: 9200,
    topDevice: 'Mobile',
    activeNow: 3,
    tier: 2,
    status: 'STEADY',
    lastConversionTime: '৫০ মিনিট আগে'
  },
  {
    id: 'GEO_KWT',
    name: 'Kuwait City (Kuwait)',
    country: 'Kuwait',
    region: 'ME',
    regionLabel: 'মধ্যপ্রাচ্য (কুয়েত)',
    longitude: 47.9774,
    latitude: 29.3759,
    clicks: 88,
    conversions: 15,
    conversionRate: 17.0,
    totalCommission: 8800,
    topDevice: 'Mobile',
    activeNow: 2,
    tier: 2,
    status: 'STEADY',
    lastConversionTime: '১ ঘণ্টা আগে'
  },

  // South East Asia
  {
    id: 'GEO_KUL',
    name: 'Kuala Lumpur (Malaysia)',
    country: 'Malaysia',
    region: 'SEA',
    regionLabel: 'দক্ষিণ-পূর্ব এশিয়া (মালয়েশিয়া)',
    longitude: 101.6869,
    latitude: 3.1390,
    clicks: 160,
    conversions: 31,
    conversionRate: 19.3,
    totalCommission: 17500,
    topDevice: 'Mobile',
    activeNow: 6,
    tier: 1,
    status: 'HOT',
    lastConversionTime: '১৬ মিনিট আগে'
  },
  {
    id: 'GEO_SIN',
    name: 'Singapore City (Singapore)',
    country: 'Singapore',
    region: 'SEA',
    regionLabel: 'দক্ষিণ-পূর্ব এশিয়া (সিঙ্গাপুর)',
    longitude: 103.8198,
    latitude: 1.3521,
    clicks: 115,
    conversions: 24,
    conversionRate: 20.8,
    totalCommission: 16000,
    topDevice: 'Mobile',
    activeNow: 4,
    tier: 1,
    status: 'HOT',
    lastConversionTime: '২৫ মিনিট আগে'
  },

  // Europe & North America Expats
  {
    id: 'GEO_LON',
    name: 'London & Birmingham (UK)',
    country: 'United Kingdom',
    region: 'EU',
    regionLabel: 'ইউরোপ (যুক্তরাজ্য)',
    longitude: -0.1278,
    latitude: 51.5074,
    clicks: 130,
    conversions: 26,
    conversionRate: 20.0,
    totalCommission: 22000,
    topDevice: 'Desktop',
    activeNow: 5,
    tier: 1,
    status: 'HOT',
    lastConversionTime: '২৯ মিনিট আগে'
  },
  {
    id: 'GEO_NYC',
    name: 'New York & New Jersey (USA)',
    country: 'United States',
    region: 'NA',
    regionLabel: 'উত্তর আমেরিকা (যুক্তরাষ্ট্র)',
    longitude: -74.0060,
    latitude: 40.7128,
    clicks: 98,
    conversions: 18,
    conversionRate: 18.3,
    totalCommission: 15500,
    topDevice: 'Desktop',
    activeNow: 3,
    tier: 2,
    status: 'STEADY',
    lastConversionTime: '১ ঘণ্টা আগে'
  },
  {
    id: 'GEO_TOR',
    name: 'Toronto (Canada)',
    country: 'Canada',
    region: 'NA',
    regionLabel: 'উত্তর আমেরিকা (কানাডা)',
    longitude: -79.3832,
    latitude: 43.6532,
    clicks: 72,
    conversions: 12,
    conversionRate: 16.6,
    totalCommission: 10200,
    topDevice: 'Desktop',
    activeNow: 2,
    tier: 3,
    status: 'EMERGING',
    lastConversionTime: '২ ঘণ্টা আগে'
  }
];

export const AffiliateGeoTrafficScatter: React.FC<AffiliateGeoTrafficScatterProps> = ({
  currency,
  currentUserUsername
}) => {
  const [geoData, setGeoData] = useState<GeoHubPoint[]>(BASE_GEO_HUBS);
  const [selectedRegion, setSelectedRegion] = useState<'ALL' | 'BD' | 'ME' | 'SEA' | 'GLOBAL'>('ALL');
  const [selectedMetric, setSelectedMetric] = useState<'CONVERSIONS' | 'CLICKS' | 'COMMISSION'>('CONVERSIONS');
  const [selectedHub, setSelectedHub] = useState<GeoHubPoint | null>(BASE_GEO_HUBS[0]);
  const [isLivePulsing, setIsLivePulsing] = useState(true);
  const [viewMode, setViewMode] = useState<'SCATTER' | 'RANKING'>('SCATTER');

  // Multiplier for USD / BDT
  const rateMultiplier = currency === 'BDT' ? 1 : 1 / 120;

  // Real-time gentle event listener to bump live clicks/conversions on the map
  useEffect(() => {
    const unsubscribe = referralService.subscribe(() => {
      // Small randomized traffic uptick to highest cluster
      setGeoData((prev) =>
        prev.map((hub) => {
          if (hub.id === 'GEO_DHK' || hub.id === 'GEO_DXB' || hub.id === 'GEO_CTG') {
            const addClick = Math.floor(Math.random() * 2) + 1;
            return {
              ...hub,
              clicks: hub.clicks + addClick,
              activeNow: Math.max(hub.activeNow, hub.activeNow + 1),
              lastConversionTime: 'এইমাত্র'
            };
          }
          return hub;
        })
      );
    });

    return () => unsubscribe();
  }, []);

  // Filtered dataset according to region
  const filteredData = useMemo(() => {
    if (selectedRegion === 'ALL' || selectedRegion === 'GLOBAL') {
      return geoData;
    }
    return geoData.filter((d) => d.region === selectedRegion);
  }, [geoData, selectedRegion]);

  // Totals
  const totals = useMemo(() => {
    const totalClicks = filteredData.reduce((acc, h) => acc + h.clicks, 0);
    const totalConversions = filteredData.reduce((acc, h) => acc + h.conversions, 0);
    const totalCommission = filteredData.reduce((acc, h) => acc + h.totalCommission, 0) * rateMultiplier;
    const avgCr = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0';
    const totalActive = filteredData.reduce((acc, h) => acc + h.activeNow, 0);

    return {
      totalClicks,
      totalConversions,
      totalCommission: Math.round(totalCommission),
      avgCr,
      totalActive
    };
  }, [filteredData, rateMultiplier]);

  // Color mapping based on status or tier
  const getBubbleColor = (hub: GeoHubPoint) => {
    if (hub.status === 'HOT') return '#f59e0b'; // Amber Gold
    if (hub.status === 'STEADY') return '#10b981'; // Emerald Green
    return '#38bdf8'; // Sky Cyan
  };

  // Custom Scatter Tooltip Component
  const CustomScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: GeoHubPoint = payload[0].payload;
      return (
        <div className="bg-[#090e1a]/95 border-2 border-amber-500/60 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl font-mono text-xs max-w-xs space-y-2 pointer-events-none z-50">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-1.5 font-bold text-white">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span className="truncate">{data.name}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-black ${
                data.status === 'HOT'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {data.status} HUB
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[10px]">মোট রূপান্তর (Signups)</div>
              <div className="text-emerald-400 font-bold text-sm mt-0.5">{data.conversions} জন</div>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[10px]">লিংক ক্লিক (Clicks)</div>
              <div className="text-amber-400 font-bold text-sm mt-0.5">{data.clicks}</div>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[10px]">কনভার্সন রেট (CR)</div>
              <div className="text-cyan-300 font-bold text-sm mt-0.5">{data.conversionRate}%</div>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
              <div className="text-slate-400 text-[10px]">মোট কমিশন</div>
              <div className="text-yellow-300 font-bold text-sm mt-0.5">
                {currency === 'BDT' ? `৳${(data.totalCommission * rateMultiplier).toLocaleString()}` : `$${(data.totalCommission * rateMultiplier).toFixed(0)}`}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>{data.activeNow} জন সক্রিয় অনলাইন</span>
            </span>
            <span className="text-slate-500">আপডেট: {data.lastConversionTime}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Coordinates domain based on selection
  const xDomain = useMemo(() => {
    if (selectedRegion === 'BD') return [87.5, 93];
    if (selectedRegion === 'ME') return [44, 60];
    if (selectedRegion === 'SEA') return [98, 106];
    return [-90, 110];
  }, [selectedRegion]);

  const yDomain = useMemo(() => {
    if (selectedRegion === 'BD') return [21, 26.5];
    if (selectedRegion === 'ME') return [21, 31];
    if (selectedRegion === 'SEA') return [0.5, 5.5];
    return [0, 60];
  }, [selectedRegion]);

  return (
    <div className="golden-ratio-card rounded-[28px] overflow-hidden border-2 border-amber-500/40 p-5 sm:p-7 space-y-6 relative bg-gradient-to-b from-[#090d18] via-[#060912] to-[#04060a] shadow-2xl font-sans">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header with Live Status and Region Toggles */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-start space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-0.5 shadow-lg shadow-amber-500/25 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Globe className="w-5 h-5 text-amber-400 animate-spin-slow" />
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>গ্লোবাল ও রিজিওনাল রেফারেল ট্রাফিক ম্যাপ</span>
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-black flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>GEO RADAR SCATTER</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 font-sans mt-0.5">
              বিশ্বব্যাপী আপনার রেফারেল লিংকের লাইভ ক্লিক, ইউজার কনভার্সন ক্লাস্টার ও আয় প্রবাহ ট্র্যাকার
            </p>
          </div>
        </div>

        {/* View Mode & Region Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* Region Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                soundEngine.playClick(900);
                setSelectedRegion('ALL');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedRegion === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🌐 গ্লোবাল
            </button>
            <button
              onClick={() => {
                soundEngine.playClick(900);
                setSelectedRegion('BD');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedRegion === 'BD'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🇧🇩 বাংলাদেশ
            </button>
            <button
              onClick={() => {
                soundEngine.playClick(900);
                setSelectedRegion('ME');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedRegion === 'ME'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🇦🇪 মধ্যপ্রাচ্য
            </button>
            <button
              onClick={() => {
                soundEngine.playClick(900);
                setSelectedRegion('SEA');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                selectedRegion === 'SEA'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🇲🇾 দক্ষিণ-পূর্ব এশিয়া
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                soundEngine.playClick(850);
                setViewMode('SCATTER');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'SCATTER'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ম্যাপ স্ক্যাটার
            </button>
            <button
              onClick={() => {
                soundEngine.playClick(850);
                setViewMode('RANKING');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'RANKING'
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              র‌্যাঙ্কিং ভিউ
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
            <span>মোট কনভার্সন (সাইন-আপ)</span>
            <Users className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-1">
            {totals.totalConversions} জন
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">সব অঞ্চলের সক্রিয় রেজিস্ট্রি</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
            <span>মোট রেফারেল ক্লিক</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300 mt-1">
            {totals.totalClicks.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">গড় CR: {totals.avgCr}%</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
            <span>মোট অর্জিত কমিশন</span>
            <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-transparent bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 bg-clip-text mt-1">
            {currency === 'BDT' ? `৳${totals.totalCommission.toLocaleString()}` : `$${totals.totalCommission.toFixed(0)}`}
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">ইনস্ট্যান্ট ট্রান্সফারেবল</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-bold flex items-center justify-between">
            <span>বর্তমানে সক্রিয় অনলাইন</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-300 mt-1">
            {totals.totalActive} জন প্লেয়ার
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">টার্নওভার জেনারেট হচ্ছে</div>
        </div>
      </div>

      {/* 3. Recharts Scatter Map Visualization Container */}
      {viewMode === 'SCATTER' ? (
        <div className="relative bg-[#03060d] rounded-2xl border border-amber-500/30 p-4 sm:p-5 overflow-hidden">
          {/* Subtle World Map Grid Coordinates Canvas Effect */}
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />
          
          {/* Map Compass & Legend Overlay */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 relative z-10 font-mono text-xs">
            <div className="flex items-center space-x-2 text-[11px] text-slate-300">
              <Compass className="w-4 h-4 text-amber-400 animate-spin-slow" />
              <span className="font-bold">
                কোঅর্ডিনেট গ্রিড: X = Longitude (দ্রাঘিমাংশ), Y = Latitude (অক্ষাংশ)
              </span>
            </div>

            {/* Scatter Legend */}
            <div className="flex items-center space-x-3 text-[10px]">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                <span className="text-slate-300">হটস্পট (শীর্ষ কনভার্সন)</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-slate-300">স্টেডি ট্রাফিক</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span className="text-slate-300">গ্রোইং আউটপোস্ট</span>
              </span>
            </div>
          </div>

          {/* Main Recharts ScatterChart */}
          <div className="h-[340px] sm:h-[400px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 30, bottom: 20, left: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  opacity={0.6}
                />

                <XAxis
                  type="number"
                  dataKey="longitude"
                  name="Longitude"
                  domain={xDomain}
                  unit="°E"
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={{ stroke: '#334155' }}
                  axisLine={{ stroke: '#334155' }}
                />

                <YAxis
                  type="number"
                  dataKey="latitude"
                  name="Latitude"
                  domain={yDomain}
                  unit="°N"
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={{ stroke: '#334155' }}
                  axisLine={{ stroke: '#334155' }}
                />

                {/* ZAxis maps bubble size to Conversion Volume */}
                <ZAxis
                  type="number"
                  dataKey={selectedMetric === 'CONVERSIONS' ? 'conversions' : selectedMetric === 'CLICKS' ? 'clicks' : 'totalCommission'}
                  range={[120, 680]}
                  name="Volume"
                />

                <Tooltip
                  content={<CustomScatterTooltip />}
                  cursor={{ strokeDasharray: '3 3', stroke: '#f59e0b' }}
                />

                <Scatter
                  name="Referral Hubs"
                  data={filteredData}
                  onClick={(node: any) => {
                    if (node && node.payload) {
                      soundEngine.playClick(1000);
                      setSelectedHub(node.payload);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {filteredData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getBubbleColor(entry)}
                      stroke={entry.id === selectedHub?.id ? '#ffffff' : '#030712'}
                      strokeWidth={entry.id === selectedHub?.id ? 2.5 : 1}
                      className="transition-all hover:scale-125 cursor-pointer"
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Interactive Cluster Selector Bar */}
          <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-slate-400 text-[11px]">
              💡 নোডে ক্লিক করে নির্দিষ্ট শহরের বিস্তারিত ইনফো কার্ড ওপেন করুন
            </span>

            <div className="flex items-center space-x-2 text-[11px]">
              <span className="text-slate-400">সাইজ মেট্রিক:</span>
              <button
                onClick={() => setSelectedMetric('CONVERSIONS')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedMetric === 'CONVERSIONS' ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50' : 'text-slate-400'
                }`}
              >
                কনভার্সন ভলিউম
              </button>
              <button
                onClick={() => setSelectedMetric('CLICKS')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedMetric === 'CLICKS' ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50' : 'text-slate-400'
                }`}
              >
                মোট ক্লিক
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Alternative Recharts Bar Chart Breakdown by Hub */
        <div className="bg-[#03060d] rounded-2xl border border-amber-500/30 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4 font-mono text-xs">
            <span className="text-white font-bold flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>শীর্ষ রূপান্তরকারী অঞ্চলসমূহের তালিকা (Top Converting Hubs)</span>
            </span>
            <span className="text-slate-400 text-[11px]">{filteredData.length}টি হাব তালিকাভুক্ত</span>
          </div>

          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...filteredData].sort((a, b) => b.conversions - a.conversions).slice(0, 8)}
                margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                  angle={-15}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-950 border border-amber-500 p-2.5 rounded-xl font-mono text-xs text-white">
                          <div className="font-bold text-amber-400">{data.name}</div>
                          <div className="text-emerald-300">কনভার্সন: {data.conversions} জন</div>
                          <div className="text-slate-300">ক্লিক: {data.clicks}</div>
                          <div className="text-cyan-300">CR: {data.conversionRate}%</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="conversions" fill="#10b981" radius={[6, 6, 0, 0]} name="রূপান্তর" />
                <Bar dataKey="clicks" fill="#f59e0b" radius={[6, 6, 0, 0]} name="ক্লিক" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Selected Hub Deep Drilldown Card */}
      {selectedHub && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0d1424] via-[#090e1a] to-[#0d1424] border-2 border-amber-500/40 font-mono text-xs space-y-3 shadow-lg"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-white font-sans flex items-center space-x-2">
                  <span>{selectedHub.name}</span>
                  <span className="text-[10px] text-amber-400 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                    {selectedHub.regionLabel}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  কোঅর্ডিনেটস: {selectedHub.latitude.toFixed(2)}°N, {selectedHub.longitude.toFixed(2)}°E • প্রধান ডিভাইস: {selectedHub.topDevice}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-start sm:self-center">
              <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{selectedHub.activeNow} জন লাইভ প্লেয়ার</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">রেফারেল সাইন-আপ</div>
              <div className="text-base font-black text-emerald-400 mt-0.5">{selectedHub.conversions} জন</div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">মোট লিংক হিটস</div>
              <div className="text-base font-black text-amber-400 mt-0.5">{selectedHub.clicks} বার</div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">কনভার্সন রেট</div>
              <div className="text-base font-black text-cyan-300 mt-0.5">{selectedHub.conversionRate}%</div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <div className="text-[10px] text-slate-400">কমিশন জেনারেট</div>
              <div className="text-base font-black text-yellow-300 mt-0.5">
                {currency === 'BDT' ? `৳${(selectedHub.totalCommission * rateMultiplier).toLocaleString()}` : `$${(selectedHub.totalCommission * rateMultiplier).toFixed(0)}`}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
