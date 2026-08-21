/**
 * @file AgentTree.tsx
 * @description Hierarchical Referral Downline & Commission Network Tree for GamePlay365.
 * Visualizes Multi-Tier Affiliate Hierarchy: Tier A (Direct Leader) -> Tier B1/B2 (Sub-Agents)
 * -> Tier C1/C2/C3 (Player Downline) using CSS flexbox connectors, interactive node badges,
 * and transparent mathematical breakdown of turnover and revenue shares.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  Users,
  Share2,
  DollarSign,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  ShieldCheck,
  CheckCircle2,
  Zap,
  ArrowDown
} from 'lucide-react';
import { soundEngine } from '../services/soundEngine';

interface AgentNode {
  id: string;
  name: string;
  role: string;
  tier: 'A' | 'B' | 'C';
  rate: string; // e.g. "10%"
  turnover: number;
  commission: number;
  activePlayers: number;
  status: 'ONLINE' | 'ACTIVE';
  avatar: string;
  children?: AgentNode[];
}

interface AgentTreeProps {
  currentUserUsername: string;
  currency: 'BDT' | 'USD';
}

export const AgentTree: React.FC<AgentTreeProps> = ({
  currentUserUsername,
  currency
}) => {
  const rateMultiplier = currency === 'BDT' ? 1 : 1 / 120;
  const [selectedNode, setSelectedNode] = useState<AgentNode | null>(null);

  // Complete Multi-Tier Hierarchy Data
  const treeData: AgentNode = {
    id: 'TIER_A_ME',
    name: `${currentUserUsername} (You - Super Agent)`,
    role: 'Tier A • Master Affiliate Leader',
    tier: 'A',
    rate: '10.0%',
    turnover: 350000,
    commission: 35000,
    activePlayers: 48,
    status: 'ONLINE',
    avatar: '👑',
    children: [
      {
        id: 'TIER_B_1',
        name: 'Agent_Rahim_BD',
        role: 'Tier B1 • Senior Sub-Agent (Direct)',
        tier: 'B',
        rate: '4.0%',
        turnover: 180000,
        commission: 7200,
        activePlayers: 22,
        status: 'ONLINE',
        avatar: '💎',
        children: [
          {
            id: 'TIER_C_1',
            name: 'Player_Karim07',
            role: 'Tier C1 • Player Downline',
            tier: 'C',
            rate: '2.0%',
            turnover: 65000,
            commission: 1300,
            activePlayers: 1,
            status: 'ONLINE',
            avatar: '🎯'
          },
          {
            id: 'TIER_C_2',
            name: 'Player_Sumon_VIP',
            role: 'Tier C2 • Player Downline',
            tier: 'C',
            rate: '2.0%',
            turnover: 85000,
            commission: 1700,
            activePlayers: 1,
            status: 'ACTIVE',
            avatar: '🎰'
          }
        ]
      },
      {
        id: 'TIER_B_2',
        name: 'Agent_Tanvir_DHK',
        role: 'Tier B2 • Senior Sub-Agent (Direct)',
        tier: 'B',
        rate: '4.0%',
        turnover: 120000,
        commission: 4800,
        activePlayers: 16,
        status: 'ONLINE',
        avatar: '⚡',
        children: [
          {
            id: 'TIER_C_3',
            name: 'Player_Rashed99',
            role: 'Tier C3 • Player Downline',
            tier: 'C',
            rate: '2.0%',
            turnover: 50000,
            commission: 1000,
            activePlayers: 1,
            status: 'ONLINE',
            avatar: '🔥'
          }
        ]
      }
    ]
  };

  const totalNetworkTurnover = 350000 * rateMultiplier;
  const totalNetworkCommission = (35000 + 7200 + 4800 + 1300 + 1700 + 1000) * rateMultiplier;

  return (
    <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#021a10] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-6 text-white font-sans shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-800/80 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-emerald-950 rounded-[10px] flex items-center justify-center">
              <Share2 className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                মাল্টি-লেভেল এজেন্ট ও রেফারেল ট্রি
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-mono font-black border border-amber-400/40 uppercase">
                TIER A ➜ B ➜ C
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              আপনার ডাউনলাইন এজেন্ট ও খেলোয়াড়দের স্ট্রাকচার্ড হায়ারার্কি ও রিয়েল-টাইম কমিশন প্রবাহ
            </p>
          </div>
        </div>

        {/* Total Network Stats Badge */}
        <div className="flex items-center space-x-3 bg-emerald-950/80 px-4 py-2 rounded-xl border border-amber-400/30">
          <div>
            <div className="text-[10px] text-emerald-300 uppercase font-bold">মোট নেটওয়ার্ক টার্নওভার</div>
            <div className="text-sm font-black text-amber-300 font-mono">
              {currency === 'BDT' ? '৳' : '$'}{Math.round(totalNetworkTurnover).toLocaleString()}
            </div>
          </div>
          <div className="h-6 w-px bg-emerald-800" />
          <div>
            <div className="text-[10px] text-emerald-300 uppercase font-bold">মোট কমিশন আয়</div>
            <div className="text-sm font-black text-emerald-300 font-mono">
              {currency === 'BDT' ? '৳' : '$'}{Math.round(totalNetworkCommission).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Tree Hierarchical Flow Container */}
      <div className="overflow-x-auto pb-4 pt-2">
        <div className="min-w-[620px] flex flex-col items-center space-y-4 relative">
          
          {/* TIER A NODE (ROOT - SUPER AGENT / YOU) */}
          <div className="flex flex-col items-center">
            <motion.div
              whileHover={{ scale: 1.02 }}
              onClick={() => {
                soundEngine.playClick(900);
                setSelectedNode(treeData);
              }}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-900 to-amber-500/20 border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)] flex items-center space-x-4 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center text-xl font-bold shadow-md">
                {treeData.avatar}
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-black text-white">{treeData.name}</span>
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                    TIER A (10%)
                  </span>
                </div>
                <div className="text-xs text-emerald-200/80 font-mono mt-0.5 flex items-center space-x-3">
                  <span>টার্নওভার: {currency === 'BDT' ? '৳' : '$'}{(treeData.turnover * rateMultiplier).toLocaleString()}</span>
                  <span className="text-amber-300 font-bold">কমিশন: +{currency === 'BDT' ? '৳' : '$'}{(treeData.commission * rateMultiplier).toLocaleString()}</span>
                  <span className="text-emerald-400">({treeData.activePlayers} প্লেয়ার)</span>
                </div>
              </div>
            </motion.div>

            {/* Connecting Vertical Line */}
            <div className="w-0.5 h-6 bg-gradient-to-b from-amber-400 to-emerald-500 my-0.5" />
          </div>

          {/* HORIZONTAL CONNECTOR FOR TIER B */}
          <div className="w-2/3 h-0.5 bg-emerald-500 relative flex justify-between">
            <div className="w-0.5 h-4 bg-emerald-500 absolute left-0 top-0" />
            <div className="w-0.5 h-4 bg-emerald-500 absolute right-0 top-0" />
          </div>

          {/* TIER B ROW (SUB-AGENTS) */}
          <div className="grid grid-cols-2 gap-8 w-full max-w-2xl pt-2">
            {treeData.children?.map((subAgent) => (
              <div key={subAgent.id} className="flex flex-col items-center space-y-3">
                {/* Node Card */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  onClick={() => {
                    soundEngine.playClick(900);
                    setSelectedNode(subAgent);
                  }}
                  className="w-full p-4 rounded-xl bg-emerald-900/80 border-2 border-emerald-500 hover:border-amber-400 transition-all cursor-pointer shadow-md"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-700 flex items-center justify-center text-lg shrink-0">
                      {subAgent.avatar}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold text-white truncate">{subAgent.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-amber-300 text-[9px] font-black border border-amber-400/30 shrink-0">
                          TIER B (4%)
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-200/80 font-mono mt-0.5">
                        টার্নওভার: {currency === 'BDT' ? '৳' : '$'}{(subAgent.turnover * rateMultiplier).toLocaleString()}
                      </div>
                      <div className="text-[11px] text-amber-300 font-mono font-bold">
                        কমিশন: +{currency === 'BDT' ? '৳' : '$'}{(subAgent.commission * rateMultiplier).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Connecting Line to Tier C */}
                <div className="w-0.5 h-5 bg-emerald-600" />

                {/* TIER C CHILDREN (PLAYERS) */}
                <div className="w-full space-y-2">
                  {subAgent.children?.map((player) => (
                    <motion.div
                      key={player.id}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => {
                        soundEngine.playClick(900);
                        setSelectedNode(player);
                      }}
                      className="p-2.5 rounded-lg bg-emerald-950/90 border border-emerald-700/60 hover:border-amber-400/60 flex items-center justify-between text-xs cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-base">{player.avatar}</span>
                        <div>
                          <div className="font-bold text-white text-[11px]">{player.name}</div>
                          <div className="text-[10px] text-emerald-300/80 font-mono">
                            টার্নওভার: {currency === 'BDT' ? '৳' : '$'}{(player.turnover * rateMultiplier).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-900 text-amber-300 text-[9px] font-bold">
                          2% Tier C
                        </span>
                        <div className="text-emerald-300 font-bold text-[11px] mt-0.5">
                          +{currency === 'BDT' ? '৳' : '$'}{(player.commission * rateMultiplier).toLocaleString()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Math Formula & Explanation Breakdown */}
      <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800/80 space-y-2 text-xs">
        <div className="flex items-center space-x-2 text-amber-300 font-bold">
          <Info className="w-4 h-4" />
          <span>কমিশন হিসাব ফর্মুলা ও রেভিনিউ স্প্লিট (Transparent Math Breakdown):</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-[11px]">
          <div className="bg-emerald-900/40 p-2.5 rounded-lg border border-emerald-700/40">
            <span className="font-bold text-amber-300">লেভেল ১ (Tier A): ১০.০%</span>
            <p className="text-emerald-200/80 mt-0.5">
              আপনার সরাসরি রেফারেল করা প্লেয়ারদের মোট গেম স্পিন বা বেটিং টার্নওভার থেকে ১০%।
            </p>
          </div>
          <div className="bg-emerald-900/40 p-2.5 rounded-lg border border-emerald-700/40">
            <span className="font-bold text-emerald-300">লেভেল ২ (Tier B): ৪.০%</span>
            <p className="text-emerald-200/80 mt-0.5">
              আপনার সাব-এজেন্টদের তৈরি করা মোট নেটওয়ার্ক টার্নওভার থেকে ৪% প্যাসিভ ওভাররাইড।
            </p>
          </div>
          <div className="bg-emerald-900/40 p-2.5 rounded-lg border border-emerald-700/40">
            <span className="font-bold text-cyan-300">লেভেল ৩ (Tier C): ২.০%</span>
            <p className="text-emerald-200/80 mt-0.5">
              ডাউনলাইন মেম্বারদের প্লেয়ার অ্যাক্টিভিটি থেকে অটোমেটিক ২% লাইফটাইম কমিশন।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
