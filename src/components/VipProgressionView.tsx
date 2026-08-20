import React, { useState } from 'react';
import {
  Crown,
  Sparkles,
  Shield,
  Award,
  Zap,
  CheckCircle2,
  Lock,
  Gift,
  ArrowRight,
  TrendingUp,
  Percent,
  Clock,
  Headphones
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { VIP_TIER_CONFIG } from '../shared/gameplayConfig';
import { seamlessEngine } from '../services/simulatedWalletEngine';

interface VipProgressionViewProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onBonusClaimed: () => void;
}

export const VipProgressionView: React.FC<VipProgressionViewProps> = ({
  currentUser,
  currentWallet,
  currency,
  onBonusClaimed
}) => {
  const [claimedLevels, setClaimedLevels] = useState<number[]>([1, 2, 3]);
  const [claimingLevel, setClaimingLevel] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Active user level (Default: 4 Gold VIP)
  const currentLevel = 4;
  const currentTier = VIP_TIER_CONFIG.find((t) => t.level === currentLevel) || VIP_TIER_CONFIG[3];
  const nextTier = VIP_TIER_CONFIG.find((t) => t.level === currentLevel + 1) || VIP_TIER_CONFIG[4];

  // Progress metrics
  const cumulativeDeposit = currentUser.currency === 'BDT' ? 185000 : 1850;
  const cumulativeBet = currentUser.currency === 'BDT' ? 820000 : 8200;

  const depositProgress = Math.min(100, Math.round((cumulativeDeposit / nextTier.minDeposit) * 100));
  const betProgress = Math.min(100, Math.round((cumulativeBet / nextTier.minBet) * 100));

  const handleClaimBonus = (tier: typeof VIP_TIER_CONFIG[0]) => {
    if (claimedLevels.includes(tier.level)) return;
    setClaimingLevel(tier.level);

    setTimeout(() => {
      seamlessEngine.topUpWallet(currentUser.id, currentUser.currency, tier.bonus);
      setClaimedLevels([...claimedLevels, tier.level]);
      setClaimingLevel(null);
      setToast(
        `অভিনন্দন! ${tier.name} লেভেল-আপ বোনাস ${currentUser.currency === 'BDT' ? '৳' : '$'}${tier.bonus.toLocaleString()} আপনার ওয়ালেটে জমা হয়েছে!`
      );
      onBonusClaimed();
      setTimeout(() => setToast(null), 4000);
    }, 700);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner: Current VIP Tier Badge & Level Up Progress */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-950/40 border border-amber-500/40 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-[2px] shadow-xl shadow-amber-500/30">
              <div className="w-full h-full bg-[#07090e] rounded-[14px] flex items-center justify-center">
                <Crown className="w-8 h-8 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold tracking-widest text-amber-300 uppercase">
                  GAMEPLAY365 VIP CLUB
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] font-mono uppercase">
                  ACTIVE
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white font-sans mt-0.5">
                {currentTier.name} (লেভেল {currentLevel})
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                দৈনিক ক্যাশব্যাক: <strong>{(currentTier.cashback * 100).toFixed(1)}%</strong> • দৈনিক পে-আউট লিমিট: <strong>৳{currentTier.payoutLimit.toLocaleString()}</strong>
              </p>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl font-mono text-right shrink-0">
            <div className="text-[10px] text-slate-400 uppercase">পরবর্তী টিয়ার: {nextTier.name}</div>
            <div className="text-xl font-black text-amber-300 mt-1">
              +{currency === 'BDT' ? '৳' : '$'}{nextTier.bonus.toLocaleString()} বোনাস আনলক
            </div>
            <div className="text-[10px] text-emerald-400 mt-1">{(nextTier.cashback * 100).toFixed(1)}% দৈনিক ক্যাশব্যাক</div>
          </div>
        </div>

        {/* Dual Progress Bars: Deposit & Bet Turnover */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs pt-2">
          {/* Cumulative Deposit Progress */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>ক্রমপুঞ্জিত ডিপোজিট (Deposit Threshold)</span>
              </span>
              <span className="text-amber-400 font-bold">{depositProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${depositProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>৳{cumulativeDeposit.toLocaleString()}</span>
              <span>লক্ষ্য: ৳{nextTier.minDeposit.toLocaleString()}</span>
            </div>
          </div>

          {/* Cumulative Bet Turnover Progress */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center space-x-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>ভ্যালিড বেট টার্নওভার (Bet Turnover)</span>
              </span>
              <span className="text-cyan-400 font-bold">{betProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${betProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>৳{cumulativeBet.toLocaleString()}</span>
              <span>লক্ষ্য: ৳{nextTier.minBet.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-mono flex items-center space-x-2 animate-bounce">
          <Sparkles className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* V1 to V10 VIP Tier Ladder Grid */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>V1 হতে V10 ভিআইপি লেডার ও রিওয়ার্ডস</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              প্রতিটি লেভেল আপগ্রেডে নিশ্চিত ক্যাশ বোনাস এবং আজীবন ক্যাশব্যাক সুবিধা।
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-mono text-xs">
          {VIP_TIER_CONFIG.map((tier) => {
            const isCurrent = tier.level === currentLevel;
            const isUnlocked = tier.level <= currentLevel;
            const isClaimed = claimedLevels.includes(tier.level);

            return (
              <div
                key={tier.level}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  isCurrent
                    ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10'
                    : isUnlocked
                    ? 'bg-slate-950/80 border-slate-800'
                    : 'bg-slate-950/40 border-slate-800/50 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white">{tier.name}</span>
                    {isUnlocked ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Lock className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                  <div className="text-[10px] text-amber-400 font-bold mt-1">
                    লেভেল বোনাস: +৳{tier.bonus.toLocaleString()}
                  </div>
                </div>

                <div className="space-y-1 text-[10px] text-slate-400 border-t border-slate-800/80 pt-2">
                  <div>ডিপোজিট: ৳{tier.minDeposit.toLocaleString()}</div>
                  <div>টার্নওভার: ৳{tier.minBet.toLocaleString()}</div>
                  <div className="text-emerald-400">ক্যাশব্যাক: {(tier.cashback * 100).toFixed(1)}%</div>
                </div>

                {isUnlocked ? (
                  isClaimed ? (
                    <button
                      disabled
                      className="w-full py-1.5 rounded-xl bg-slate-800 text-slate-500 text-[10px] font-bold cursor-not-allowed"
                    >
                      ক্লেইমড (Claimed)
                    </button>
                  ) : (
                    <button
                      onClick={() => handleClaimBonus(tier)}
                      disabled={claimingLevel === tier.level}
                      className="w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-[10px] font-black shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      {claimingLevel === tier.level ? 'ক্লেইম হচ্ছে...' : 'বোনাস নিন'}
                    </button>
                  )
                ) : (
                  <div className="w-full py-1.5 rounded-xl bg-slate-900 text-slate-600 text-[10px] font-bold text-center">
                    লকড (Locked)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
