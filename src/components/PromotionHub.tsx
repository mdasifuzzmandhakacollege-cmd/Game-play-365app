import React, { useState } from 'react';
import {
  Gift,
  Sparkles,
  Calendar,
  RotateCcw,
  Crown,
  Check,
  Lock,
  Target
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { DAILY_CHECKIN_REWARDS, WHEEL_PRIZES } from '../shared/gameplayConfig';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { WageringRequirements } from './WageringRequirements';
import { DailyMissions } from './DailyMissions';

interface PromotionHubProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onRewardClaimed: () => void;
}

export const PromotionHub: React.FC<PromotionHubProps> = ({
  currentUser,
  currentWallet,
  currency,
  onRewardClaimed
}) => {
  // Check in state
  const [currentStreak, setCurrentStreak] = useState<number>(3);
  const [hasCheckedInToday, setHasCheckedInToday] = useState<boolean>(false);
  const [checkInLoading, setCheckInLoading] = useState<boolean>(false);

  // Wheel Spin state
  const [spinning, setSpinning] = useState<boolean>(false);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [spinsRemaining, setSpinsRemaining] = useState<number>(3);
  const [wonPrize, setWonPrize] = useState<typeof WHEEL_PRIZES[0] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Handle Daily Check In
  const handleCheckIn = () => {
    if (hasCheckedInToday) return;
    setCheckInLoading(true);

    setTimeout(() => {
      const nextDay = (currentStreak % 7) + 1;
      const rewardConfig = DAILY_CHECKIN_REWARDS.find((r) => r.day === nextDay) || DAILY_CHECKIN_REWARDS[0];

      // Credit bonus to wallet
      seamlessEngine.topUpWallet(currentUser.id, currentUser.currency, rewardConfig.reward);
      setCurrentStreak(nextDay);
      setHasCheckedInToday(true);
      setCheckInLoading(false);
      setToast(`অভিনন্দন! ডে ${nextDay} ডেইলি চেক-ইন বোনাস ৳${rewardConfig.reward} সফলভাবে যোগ হয়েছে!`);
      onRewardClaimed();
      setTimeout(() => setToast(null), 4000);
    }, 700);
  };

  // Handle Wheel Spin
  const handleSpinWheel = () => {
    if (spinning || spinsRemaining <= 0) return;
    setSpinning(true);
    setWonPrize(null);

    // Pick random prize from weighted prizes
    const prizeIndex = Math.floor(Math.random() * WHEEL_PRIZES.length);
    const selectedPrize = WHEEL_PRIZES[prizeIndex];

    const extraSpins = 5 * 360;
    const sliceAngle = 360 / WHEEL_PRIZES.length;
    const targetAngle = extraSpins + (360 - prizeIndex * sliceAngle);

    setWheelRotation((prev) => prev + targetAngle);

    setTimeout(() => {
      setSpinning(false);
      setSpinsRemaining((prev) => prev - 1);
      setWonPrize(selectedPrize);

      if (selectedPrize.value > 0) {
        seamlessEngine.topUpWallet(currentUser.id, currentUser.currency, selectedPrize.value);
        setToast(`লাকি স্পিন উইন! আপনি জিতেছেন: ${selectedPrize.label}`);
        onRewardClaimed();
        setTimeout(() => setToast(null), 4000);
      }
    }, 3500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8 pb-24 lg:pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 font-mono text-xs animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* 1. Daily Missions & Task Completion Rewards Engine */}
      <DailyMissions
        currentUser={currentUser}
        currentWallet={currentWallet}
        currency={currency}
        onMissionClaimed={onRewardClaimed}
      />

      {/* 2. Dynamic Wagering Requirement & Rollover Turnover Component */}
      <WageringRequirements
        currentUser={currentUser}
        currentWallet={currentWallet}
        currency={currency}
        onConversionSuccess={onRewardClaimed}
      />

      {/* 3. 2-Column Grid: 7-Day Daily Check-In + Lucky Wheel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: 7-Day Streak Check-In */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 font-mono text-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase">৭-দিনের ডেইলি চেক-ইন স্ট্রিক</h2>
            </div>
            <span className="text-[10px] text-amber-300 font-bold">Streak: Day {currentStreak}/7</span>
          </div>

          {/* 7 Days Reward Grid */}
          <div className="grid grid-cols-4 gap-2">
            {DAILY_CHECKIN_REWARDS.map((item) => {
              const isClaimed = item.day <= currentStreak && hasCheckedInToday;
              const isToday = item.day === (hasCheckedInToday ? currentStreak : currentStreak + 1);

              return (
                <div
                  key={item.day}
                  className={`relative p-3 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                    isClaimed
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : isToday
                      ? 'bg-amber-500/20 border-amber-500 shadow-md shadow-amber-500/20 text-white animate-pulse'
                      : 'bg-slate-950/70 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="text-[10px] font-bold">ডে {item.day}</div>
                  <div className="my-1.5 text-xs font-black text-amber-400">
                    ৳{item.reward.toLocaleString()}
                  </div>
                  <div className="text-[9px]">
                    {isClaimed ? (
                      <Check className="w-4 h-4 mx-auto text-emerald-400" />
                    ) : isToday ? (
                      <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px]">
                        আজকের
                      </span>
                    ) : (
                      <Lock className="w-4 h-4 mx-auto text-slate-700" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleCheckIn}
            disabled={hasCheckedInToday || checkInLoading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {hasCheckedInToday
                ? 'আজকের চেক-ইন ক্লেইম করা হয়েছে (Tomorrow at 00:00)'
                : checkInLoading
                ? 'ক্লেইম হচ্ছে...'
                : 'আজকের রিওয়ার্ড ক্লেইম করুন'}
            </span>
          </button>
        </div>

        {/* Right Column: Lucky Spin-the-Wheel */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 font-mono text-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <RotateCcw className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white uppercase">লাকি ফরচুন হুইল (Spin &amp; Win)</h2>
            </div>
            <span className="text-[10px] text-purple-300 font-bold">100% Provably Fair RNG</span>
          </div>

          {/* Wheel Graphic Container */}
          <div className="relative flex items-center justify-center py-4">
            {/* Pointer Marker */}
            <div className="absolute top-0 z-20 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-amber-400 drop-shadow-md" />

            {/* Rotating Wheel Disk */}
            <div
              className="w-56 h-56 sm:w-64 sm:h-64 rounded-full border-4 border-amber-500/60 shadow-2xl relative overflow-hidden transition-transform duration-[3500ms] ease-out flex items-center justify-center"
              style={{
                transform: `rotate(${wheelRotation}deg)`,
                background: 'conic-gradient(#f59e0b 0deg 45deg, #06b6d4 45deg 90deg, #a855f7 90deg 135deg, #10b981 135deg 180deg, #3b82f6 180deg 225deg, #ec4899 225deg 270deg, #eab308 270deg 315deg, #6366f1 315deg 360deg)'
              }}
            >
              {/* Wheel Center Cap */}
              <div className="w-16 h-16 rounded-full bg-slate-950 border-2 border-amber-400 flex items-center justify-center z-10 shadow-xl">
                <Crown className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>

          {/* Spin Action & Result */}
          <div className="space-y-2">
            {wonPrize && (
              <div className="p-3 bg-purple-500/20 border border-purple-500/40 rounded-xl text-center text-purple-300 font-bold animate-pulse">
                🎉 আপনি জিতেছেন: {wonPrize.label}!
              </div>
            )}

            <button
              onClick={handleSpinWheel}
              disabled={spinning || spinsRemaining <= 0}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500 text-white font-black text-xs shadow-lg shadow-purple-500/25 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
            >
              <RotateCcw className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
              <span>{spinning ? 'হুইল ঘুরছে...' : `স্পিন করুন (${spinsRemaining} স্পিন বাকি)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
