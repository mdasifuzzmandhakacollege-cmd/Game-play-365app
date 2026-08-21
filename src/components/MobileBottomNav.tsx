/**
 * @file MobileBottomNav.tsx
 * @description Asian-market Emerald & Gold Mobile Navigation Bar for GamePlay365:
 * 1. বাড়ি (Home/Lobby)
 * 2. অফার (Offers/Promo with 19 count)
 * 3. জমা (Deposit/Cashier with +5% tag)
 * 4. প্রচার (Promotion/Affiliate)
 * 5. প্রোফাইল (Profile)
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  Gift,
  Users,
  CreditCard,
  User
} from 'lucide-react';
import { MainNavTab } from '../contexts/WalletGameContext';
import { soundEngine } from '../services/soundEngine';

interface MobileBottomNavProps {
  activeTab: MainNavTab;
  setActiveTab: (tab: MainNavTab) => void;
  onOpenCashier: () => void;
  unclaimedCommissionCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenCashier
}) => {
  const handleTabClick = (tab: MainNavTab) => {
    soundEngine.playClick(1000);
    setActiveTab(tab);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-emerald-950/95 backdrop-blur-2xl border-t border-emerald-800/90 px-2 py-1.5 shadow-[0_-10px_25px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-around max-w-md mx-auto relative text-xs">
        
        {/* Tab 1: বাড়ি (Home / Lobby) */}
        <button
          onClick={() => handleTabClick('lobby')}
          className={`flex flex-col items-center justify-center min-w-[54px] py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'lobby'
              ? 'text-amber-400 font-black scale-105'
              : 'text-emerald-300/70 hover:text-emerald-100 font-medium'
          }`}
        >
          <div className="relative p-0.5">
            <Home className={`w-5 h-5 ${activeTab === 'lobby' ? 'text-amber-400' : 'text-emerald-300/70'}`} />
            {activeTab === 'lobby' && (
              <motion.span
                layoutId="bottomNavIndicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-amber-400"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="mt-0.5 text-[11px]">বাড়ি</span>
        </button>

        {/* Tab 2: অফার (Offers with 19 Badge) */}
        <button
          onClick={() => handleTabClick('promo')}
          className={`flex flex-col items-center justify-center min-w-[54px] py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'promo'
              ? 'text-amber-300 font-black scale-105'
              : 'text-emerald-300/70 hover:text-emerald-100 font-medium'
          }`}
        >
          <div className="relative p-0.5">
            <Gift className={`w-5 h-5 ${activeTab === 'promo' ? 'text-amber-300' : 'text-emerald-300/70'}`} />
            <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full bg-amber-400 text-slate-950 font-mono text-[8px] font-black">
              19
            </span>
            {activeTab === 'promo' && (
              <motion.span
                layoutId="bottomNavIndicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-amber-400"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="mt-0.5 text-[11px]">অফার</span>
        </button>

        {/* Tab 3: জমা (Center Elevated Deposit / Cashier Button) */}
        <div className="relative -top-4 flex flex-col items-center">
          <button
            onClick={() => {
              soundEngine.playClick(1200);
              onOpenCashier();
            }}
            className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-500 text-slate-950 flex flex-col items-center justify-center shadow-[0_6px_20px_rgba(245,158,11,0.55)] border-2 border-emerald-950 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
          >
            <span className="absolute -top-2.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white font-mono text-[8px] font-black shadow-md uppercase tracking-wider">
              +৫% জমা
            </span>
            <CreditCard className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[10px] font-black uppercase tracking-tight leading-none mt-0.5">জমা</span>
          </button>
        </div>

        {/* Tab 4: প্রচার (Promotion / Affiliate MLM) */}
        <button
          onClick={() => handleTabClick('affiliate')}
          className={`flex flex-col items-center justify-center min-w-[54px] py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'affiliate'
              ? 'text-amber-400 font-black scale-105'
              : 'text-emerald-300/70 hover:text-emerald-100 font-medium'
          }`}
        >
          <div className="relative p-0.5">
            <Users className={`w-5 h-5 ${activeTab === 'affiliate' ? 'text-amber-400' : 'text-emerald-300/70'}`} />
            {activeTab === 'affiliate' && (
              <motion.span
                layoutId="bottomNavIndicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-amber-400"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="mt-0.5 text-[11px]">প্রচার</span>
        </button>

        {/* Tab 5: প্রোফাইল (Profile) */}
        <button
          onClick={() => handleTabClick('profile')}
          className={`flex flex-col items-center justify-center min-w-[54px] py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'profile'
              ? 'text-amber-400 font-black scale-105'
              : 'text-emerald-300/70 hover:text-emerald-100 font-medium'
          }`}
        >
          <div className="relative p-0.5">
            <User className={`w-5 h-5 ${activeTab === 'profile' ? 'text-amber-400' : 'text-emerald-300/70'}`} />
            {activeTab === 'profile' && (
              <motion.span
                layoutId="bottomNavIndicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-amber-400"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="mt-0.5 text-[11px]">প্রোফাইল</span>
        </button>

      </div>
    </div>
  );
};
