/**
 * @file MobileBottomNav.tsx
 * @description Luxury Emerald & Gold Mobile Navigation Bar for PLAY369:
 * 1. বাড়ি (Home / Lobby)
 * 2. অফার (Offers / Promotions)
 * 3. ক্যাশিয়ার (Center Elevated Deposit / Cashier Action)
 * 4. ভিআইপি / প্রচার (VIP / Affiliate)
 * 5. প্রোফাইল (Profile)
 * Supports Capacitor Safe-Area Insets and minimum 48px touch targets.
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Home,
  Gift,
  Users,
  CreditCard,
  User,
  Crown
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
    <nav
      id="play369-mobile-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#02180e]/95 backdrop-blur-2xl border-t border-emerald-800/80 px-2 pt-1.5 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-10px_30px_rgba(0,0,0,0.85)]"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto relative text-xs">
        
        {/* Tab 1: বাড়ি (Home / Lobby) */}
        <button
          id="play369-mobilenav-lobby"
          onClick={() => handleTabClick('lobby')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'lobby'
              ? 'text-amber-400 font-black scale-105'
              : 'text-emerald-200/70 hover:text-emerald-100 font-medium'
          }`}
          aria-label="Lobby"
        >
          <div className="relative p-0.5">
            <Home className={`w-5 h-5 ${activeTab === 'lobby' ? 'text-amber-400' : 'text-emerald-300/80'}`} />
            {activeTab === 'lobby' && (
              <motion.span
                layoutId="bottomNavIndicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="mt-0.5 text-[11px] font-sans">Lobby</span>
        </button>

        {/* Tab 2: অফার (Offers with Badge) */}
        <button
          id="play369-mobilenav-promo"
          onClick={() => handleTabClick('promo')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'promo'
              ? 'text-amber-400 font-black scale-105'
              : 'text-emerald-200/70 hover:text-emerald-100 font-medium'
          }`}
          aria-label="Offers & Promotions"
        >
          <div className="relative p-0.5">
            <Gift className={`w-5 h-5 ${activeTab === 'promo' ? 'text-amber-400' : 'text-emerald-300/80'}`} />
            <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-mono text-[9px] font-black shadow-[0_0_8px_rgba(245,158,11,0.6)]">
              HOT
            </span>
            {activeTab === 'promo' && (
              <motion.span
                layoutId="bottomNavIndicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="mt-0.5 text-[11px] font-sans">Offers</span>
        </button>

        {/* Tab 3: জমা / ক্যাশিয়ার (Center Elevated Deposit / Cashier Button) */}
        <div className="relative -top-4 flex flex-col items-center">
          <button
            id="play369-mobilenav-deposit"
            onClick={() => {
              soundEngine.playClick(1200);
              onOpenCashier();
            }}
            className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 text-slate-950 flex flex-col items-center justify-center shadow-[0_6px_22px_rgba(245,158,11,0.45)] border-2 border-[#02180e] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
            aria-label="Deposit / Cashier"
          >
            <span className="absolute -top-2.5 px-2 py-0.5 rounded-full bg-emerald-600 border border-emerald-400 text-white font-mono text-[8px] font-black shadow-md uppercase tracking-wider">
              Deposit
            </span>
            <CreditCard className="w-5 h-5 stroke-[2.5]" />
            <span className="text-[10px] font-black uppercase tracking-tight leading-none mt-0.5">জমা</span>
          </button>
        </div>

        {/* Tab 4: প্রচার / ভিআইপি (VIP & Affiliate) */}
        <button
          id="play369-mobilenav-vip"
          onClick={() => handleTabClick('vip')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'vip'
              ? 'text-amber-400 font-black scale-105'
              : 'text-emerald-200/70 hover:text-emerald-100 font-medium'
          }`}
          aria-label="VIP Club"
        >
          <div className="relative p-0.5">
            <Crown className={`w-5 h-5 ${activeTab === 'vip' ? 'text-amber-400' : 'text-emerald-300/80'}`} />
            {activeTab === 'vip' && (
              <motion.span
                layoutId="bottomNavIndicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="mt-0.5 text-[11px] font-sans">VIP</span>
        </button>

        {/* Tab 5: প্রোফাইল (Profile) */}
        <button
          id="play369-mobilenav-profile"
          onClick={() => handleTabClick('profile')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 rounded-xl transition-all relative cursor-pointer ${
            activeTab === 'profile'
              ? 'text-amber-400 font-black scale-105'
              : 'text-emerald-200/70 hover:text-emerald-100 font-medium'
          }`}
          aria-label="Player Profile"
        >
          <div className="relative p-0.5">
            <User className={`w-5 h-5 ${activeTab === 'profile' ? 'text-amber-400' : 'text-emerald-300/80'}`} />
            {activeTab === 'profile' && (
              <motion.span
                layoutId="bottomNavIndicator"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span className="mt-0.5 text-[11px] font-sans">Profile</span>
        </button>

      </div>
    </nav>
  );
};

