/**
 * @file CashierView.tsx
 * @description Master Deposit, Withdrawal & Automated Payment Gateway Vault for Gameplay 365.
 * Features:
 *  - 2-Step Automated Deposit Flow with dynamic Number Pool rotation & 15-min Intent creation
 *  - 8-Point Automatic Verification Engine with duplicate TrxID prevention & atomic wallet credit
 *  - Controlled Withdrawal Flow with balance reservation (WITHDRAWAL_RESERVED) & automated payout
 *  - Double-Entry Ledger & Real-time Audit logs
 *  - Emerald & Gold Premium Asian Luxury Theme
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Coins,
  Receipt,
  RotateCw,
  Search,
  ExternalLink,
  ChevronRight,
  Zap,
  Lock,
  Wallet,
  Building,
  Smartphone,
  Info,
  RefreshCw,
  AlertTriangle,
  FileText,
  HelpCircle,
  Layers,
  ArrowRight
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import {
  PaymentProviderId,
  PaymentMethod,
  DepositIntent,
  WithdrawalRecord,
  DoubleEntryLedgerEntry,
  PaymentDestinationAccount
} from '../server/types/paymentGateway';
import { paymentGatewayEngine } from '../services/paymentGatewayEngine';
import { notificationService } from '../services/notificationService';
import { soundEngine } from '../services/soundEngine';
import { useWalletGame } from '../contexts/WalletGameContext';
import { motion, AnimatePresence } from 'framer-motion';

interface CashierViewProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onLedgerMutated: () => void;
  onClose?: () => void;
}

interface PaymentChannelMeta {
  provider: PaymentProviderId;
  method: PaymentMethod;
  name: string;
  banglaName: string;
  accentColor: string;
  badgeColor: string;
  fee: string;
  minBDT: number;
  maxBDT: number;
  icon: string;
}

const PAYMENT_CHANNELS: PaymentChannelMeta[] = [
  {
    provider: 'bkash',
    method: 'BKASH',
    name: 'bKash (বিকাশ)',
    banglaName: 'মার্চেন্ট পেমেন্ট / ক্যাশ-আউট',
    accentColor: '#E2136E',
    badgeColor: 'bg-[#E2136E]/20 text-[#E2136E] border-[#E2136E]/40',
    fee: '০% ফি (ফ্রি)',
    minBDT: 500,
    maxBDT: 50000,
    icon: 'BK'
  },
  {
    provider: 'nagad',
    method: 'NAGAD',
    name: 'Nagad (নগদ)',
    banglaName: 'এজেন্ট ক্যাশ-আউট / ডিরেক্ট ওয়ালেট',
    accentColor: '#F7941D',
    badgeColor: 'bg-[#F7941D]/20 text-[#F7941D] border-[#F7941D]/40',
    fee: '০% ফি (ফ্রি)',
    minBDT: 500,
    maxBDT: 50000,
    icon: 'NG'
  },
  {
    provider: 'rocket',
    method: 'ROCKET',
    name: 'Rocket (রকেট)',
    banglaName: 'ডিবিবিএল বিলার / মোবাইল ব্যাংকিং',
    accentColor: '#8C3494',
    badgeColor: 'bg-[#8C3494]/20 text-[#8C3494] border-[#8C3494]/40',
    fee: '০% ফি (ফ্রি)',
    minBDT: 500,
    maxBDT: 50000,
    icon: 'RK'
  },
  {
    provider: 'bank_transfer',
    method: 'BANK_TRANSFER',
    name: 'Bank Transfer (ব্যাংক)',
    banglaName: 'NPSB / BEFTN ইনস্ট্যান্ট ট্রান্সফার',
    accentColor: '#00A859',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    fee: '০% ফি (ফ্রি)',
    minBDT: 1000,
    maxBDT: 500000,
    icon: 'BT'
  },
  {
    provider: 'card_payment',
    method: 'CARD_PAYMENT',
    name: 'Visa / Mastercard',
    banglaName: 'ক্রেডিট ও ডেবিট কার্ড (3D Secure)',
    accentColor: '#1A1F71',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    fee: '০% ফি (ফ্রি)',
    minBDT: 1000,
    maxBDT: 100000,
    icon: 'CC'
  },
  {
    provider: 'usdt_crypto',
    method: 'USDT',
    name: 'USDT (TRC-20 Crypto)',
    banglaName: 'ক্রিপ্টো ইনস্ট্যান্ট ডিপোজিট',
    accentColor: '#26A17B',
    badgeColor: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
    fee: '০% ফি (নেটওয়ার্ক রিবেট)',
    minBDT: 1200,
    maxBDT: 1000000,
    icon: 'USDT'
  }
];

export const CashierView: React.FC<CashierViewProps> = ({
  currentUser,
  currentWallet,
  currency,
  onLedgerMutated,
  onClose
}) => {
  const { showToast, refreshState } = useWalletGame();

  const [activeMode, setActiveMode] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'HISTORY' | 'ARCHITECTURE'>('DEPOSIT');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderId>('bkash');

  // Deposit Intent & Flow States
  const [depositStep, setDepositStep] = useState<'AMOUNT' | 'PAYMENT' | 'VERIFYING' | 'SUCCESS'>('AMOUNT');
  const [depositAmount, setDepositAmount] = useState<number>(currency === 'BDT' ? 2500 : 25);
  const [senderNumber, setSenderNumber] = useState<string>('01712-349911');
  const [trxIdInput, setTrxIdInput] = useState<string>('');
  const [activeIntent, setActiveIntent] = useState<DepositIntent | null>(null);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(900); // 15 mins

  // Verification Animation States
  const [verificationProgressStep, setVerificationProgressStep] = useState<number>(0);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Withdrawal Form States
  const [withdrawAmount, setWithdrawAmount] = useState<number>(currency === 'BDT' ? 5000 : 50);
  const [withdrawRecipient, setWithdrawRecipient] = useState<string>('01712-349911');
  const [withdrawRecipientName, setWithdrawRecipientName] = useState<string>(currentUser.username);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);
  const [recentWithdrawal, setRecentWithdrawal] = useState<WithdrawalRecord | null>(null);

  // Data Lists & Copy Alerts
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [depositIntents, setDepositIntents] = useState<DepositIntent[]>([]);
  const [withdrawalRecords, setWithdrawalRecords] = useState<WithdrawalRecord[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<DoubleEntryLedgerEntry[]>([]);

  const activeChannel = PAYMENT_CHANNELS.find((c) => c.provider === selectedProvider) || PAYMENT_CHANNELS[0];
  const quickAmounts = currency === 'BDT' ? [500, 1000, 2500, 5000, 10000, 25000] : [10, 25, 50, 100, 250, 500];

  // Sync data with Payment Gateway Engine
  const refreshEngineData = () => {
    setDepositIntents(paymentGatewayEngine.getDepositIntents(currentUser.id));
    setWithdrawalRecords(paymentGatewayEngine.getWithdrawalRecords(currentUser.id));
    setLedgerEntries(paymentGatewayEngine.getDoubleEntryLedger());
  };

  useEffect(() => {
    refreshEngineData();
    const unsub = paymentGatewayEngine.subscribe(() => {
      refreshEngineData();
      onLedgerMutated();
    });
    return () => unsub();
  }, [currentUser.id]);

  // Timer countdown for active intent
  useEffect(() => {
    if (depositStep === 'PAYMENT' && timeRemainingSec > 0) {
      const timer = setInterval(() => {
        setTimeRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [depositStep, timeRemainingSec]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    soundEngine.playClick(950);
    showToast(`${label} কপি করা হয়েছে`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // --------------------------------------------------------------------------
  // Step 1: Create Deposit Intent & Assign Pool Destination
  // --------------------------------------------------------------------------
  const handleCreateDepositIntent = () => {
    if (depositAmount < activeChannel.minBDT) {
      showToast(`সর্বনিম্ন ডিপোজিট ৳${activeChannel.minBDT.toLocaleString()}`);
      return;
    }

    soundEngine.playClick(1000);
    const intent = paymentGatewayEngine.createDepositIntent({
      userId: currentUser.id,
      username: currentUser.username,
      provider: selectedProvider,
      method: activeChannel.method,
      amount: depositAmount,
      currency: currentUser.currency as 'BDT' | 'USD',
      idempotencyKey: `DEP-INTENT-${Date.now()}`
    });

    setActiveIntent(intent);
    setDepositStep('PAYMENT');
    setTimeRemainingSec(900);
    showToast(`ডিপোজিট রেফারেন্স তৈরি হয়েছে: ${intent.id}`);
  };

  // --------------------------------------------------------------------------
  // Step 2 & 3: Submit TrxID & Run 8-Point Verification Engine
  // --------------------------------------------------------------------------
  const handleVerifyTrxId = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIntent) return;

    const cleanTrx = trxIdInput.trim().toUpperCase();
    if (!cleanTrx || cleanTrx.length < 6) {
      setVerificationError('অনুগ্রহ করে সঠিক ৮-১০ অক্ষরের ট্রানজেকশন আইডি (TrxID) লিখুন');
      soundEngine.playClick(400);
      return;
    }

    setVerificationError(null);
    setDepositStep('VERIFYING');
    setVerificationProgressStep(1); // Check 1: Exists & Format

    soundEngine.playClick(1100);

    // Visual animated validation stages for high transparency
    setTimeout(() => setVerificationProgressStep(2), 600); // Check 2: Duplicate Prevention Check
    setTimeout(() => setVerificationProgressStep(3), 1200); // Check 3: Provider API Confirmation
    setTimeout(() => setVerificationProgressStep(4), 1800); // Check 4: Double-Entry Ledger & Balance Credit

    setTimeout(async () => {
      try {
        const res = await paymentGatewayEngine.verifyAndCreditDeposit({
          depositId: activeIntent.id,
          trxId: cleanTrx,
          senderNumber: senderNumber
        });

        setActiveIntent(res.depositIntent);
        setDepositStep('SUCCESS');
        showToast(res.message);
        refreshState();
        onLedgerMutated();
      } catch (err: any) {
        setVerificationError(err.message || 'ভেরিফিকেশন সম্পন্ন করা যায়নি।');
        setDepositStep('PAYMENT');
        soundEngine.playClick(350);
      }
    }, 2200);
  };

  // --------------------------------------------------------------------------
  // Controlled Withdrawal Request Submission
  // --------------------------------------------------------------------------
  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const availBal = currentWallet ? currentWallet.real_balance : 0;

    if (withdrawAmount > availBal) {
      showToast('পর্যাপ্ত ব্যালেন্স নেই!');
      soundEngine.playClick(400);
      return;
    }

    if (withdrawAmount < 500) {
      showToast('সর্বনিম্ন উইথড্রয়াল পরিমাণ ৳৫০০');
      return;
    }

    setIsWithdrawing(true);
    soundEngine.playClick(1000);

    try {
      const record = await paymentGatewayEngine.requestWithdrawal({
        userId: currentUser.id,
        username: currentUser.username,
        provider: selectedProvider,
        method: activeChannel.method,
        amount: withdrawAmount,
        currency: currentUser.currency as 'BDT' | 'USD',
        recipientAccount: withdrawRecipient,
        recipientName: withdrawRecipientName,
        idempotencyKey: `WD-REQ-${Date.now()}`
      });

      setRecentWithdrawal(record);
      showToast(`উইথড্রয়াল রিকোয়েস্ট সফল! ৳${withdrawAmount.toLocaleString()} সংরক্ষিত হয়েছে এবং ক্যাশ-আউট প্রক্রিয়াধীন।`);
      refreshState();
      onLedgerMutated();
    } catch (err: any) {
      showToast(`ত্রুটি: ${err.message}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6 max-w-6xl mx-auto pb-12 font-sans"
    >
      {/* ========================================================================= */}
      {/* HEADER: EMERALD & GOLD LUXURY CASHIER & WALLET HEADER */}
      {/* ========================================================================= */}
      <div className="relative rounded-[28px] overflow-hidden border-2 border-emerald-600/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-[#02180e] p-5 sm:p-7 shadow-2xl">
        {/* Top Gold Border Glow */}
        <div className="absolute top-0 left-10 right-10 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 p-0.5 shadow-lg shadow-amber-500/30 flex items-center justify-center">
              <div className="w-full h-full bg-emerald-950 rounded-[14px] flex items-center justify-center">
                <Wallet className="w-7 h-7 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  অটোমেটেড ক্যাশিয়ার ও ওয়ালেট হাব
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] font-mono font-black text-emerald-300 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  LIVE GATEWAY 2.0
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 mt-1">
                বিকাশ, নগদ, রকেট ও ব্যাংক ট্রান্সফারে ১০০% স্বয়ংক্রিয় ভেরিফিকেশন ও ডাবল-এন্ট্রি লেজার ওয়ালেট
              </p>
            </div>
          </div>

          {/* User Real Balance & Reserved Balance Display */}
          <div className="flex items-center gap-3 w-full lg:w-auto bg-emerald-950/80 border border-emerald-700/60 rounded-2xl p-3 sm:p-4">
            <div className="flex-1 text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-300 block font-mono">
                উপলব্ধ ব্যালেন্স (Available)
              </span>
              <span className="text-xl sm:text-2xl font-black text-transparent bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 bg-clip-text font-mono">
                {currency === 'BDT' ? '৳' : '$'}{currentWallet ? currentWallet.real_balance.toLocaleString() : '0.00'}
              </span>
            </div>

            {currentWallet && (currentWallet.locked_balance || 0) > 0 && (
              <div className="border-l border-emerald-700/60 pl-3 text-left">
                <span className="text-[10px] uppercase font-bold text-amber-400 block font-mono flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  সংরক্ষিত (Reserved)
                </span>
                <span className="text-sm font-black text-amber-300 font-mono">
                  {currency === 'BDT' ? '৳' : '$'}{currentWallet.locked_balance.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 mt-6 border-t border-emerald-800/80 pt-4 overflow-x-auto pb-1">
          <button
            onClick={() => {
              setActiveMode('DEPOSIT');
              soundEngine.playClick(900);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center space-x-2 cursor-pointer ${
              activeMode === 'DEPOSIT'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800 border border-emerald-700/50'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>অটো ডিপোজিট (Deposit)</span>
          </button>

          <button
            onClick={() => {
              setActiveMode('WITHDRAWAL');
              soundEngine.playClick(900);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center space-x-2 cursor-pointer ${
              activeMode === 'WITHDRAWAL'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800 border border-emerald-700/50'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>ক্যাশ-আউট / উইথড্র (Withdraw)</span>
          </button>

          <button
            onClick={() => {
              setActiveMode('HISTORY');
              soundEngine.playClick(900);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center space-x-2 cursor-pointer ${
              activeMode === 'HISTORY'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800 border border-emerald-700/50'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>ডাবল-এন্ট্রি লেজার হিস্ট্রি ({depositIntents.length + withdrawalRecords.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveMode('ARCHITECTURE');
              soundEngine.playClick(900);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all flex items-center space-x-2 cursor-pointer ${
              activeMode === 'ARCHITECTURE'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 font-black'
                : 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800 border border-emerald-700/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>গেটওয়ে আর্কিটেকচার গাইড</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DEPOSIT FLOW (2-STEP AUTOMATED FLOW) */}
      {/* ========================================================================= */}
      {activeMode === 'DEPOSIT' && (
        <div className="space-y-6">
          {/* Payment Method Selector Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {PAYMENT_CHANNELS.map((ch) => {
              const isSelected = selectedProvider === ch.provider;
              return (
                <button
                  key={ch.provider}
                  onClick={() => {
                    setSelectedProvider(ch.provider);
                    setDepositStep('AMOUNT');
                    setActiveIntent(null);
                    soundEngine.playClick(900);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all text-left relative overflow-hidden group cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-900/90 border-amber-400 shadow-lg shadow-emerald-950 scale-[1.02]'
                      : 'bg-emerald-950/60 border-emerald-800/80 hover:bg-emerald-900/40 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-700/60 flex items-center justify-center font-mono font-black text-xs text-amber-300">
                      {ch.icon}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    )}
                  </div>
                  <h3 className="font-bold text-white text-xs mt-2.5 line-clamp-1">{ch.name}</h3>
                  <p className="text-[10px] text-emerald-300 line-clamp-1 mt-0.5">{ch.fee}</p>
                </button>
              );
            })}
          </div>

          {/* STEP 1: AMOUNT SELECTION & DEPOSIT INTENT CREATION */}
          {depositStep === 'AMOUNT' && (
            <div className="rounded-3xl border-2 border-emerald-700/50 bg-gradient-to-b from-emerald-950 to-[#03150e] p-6 sm:p-8 space-y-6">
              <div className="border-b border-emerald-800 pb-4">
                <span className="text-[10px] font-mono uppercase font-bold text-amber-400 tracking-wider">
                  ধাপ ০১ / ০২ • ডিপোজিট পরিমাণ নির্বাচন
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span>{activeChannel.name}-এ ডিপোজিট করবেন কত টাকা?</span>
                </h2>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setDepositAmount(amt);
                      soundEngine.playClick(850);
                    }}
                    className={`py-2.5 rounded-xl border text-xs font-mono font-black transition-all cursor-pointer ${
                      depositAmount === amt
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 border-amber-300 shadow-md scale-105'
                        : 'bg-emerald-900/60 border-emerald-700 text-emerald-200 hover:bg-emerald-800'
                    }`}
                  >
                    {currency === 'BDT' ? '৳' : '$'}{amt.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div>
                <label className="text-xs font-bold text-emerald-200 block mb-1.5 font-mono">
                  কাস্টম টাকার পরিমাণ (Custom Amount)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-black text-amber-400 text-lg">
                    {currency === 'BDT' ? '৳' : '$'}
                  </span>
                  <input
                    type="number"
                    min={activeChannel.minBDT}
                    max={activeChannel.maxBDT}
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    className="w-full bg-emerald-950 border-2 border-emerald-700 focus:border-amber-400 rounded-2xl py-3 pl-10 pr-4 text-white font-mono text-lg font-bold focus:outline-none"
                    placeholder="2500"
                  />
                </div>
                <p className="text-[11px] text-emerald-300/80 mt-1 font-mono">
                  সীমা: ৳{activeChannel.minBDT.toLocaleString()} - ৳{activeChannel.maxBDT.toLocaleString()}
                </p>
              </div>

              {/* Sender Number / Identifier */}
              <div>
                <label className="text-xs font-bold text-emerald-200 block mb-1.5 font-mono">
                  আপনার প্রেরক একাউন্ট নম্বর (Sender Phone / Account)
                </label>
                <input
                  type="text"
                  value={senderNumber}
                  onChange={(e) => setSenderNumber(e.target.value)}
                  className="w-full bg-emerald-950 border border-emerald-700 focus:border-amber-400 rounded-2xl py-2.5 px-4 text-white font-mono text-sm focus:outline-none"
                  placeholder="01XXXXXXXXX"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateDepositIntent}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-mono font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>ডিপোজিট রিকোয়েস্ট তৈরি করুন ও পেমেন্ট নম্বর দেখুন</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: PAYMENT DESTINATION ASSIGNMENT & INSTRUCTIONS */}
          {depositStep === 'PAYMENT' && activeIntent && (
            <div className="rounded-3xl border-2 border-emerald-700/60 bg-gradient-to-b from-emerald-950 via-[#04190f] to-[#02130b] p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-800 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-400 tracking-wider">
                    ধাপ ০২ / ০২ • নির্ধারিত নম্বরে পেমেন্ট ও TrxID সাবমিশন
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                    ডিপোজিট রেফারেন্স: <strong className="text-amber-300 font-mono">{activeIntent.id}</strong>
                  </h2>
                </div>

                <div className="flex items-center space-x-2 bg-emerald-900/80 border border-amber-400/40 px-3 py-1.5 rounded-xl font-mono text-xs text-amber-300">
                  <Clock className="w-4 h-4 animate-spin text-amber-400" />
                  <span>মেয়াদ বাকি: {formatTimer(timeRemainingSec)}</span>
                </div>
              </div>

              {/* Assigned Destination Account Box */}
              <div className="bg-emerald-900/60 border-2 border-amber-400/50 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-emerald-300">
                  <span>নির্ধারিত {activeChannel.name} একাউন্ট ({activeIntent.destinationAccount.accountType}):</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                    সক্রিয় ও ভেরিফাইড গেটওয়ে
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-950 p-4 rounded-xl border border-emerald-700">
                  <div>
                    <div className="text-xs text-slate-400">{activeIntent.destinationAccount.accountName}</div>
                    <div className="text-2xl font-black text-white font-mono tracking-wider mt-0.5">
                      {activeIntent.destinationAccount.accountNumber}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCopy(activeIntent.destinationAccount.accountNumber, 'একাউন্ট নম্বর')}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 text-xs font-mono font-black shadow hover:scale-105 active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    {copiedText === 'একাউন্ট নম্বর' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedText === 'একাউন্ট নম্বর' ? 'কপি হয়েছে' : 'নম্বর কপি করুন'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono pt-1 text-emerald-300">
                  <div>ডিপোজিট পরিমাণ: <strong className="text-amber-300 text-sm">৳{activeIntent.amount.toLocaleString()}</strong></div>
                  <div>রেফারেন্স কোড: <strong className="text-white">{activeIntent.referenceCode}</strong></div>
                </div>
              </div>

              {/* Clear Step-by-Step Instructions */}
              <div className="bg-emerald-950/80 border border-emerald-800 rounded-2xl p-4 space-y-2 text-xs text-emerald-200/90 font-sans">
                <h4 className="font-bold text-amber-300 flex items-center gap-1.5 text-xs font-mono">
                  <Info className="w-4 h-4" />
                  <span>পেমেন্ট নির্দেশিকা (Payment Instructions):</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed">
                  {activeIntent.destinationAccount.instructions.map((inst, i) => (
                    <li key={i}>{inst}</li>
                  ))}
                </ol>
              </div>

              {/* TrxID Input Form */}
              <form onSubmit={handleVerifyTrxId} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-emerald-200 block mb-1.5 font-mono">
                    পেমেন্ট ট্রানজেকশন আইডি (Transaction ID / TrxID) লিখুন *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={trxIdInput}
                      onChange={(e) => setTrxIdInput(e.target.value)}
                      className="w-full bg-emerald-950 border-2 border-emerald-700 focus:border-amber-400 rounded-2xl py-3 px-4 text-white font-mono text-base font-bold uppercase tracking-wider focus:outline-none"
                      placeholder="e.g. BL92A81K09"
                    />
                  </div>
                  {verificationError && (
                    <div className="mt-2 text-xs text-red-400 font-mono bg-red-950/40 border border-red-800/60 p-2.5 rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{verificationError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDepositStep('AMOUNT')}
                    className="py-3 px-5 rounded-2xl bg-emerald-950 border border-emerald-700 text-emerald-300 font-mono text-xs hover:bg-emerald-900 cursor-pointer"
                  >
                    ব্যাকে যান
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-mono font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>ভেরিফাই ও ডিপোজিট সম্পন্ন করুন (Instant Verify)</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 3: REAL-TIME VERIFICATION ENGINE ANIMATION */}
          {depositStep === 'VERIFYING' && (
            <div className="rounded-3xl border-2 border-emerald-700/60 bg-gradient-to-b from-emerald-950 to-[#02180e] p-8 text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="w-full h-full rounded-full border-4 border-emerald-700 border-t-amber-400 animate-spin" />
                <ShieldCheck className="w-8 h-8 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white font-mono">
                  পেমেন্ট ভেরিফিকেশন ইঞ্জিন চলছে...
                </h3>
                <p className="text-xs text-emerald-300 mt-1">
                  TrxID: <strong className="text-amber-300 font-mono">{trxIdInput.toUpperCase()}</strong> যাচাই করা হচ্ছে
                </p>
              </div>

              {/* 4-Stage Progress Visualizer */}
              <div className="max-w-md mx-auto space-y-2.5 font-mono text-xs text-left">
                <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  verificationProgressStep >= 1 ? 'bg-emerald-900/70 border-emerald-600 text-emerald-200' : 'bg-emerald-950/40 border-emerald-900 text-slate-500'
                }`}>
                  <span>১. TrxID ফর্ম্যাট ও মেয়াদ যাচাই</span>
                  {verificationProgressStep >= 1 ? <Check className="w-4 h-4 text-emerald-400" /> : <RotateCw className="w-4 h-4 animate-spin text-slate-500" />}
                </div>

                <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  verificationProgressStep >= 2 ? 'bg-emerald-900/70 border-emerald-600 text-emerald-200' : 'bg-emerald-950/40 border-emerald-900 text-slate-500'
                }`}>
                  <span>২. ডুপ্লিকেট TrxID ও জালিয়াতি প্রতিরোধ চেক</span>
                  {verificationProgressStep >= 2 ? <Check className="w-4 h-4 text-emerald-400" /> : <RotateCw className="w-4 h-4 animate-spin text-slate-500" />}
                </div>

                <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  verificationProgressStep >= 3 ? 'bg-emerald-900/70 border-emerald-600 text-emerald-200' : 'bg-emerald-950/40 border-emerald-900 text-slate-500'
                }`}>
                  <span>৩. গেটওয়ে মার্চেন্ট API কনফার্মেশন</span>
                  {verificationProgressStep >= 3 ? <Check className="w-4 h-4 text-emerald-400" /> : <RotateCw className="w-4 h-4 animate-spin text-slate-500" />}
                </div>

                <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                  verificationProgressStep >= 4 ? 'bg-emerald-900/70 border-emerald-600 text-emerald-200' : 'bg-emerald-950/40 border-emerald-900 text-slate-500'
                }`}>
                  <span>৪. ডাবল-এন্ট্রি লেজার ও ওয়ালেট ক্রেডিট</span>
                  {verificationProgressStep >= 4 ? <Check className="w-4 h-4 text-emerald-400" /> : <RotateCw className="w-4 h-4 animate-spin text-slate-500" />}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS RECEIPT */}
          {depositStep === 'SUCCESS' && activeIntent && (
            <div className="rounded-3xl border-2 border-emerald-500 bg-gradient-to-b from-emerald-950 via-[#031d10] to-[#01140a] p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <span className="text-xs uppercase font-mono font-bold text-amber-400">ডিপোজিট সফল ও অনুমোদিত</span>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                  ৳{activeIntent.amount.toLocaleString()} যোগ হয়েছে
                </h2>
                <p className="text-xs text-emerald-300 mt-1">
                  আপনার ওয়ালেটে ইনস্ট্যান্ট ব্যালেন্স সফলভাবে আপডেট করা হয়েছে।
                </p>
              </div>

              <div className="bg-emerald-950 p-4 rounded-2xl border border-emerald-800 max-w-md mx-auto font-mono text-xs space-y-2 text-left">
                <div className="flex justify-between text-slate-400">
                  <span>ডিপোজিট রেফারেন্স:</span>
                  <span className="text-white font-bold">{activeIntent.id}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>TrxID:</span>
                  <span className="text-amber-300 font-bold">{activeIntent.providerTransactionId}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>মেথড:</span>
                  <span className="text-white">{activeIntent.provider.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>সময়:</span>
                  <span className="text-white">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDepositStep('AMOUNT');
                    setActiveIntent(null);
                    setTrxIdInput('');
                    soundEngine.playClick(900);
                  }}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-mono font-black text-xs shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  নতুন ডিপোজিট করুন
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode('HISTORY')}
                  className="px-6 py-3 rounded-xl bg-emerald-900 border border-emerald-700 text-emerald-200 font-mono text-xs hover:bg-emerald-800 cursor-pointer"
                >
                  হিস্ট্রি দেখুন
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CONTROLLED WITHDRAWAL FLOW (BALANCE RESERVATION MODEL) */}
      {/* ========================================================================= */}
      {activeMode === 'WITHDRAWAL' && (
        <div className="space-y-6">
          {/* Method Selection */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PAYMENT_CHANNELS.slice(0, 4).map((ch) => {
              const isSelected = selectedProvider === ch.provider;
              return (
                <button
                  key={ch.provider}
                  onClick={() => {
                    setSelectedProvider(ch.provider);
                    soundEngine.playClick(900);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all text-left relative overflow-hidden group cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-900/90 border-amber-400 shadow-lg scale-[1.02]'
                      : 'bg-emerald-950/60 border-emerald-800/80 hover:bg-emerald-900/40 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-700/60 flex items-center justify-center font-mono font-black text-xs text-amber-300">
                      {ch.icon}
                    </span>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                  </div>
                  <h3 className="font-bold text-white text-xs mt-2.5">{ch.name}</h3>
                  <p className="text-[10px] text-emerald-300 mt-0.5">ইনস্ট্যান্ট ক্যাশ-আউট</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border-2 border-emerald-700/50 bg-gradient-to-b from-emerald-950 to-[#03150e] p-6 sm:p-8 space-y-6">
            <div className="border-b border-emerald-800 pb-4">
              <span className="text-[10px] font-mono uppercase font-bold text-amber-400 tracking-wider">
                ক্যাশ-আউট ও ব্যালেন্স রিজার্ভেশন ইঞ্জিন
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white mt-1 flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-amber-400" />
                <span>উইথড্রয়াল রিকোয়েস্ট সাবমিট করুন</span>
              </h2>
            </div>

            {/* Controlled Reservation Info Banner */}
            <div className="bg-emerald-950/90 border border-amber-400/40 p-4 rounded-2xl flex items-start space-x-3 text-xs text-emerald-200">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block font-mono">নিরাপদ ব্যালেন্স রিজার্ভেশন মেকানিজম</strong>
                উইথড্র রিকোয়েস্ট করার পর টাকা আপনার ব্যালেন্স থেকে সাময়িকভাবে <span className="text-amber-300 font-mono font-bold">WITHDRAWAL_RESERVED</span> হিসেবে সংরক্ষিত হবে। সফলভাবে অ্যাকাউন্টে পেআউট সম্পন্ন হলে ডেবিট চূড়ান্ত হবে; কোনো কারণে ব্যর্থ হলে টাকা স্বয়ংক্রিয়ভাবে ওয়ালেটে ফেরত আসবে।
              </div>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-emerald-200 block mb-1.5 font-mono">
                  উইথড্রয়াল পরিমাণ (Amount)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-black text-amber-400 text-lg">
                    {currency === 'BDT' ? '৳' : '$'}
                  </span>
                  <input
                    type="number"
                    min={500}
                    max={currentWallet ? currentWallet.real_balance : 50000}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                    className="w-full bg-emerald-950 border-2 border-emerald-700 focus:border-amber-400 rounded-2xl py-3 pl-10 pr-4 text-white font-mono text-lg font-bold focus:outline-none"
                    placeholder="5000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-emerald-200 block mb-1.5 font-mono">
                    প্রাপকের {activeChannel.name} নম্বর / একাউন্ট *
                  </label>
                  <input
                    type="text"
                    required
                    value={withdrawRecipient}
                    onChange={(e) => setWithdrawRecipient(e.target.value)}
                    className="w-full bg-emerald-950 border border-emerald-700 focus:border-amber-400 rounded-2xl py-2.5 px-4 text-white font-mono text-sm focus:outline-none"
                    placeholder="01XXXXXXXXX"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-200 block mb-1.5 font-mono">
                    একাউন্টধারীর নাম (Account Holder Name)
                  </label>
                  <input
                    type="text"
                    value={withdrawRecipientName}
                    onChange={(e) => setWithdrawRecipientName(e.target.value)}
                    className="w-full bg-emerald-950 border border-emerald-700 focus:border-amber-400 rounded-2xl py-2.5 px-4 text-white font-mono text-sm focus:outline-none"
                    placeholder="Player Name"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isWithdrawing}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-mono font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isWithdrawing ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>ব্যালেন্স রিজার্ভেশন ও পেআউট যাচাই হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    <span>উইথড্রয়াল রিকোয়েস্ট কনফার্ম করুন (Reserve & Payout)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DOUBLE-ENTRY LEDGER & HISTORY */}
      {/* ========================================================================= */}
      {activeMode === 'HISTORY' && (
        <div className="rounded-3xl border-2 border-emerald-700/50 bg-gradient-to-b from-emerald-950 to-[#03150e] p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-emerald-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <span>ডাবল-এন্ট্রি পেমেন্ট ও লেজার রেকর্ড</span>
              </h3>
              <p className="text-xs text-emerald-300 mt-0.5">
                প্রতিটি ডিপোজিট ও উইথড্রয়াল ট্রানজেকশনের সম্পূর্ণ অপরিবর্তনযোগ্য অডিট হিস্ট্রি
              </p>
            </div>
            <button
              onClick={refreshEngineData}
              className="p-2 rounded-xl bg-emerald-900 border border-emerald-700 text-emerald-200 hover:bg-emerald-800 transition-all cursor-pointer"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-emerald-950 text-emerald-300 uppercase text-[10px] border-b border-emerald-800">
                <tr>
                  <th className="p-3">রেফারেন্স আইডি</th>
                  <th className="p-3">ধরন</th>
                  <th className="p-3">মেথড</th>
                  <th className="p-3">পরিমাণ</th>
                  <th className="p-3">TrxID / নম্বর</th>
                  <th className="p-3">স্ট্যাটাস</th>
                  <th className="p-3">তারিখ ও সময়</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-800/60">
                {depositIntents.length === 0 && withdrawalRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                      কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি
                    </td>
                  </tr>
                ) : (
                  <>
                    {depositIntents.map((dep) => (
                      <tr key={dep.id} className="hover:bg-emerald-900/40 transition-colors">
                        <td className="p-3 font-semibold text-white truncate max-w-[140px]">{dep.id}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            DEPOSIT
                          </span>
                        </td>
                        <td className="p-3 font-bold text-white">{dep.provider.toUpperCase()}</td>
                        <td className="p-3 font-black text-amber-300">
                          +৳{dep.amount.toLocaleString()}
                        </td>
                        <td className="p-3 text-emerald-200">
                          <div className="font-bold text-white">{dep.providerTransactionId || 'অপেক্ষমাণ'}</div>
                          <div className="text-[10px] text-slate-400">{dep.destinationAccount.accountNumber}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            dep.status === 'CREDITED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : dep.status === 'AWAITING_PAYMENT'
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}>
                            {dep.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {new Date(dep.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}

                    {withdrawalRecords.map((wth) => (
                      <tr key={wth.id} className="hover:bg-emerald-900/40 transition-colors">
                        <td className="p-3 font-semibold text-white truncate max-w-[140px]">{wth.id}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            WITHDRAW
                          </span>
                        </td>
                        <td className="p-3 font-bold text-white">{wth.provider.toUpperCase()}</td>
                        <td className="p-3 font-black text-red-400">
                          -৳{wth.amount.toLocaleString()}
                        </td>
                        <td className="p-3 text-emerald-200">
                          <div className="font-bold text-white">{wth.recipientAccount}</div>
                          <div className="text-[10px] text-slate-400">{wth.providerReference || 'Processing'}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            wth.status === 'WITHDRAWAL_COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : wth.status === 'WITHDRAWAL_RESERVED' || wth.status === 'PAYOUT_PROCESSING'
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                              : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}>
                            {wth.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {new Date(wth.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ARCHITECTURE & SECURITY GUIDE */}
      {/* ========================================================================= */}
      {activeMode === 'ARCHITECTURE' && (
        <div className="rounded-3xl border-2 border-emerald-700/50 bg-gradient-to-b from-emerald-950 to-[#03150e] p-6 sm:p-8 space-y-6 font-sans">
          <div className="border-b border-emerald-800 pb-4">
            <span className="text-[10px] font-mono uppercase font-bold text-amber-400 tracking-wider">
              Gameplay 365 Core Engineering Specification
            </span>
            <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>সম্পূর্ণ স্বয়ংক্রিয় গেটওয়ে ও ওয়ালেট আর্কিটেকচার নীতি</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-emerald-950 p-4 rounded-2xl border border-emerald-800 space-y-2">
              <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>৮-পয়েন্ট ডিপোজিট ভেরিফিকেশন নীতি</span>
              </h4>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                <li>✓ ১. TrxID অস্তিত্ব ও ফরম্যাট যাচাই</li>
                <li>✓ ২. ইউনিক TrxID চেক (Duplicate TrxID নিষিদ্ধ)</li>
                <li>✓ ৩. সঠিক টাকার পরিমাণ ও মেথড মেলানো</li>
                <li>✓ ৪. নির্ধারিত গেটওয়ে একাউন্ট সঠিক থাকা</li>
                <li>✓ ৫. ১৫ মিনিটের সময়সীমার মধ্যে পেমেন্ট</li>
                <li>✓ ৬. প্রোভাইডার API দ্বারা অথরাইজড কনফার্মেশন</li>
                <li>✓ ৭. ডাবল-এন্ট্রি লেজার এন্ট্রি ও সিস্টেম লায়াবিলিটি ডেবিট</li>
                <li>✓ ৮. অ্যাটমিক রো-লেভেল মিউটেক্স লক সহ ওয়ালেট ক্রেডিট</li>
              </ul>
            </div>

            <div className="bg-emerald-950 p-4 rounded-2xl border border-emerald-800 space-y-2">
              <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>ব্যালেন্স রিজার্ভেশন ও উইথড্রয়াল সুরক্ষা</span>
              </h4>
              <ul className="space-y-1 text-slate-300 text-[11px]">
                <li>✓ উইথড্র রিকোয়েস্টের সঙ্গে সঙ্গে ব্যালেন্স সরাসরি হারায় না</li>
                <li>✓ <span className="text-amber-300 font-bold">WITHDRAWAL_RESERVED</span> হিসেবে আটকে রাখা হয়</li>
                <li>✓ পেআউট সফল হলে: <span className="text-emerald-400 font-bold">WITHDRAWAL_COMPLETED</span></li>
                <li>✓ পেআউট ব্যর্থ হলে: <span className="text-cyan-300 font-bold">RESERVATION_RELEASED</span> ও টাকা ফেরত</li>
                <li>✓ অ্যান্টি-ফ্রড রিস্ক স্কোরিং (০-১০০ স্কেল)</li>
                <li>✓ Idempotency Key দ্বারা ডুপ্লিকেট উইথড্র রোধ</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
