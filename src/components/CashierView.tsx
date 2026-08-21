/**
 * @file CashierView.tsx
 * @description Master Deposit, Withdrawal & Cashier Vault for Playall 365.
 * Crafted with balanced visual proportions, warm luxury aesthetics, mobile touch optimization,
 * real-time local payment channel processing (bKash, Nagad, Rocket, Upay, USDT),
 * and direct ledger synchronization.
 */

import React, { useState } from 'react';
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
  Gift,
  Coins,
  Receipt,
  Download,
  RotateCw,
  Search,
  ExternalLink,
  ChevronRight,
  Zap,
  Lock,
  Wallet,
  Building,
  Smartphone,
  Info
} from 'lucide-react';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { UserEntity, WalletEntity, PaymentMethodType, PaymentRequestEntity } from '../server/types/seamless';
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

interface PaymentChannel {
  id: PaymentMethodType;
  name: string;
  banglaName: string;
  type: string;
  accountNumber: string;
  accentColor: string;
  themeGradient: string;
  badgeColor: string;
  fee: string;
  minDepositBDT: number;
  maxDepositBDT: number;
  minDepositUSD: number;
  maxDepositUSD: number;
  instructions: string[];
}

const PAYMENT_CHANNELS: PaymentChannel[] = [
  {
    id: 'BKASH',
    name: 'bKash (বিকাশ)',
    banglaName: 'সেন্ড মানি / ক্যাশ-ইন / পেমেন্ট',
    type: 'Merchant / Personal',
    accountNumber: '01900-112233',
    accentColor: 'text-[#E2136E]',
    themeGradient: 'from-[#E2136E] via-[#c0105d] to-[#910a44]',
    badgeColor: 'bg-[#E2136E]/20 text-[#E2136E] border-[#E2136E]/40',
    fee: '০% ফি (ফ্রি)',
    minDepositBDT: 500,
    maxDepositBDT: 50000,
    minDepositUSD: 5,
    maxDepositUSD: 500,
    instructions: [
      'আপনার বিকাশ অ্যাপে প্রবেশ করুন অথবা *247# ডায়াল করুন।',
      '"Send Money" অথবা "Payment" অপশন নির্বাচন করুন।',
      'আমাদের এজেন্ট / মার্চেন্ট নম্বর: 01900-112233 বসান।',
      'ডিপোজিট পরিমাণ লিখে আপনার বিকাশ পিন (PIN) দিয়ে কনফার্ম করুন।',
      'মেসেজ থেকে ৮-১০ ডিজিটের ট্রানজেকশন আইডি (TrxID) কপি করে নিচের ঘরে বসান।'
    ]
  },
  {
    id: 'NAGAD',
    name: 'Nagad (নগদ)',
    banglaName: 'ক্যাশ ইন / সেন্ড মানি',
    type: 'Agent / Direct Wallet',
    accountNumber: '01844-992200',
    accentColor: 'text-[#F7941D]',
    themeGradient: 'from-[#F7941D] via-[#e07f0f] to-[#b86304]',
    badgeColor: 'bg-[#F7941D]/20 text-[#F7941D] border-[#F7941D]/40',
    fee: '০% ফি (ফ্রি)',
    minDepositBDT: 500,
    maxDepositBDT: 50000,
    minDepositUSD: 5,
    maxDepositUSD: 500,
    instructions: [
      'নগদ অ্যাপ খুলুন অথবা *167# ডায়াল করুন।',
      '"Cash Out to Agent" অথবা "Send Money" নির্বাচন করুন।',
      'নগদ এজেন্ট নম্বর: 01844-992200 লিখুন।',
      'টাকার পরিমাণ ও আপনার নগদ পিন দিয়ে কনফার্ম করুন।',
      'নগদের ট্রানজেকশন আইডি (TrxID) কপি করে নিচের ইনপুটে পেস্ট করুন।'
    ]
  },
  {
    id: 'ROCKET',
    name: 'Rocket (রকেট)',
    banglaName: 'ডিবিবিএল মোবাইল ব্যাংকিং',
    type: 'Biller / Agent',
    accountNumber: '01711-884422-9',
    accentColor: 'text-[#8C3494]',
    themeGradient: 'from-[#8C3494] via-[#74277c] to-[#591b60]',
    badgeColor: 'bg-[#8C3494]/20 text-[#8C3494] border-[#8C3494]/40',
    fee: '০% ফি (ফ্রি)',
    minDepositBDT: 1000,
    maxDepositBDT: 50000,
    minDepositUSD: 10,
    maxDepositUSD: 500,
    instructions: [
      'রকেট অ্যাপ খুলুন অথবা *322# ডায়াল করুন।',
      '"Send Money" নির্বাচন করুন।',
      'রকেট একাউন্ট নম্বর: 01711-884422-9 দিন।',
      'টাকার পরিমাণ এবং আপনার ৪-ডিজিটের পিন দিয়ে কনফার্ম করুন।',
      '১০-ডিজিটের ট্রানজেকশন আইডি নিচের ঘরে লিখে জমা দিন।'
    ]
  },
  {
    id: 'UPAY',
    name: 'Upay (উপায়)',
    banglaName: 'ইউসিবি মোবাইল পেমেন্ট',
    type: 'Direct Gateway',
    accountNumber: '01399-556677',
    accentColor: 'text-[#0072CE]',
    themeGradient: 'from-[#0072CE] via-[#005bb5] to-[#004285]',
    badgeColor: 'bg-[#0072CE]/20 text-[#0072CE] border-[#0072CE]/40',
    fee: '০% ফি (ফ্রি)',
    minDepositBDT: 500,
    maxDepositBDT: 25000,
    minDepositUSD: 5,
    maxDepositUSD: 250,
    instructions: [
      'উপায় অ্যাপ ওপেন করুন।',
      '"Fund Transfer" বা "Payment" অপশন বেছে নিন।',
      'উপায় নম্বর: 01399-556677 প্রবেশ করুন।',
      'ট্রানজেকশন শেষ করে TrxID কপি করে সাবমিট করুন।'
    ]
  },
  {
    id: 'USDT',
    name: 'USDT (TRC-20 Crypto)',
    banglaName: 'ক্রিপ্টো ইনস্ট্যান্ট ডিপোজিট',
    type: 'Blockchain Vault',
    accountNumber: 'TK89xVqLiveSeamlessCasinoCryptoVault99201',
    accentColor: 'text-[#26A17B]',
    themeGradient: 'from-[#26A17B] via-[#1f8767] to-[#16644c]',
    badgeColor: 'bg-[#26A17B]/20 text-[#26A17B] border-[#26A17B]/40',
    fee: '০% নেটওয়ার্ক রিবিয়েট',
    minDepositBDT: 1200,
    maxDepositBDT: 1000000,
    minDepositUSD: 10,
    maxDepositUSD: 10000,
    instructions: [
      'Binance, TrustWallet অথবা OKX অ্যাপে প্রবেশ করুন।',
      'Withdrawal -> USDT -> TRC-20 Network নির্বাচন করুন।',
      'ঠিকানা: TK89xVqLiveSeamlessCasinoCryptoVault99201 পেস্ট করুন।',
      'ট্রান্সফার সফল হলে TxHash কপি করে নিচের ঘরে বসান।'
    ]
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

  const [activeMode, setActiveMode] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'HISTORY'>('DEPOSIT');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('BKASH');
  
  // Deposit Form States
  const [depositAmount, setDepositAmount] = useState<number>(currency === 'BDT' ? 2500 : 25);
  const [senderNumber, setSenderNumber] = useState<string>('01712-349911');
  const [trxId, setTrxId] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('WELCOME365');
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [autoApproveSimulation, setAutoApproveSimulation] = useState<boolean>(true);

  // Withdrawal Form States
  const [withdrawAmount, setWithdrawAmount] = useState<number>(currency === 'BDT' ? 5000 : 50);
  const [receiverNumber, setReceiverNumber] = useState<string>('01712-349911');

  // Status & Alerts
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successReceipt, setSuccessReceipt] = useState<PaymentRequestEntity | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeChannel = PAYMENT_CHANNELS.find((c) => c.id === selectedMethod) || PAYMENT_CHANNELS[0];

  const quickAmountsBDT = [500, 1000, 2500, 5000, 10000, 25000];
  const quickAmountsUSD = [10, 25, 50, 100, 250, 500];
  const quickAmounts = currency === 'BDT' ? quickAmountsBDT : quickAmountsUSD;

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(activeChannel.accountNumber);
    setCopiedAccount(true);
    soundEngine.playClick(950);
    showToast(`${activeChannel.name} নম্বর কপি হয়েছে`);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxId || trxId.trim().length < 6) {
      setErrorMsg('অনুগ্রহ করে সঠিক ৮-১০ অক্ষরের ট্রানজেকশন আইডি (TrxID) লিখুন');
      soundEngine.playClick(400);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      soundEngine.playClick(1000);
      const receipt = await seamlessEngine.submitDepositRequest({
        userId: currentUser.id,
        method: selectedMethod,
        amount: depositAmount,
        currency: currentUser.currency,
        senderNumber: senderNumber,
        receiverNumber: activeChannel.accountNumber,
        trxId: trxId.trim().toUpperCase(),
        autoApprove: autoApproveSimulation
      });

      notificationService.pushNotification(currentUser.id, {
        userId: currentUser.id,
        title: '✅ ডিপোজিট সফল হয়েছে!',
        message: `আপনার ${currentUser.currency === 'BDT' ? '৳' : '$'}${depositAmount.toLocaleString()} টাকার ডিপোজিট ওয়ালেটে যুক্ত হয়েছে। (TrxID: ${receipt.trx_id})`,
        type: 'DEPOSIT_CONFIRMED',
        amount: depositAmount,
        currency: currentUser.currency as 'BDT' | 'USD',
        isRead: false,
        actionTab: 'cashier'
      });

      soundEngine.playWinChime();
      setSuccessReceipt(receipt);
      onLedgerMutated();
      await refreshState();
      setTrxId('');
      showToast('ডিপোজিট সফলভাবে সম্পন্ন হয়েছে!');
    } catch (err: any) {
      setErrorMsg(err.message || 'ডিপোজিট সাবমিট ব্যর্থ হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverNumber || receiverNumber.trim().length < 8) {
      setErrorMsg('অনুগ্রহ করে সঠিক মোবাইল / ওয়ালেট নম্বর প্রদান করুন');
      soundEngine.playClick(400);
      return;
    }

    if (currentWallet && currentWallet.real_balance < withdrawAmount) {
      setErrorMsg('উইথড্রয়াল করার মতো পর্যাপ্ত রিয়াল ব্যালেন্স নেই');
      soundEngine.playClick(400);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      soundEngine.playClick(1000);
      const receipt = await seamlessEngine.submitWithdrawalRequest({
        userId: currentUser.id,
        method: selectedMethod,
        amount: withdrawAmount,
        currency: currentUser.currency,
        receiverNumber: receiverNumber.trim(),
        autoApprove: autoApproveSimulation
      });

      notificationService.pushNotification(currentUser.id, {
        userId: currentUser.id,
        title: autoApproveSimulation
          ? `✅ ${selectedMethod.toUpperCase()} ক্যাশ-আউট সফল`
          : `⏳ ${selectedMethod.toUpperCase()} ক্যাশ-আউট পেন্ডিং`,
        message: autoApproveSimulation
          ? `আপনার ${currentUser.currency === 'BDT' ? '৳' : '$'}${withdrawAmount.toLocaleString()} টাকার ক্যাশ-আউট প্রক্রিয়া সম্পন্ন হয়েছে।`
          : `আপনার ${currentUser.currency === 'BDT' ? '৳' : '$'}${withdrawAmount.toLocaleString()} টাকার ক্যাশ-আউট রিকোয়েস্ট পর্যালোচিত হচ্ছে।`,
        type: 'WITHDRAWAL_APPROVED',
        amount: withdrawAmount,
        currency: currentUser.currency as 'BDT' | 'USD',
        isRead: false,
        actionTab: 'cashier'
      });

      soundEngine.playWinChime();
      setSuccessReceipt(receipt);
      onLedgerMutated();
      await refreshState();
      showToast('ক্যাশ-আউট রিকোয়েস্ট সফল হয়েছে!');
    } catch (err: any) {
      setErrorMsg(err.message || 'উইথড্রয়াল সাবমিট ব্যর্থ হয়েছে');
    } finally {
      setSubmitting(false);
    }
  };

  const paymentRequests = seamlessEngine.getPaymentRequests();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 pb-28 font-sans text-slate-100 selection:bg-amber-400 selection:text-slate-950"
    >
      {/* 1. MASTER VAULT HEADER & BALANCE SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left Column: Quick Header & Trust Status */}
        <div className="lg:col-span-7 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-950 to-emerald-900 border-2 border-amber-400/50 p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-3 relative z-10">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-mono font-bold">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>নিরাপদ ক্যাশিয়ার ও পেমেন্ট গেটওয়ে</span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
              ইনস্ট্যান্ট ডিপোজিট ও দ্রুত ক্যাশ-আউট ভল্ট
            </h1>
            <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed font-sans">
              বিকাশ, নগদ, রকেট, উপায় এবং ইউএসডিটিতে ০% ফি-তে স্বয়ংক্রিয় ডিপোজিট সম্পন্ন করুন।
            </p>
          </div>

          {/* Speed Guarantees */}
          <div className="grid grid-cols-3 gap-2.5 pt-4 mt-2 border-t border-emerald-800/80 font-mono text-[11px] relative z-10">
            <div className="p-2.5 bg-emerald-950/90 rounded-xl border border-emerald-700/60">
              <div className="text-emerald-300 font-bold flex items-center space-x-1">
                <Zap className="w-3.5 h-3.5" />
                <span>০-৪ সেক স্পিড</span>
              </div>
              <div className="text-emerald-300/80 text-[10px] mt-0.5">অটোমেটিক ব্যালেন্স ক্রেডিট</div>
            </div>

            <div className="p-2.5 bg-emerald-950/90 rounded-xl border border-emerald-700/60">
              <div className="text-amber-300 font-bold flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>০% কমিশন ফি</span>
              </div>
              <div className="text-emerald-300/80 text-[10px] mt-0.5">১০০% ফ্রি ট্রানজেকশন</div>
            </div>

            <div className="p-2.5 bg-emerald-950/90 rounded-xl border border-emerald-700/60">
              <div className="text-amber-300 font-bold flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5" />
                <span>256-Bit SSL</span>
              </div>
              <div className="text-emerald-300/80 text-[10px] mt-0.5">এনক্রিপ্টেড পেমেন্ট গেটওয়ে</div>
            </div>
          </div>
        </div>

        {/* Right Column: Real-time Balance Box */}
        <div className="lg:col-span-5 rounded-2xl p-5 sm:p-7 relative overflow-hidden flex flex-col justify-between bg-gradient-to-br from-emerald-950 via-emerald-900 to-[#02180e] border-2 border-emerald-600/40 shadow-xl">
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs text-emerald-300">
              <span className="uppercase font-bold tracking-wider">উপলব্ধ রিয়াল ব্যালেন্স</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                ACTIVE
              </span>
            </div>

            <div className="text-2xl sm:text-4xl font-black text-transparent bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 bg-clip-text">
              {currentUser.currency === 'BDT'
                ? `৳ ${Number(currentWallet?.real_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : `$ ${Number(currentWallet?.real_balance || 0).toFixed(2)}`}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
              <div className="bg-emerald-950/80 p-2.5 rounded-xl border border-emerald-700/60">
                <span className="text-[10px] text-emerald-300/80">বোনাস ফান্ড</span>
                <div className="text-amber-300 font-bold mt-0.5">
                  {currentUser.currency === 'BDT' ? '৳' : '$'}{Number(currentWallet?.bonus_balance || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-emerald-950/80 p-2.5 rounded-xl border border-emerald-700/60">
                <span className="text-[10px] text-emerald-300/80">লকড ওয়েজার</span>
                <div className="text-emerald-200 font-bold mt-0.5">
                  {currentUser.currency === 'BDT' ? '৳' : '$'}{Number(currentWallet?.locked_balance || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-2 border-t border-emerald-800/80 text-[11px] font-mono text-emerald-300">
            <span>দৈনিক উত্তোলন সীমা: <strong>{currentUser.currency === 'BDT' ? '৳৫০,০০,০০০' : '$50,000'}</strong></span>
            <span className="text-amber-300 font-bold">ভিআইপি আনলিমিটেড</span>
          </div>
        </div>

      </div>

      {/* 2. MODE NAVIGATION TABS */}
      <div className="flex items-center space-x-2 bg-emerald-950/80 p-1.5 rounded-2xl border border-emerald-700/60 font-mono text-xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => {
            soundEngine.playClick(850);
            setActiveMode('DEPOSIT');
            setSuccessReceipt(null);
            setErrorMsg(null);
          }}
          className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
            activeMode === 'DEPOSIT'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25'
              : 'text-emerald-200 hover:text-white'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
          <span>ডিপোজিট করুন (Deposit)</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(850);
            setActiveMode('WITHDRAWAL');
            setSuccessReceipt(null);
            setErrorMsg(null);
          }}
          className={`flex-1 min-h-[44px] px-4 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
            activeMode === 'WITHDRAWAL'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25'
              : 'text-emerald-200 hover:text-white'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
          <span>ক্যাশ-আউট (Withdrawal)</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick(850);
            setActiveMode('HISTORY');
            setSuccessReceipt(null);
            setErrorMsg(null);
          }}
          className={`min-h-[44px] px-5 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap ${
            activeMode === 'HISTORY'
              ? 'bg-amber-400 text-slate-950 font-black shadow-md'
              : 'text-emerald-200 hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>লেনদেন খতিয়ান ({paymentRequests.length})</span>
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-300 text-xs font-mono flex items-center space-x-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Receipt Modal / Card */}
      {successReceipt && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 border-2 border-amber-400/80 rounded-3xl p-6 text-white space-y-4 shadow-2xl animate-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-emerald-700/60 pb-3">
            <div className="flex items-center space-x-2 text-amber-300 font-bold font-mono text-sm">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
              <span>{successReceipt.type} রিকোয়েস্ট নিশ্চিত সম্পন্ন হয়েছে!</span>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/40">
              STATUS: {successReceipt.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
            <div className="bg-emerald-950/80 p-3 rounded-xl border border-emerald-700/60">
              <span className="text-emerald-300/80 text-[10px]">রিকোয়েস্ট আইডি</span>
              <div className="font-bold text-white mt-0.5 truncate">{successReceipt.id}</div>
            </div>
            <div className="bg-emerald-950/80 p-3 rounded-xl border border-emerald-700/60">
              <span className="text-emerald-300/80 text-[10px]">পেমেন্ট মেথড</span>
              <div className="font-bold text-amber-300 mt-0.5">{successReceipt.method}</div>
            </div>
            <div className="bg-emerald-950/80 p-3 rounded-xl border border-emerald-700/60">
              <span className="text-emerald-300/80 text-[10px]">টাকার পরিমাণ</span>
              <div className="font-black text-amber-300 text-sm mt-0.5">
                {successReceipt.currency === 'BDT' ? '৳' : '$'} {successReceipt.amount.toLocaleString()}
              </div>
            </div>
            <div className="bg-emerald-950/80 p-3 rounded-xl border border-emerald-700/60">
              <span className="text-emerald-300/80 text-[10px]">TrxID / হ্যাশ</span>
              <div className="font-bold text-emerald-300 mt-0.5 truncate">{successReceipt.trx_id}</div>
            </div>
          </div>

          <div className="p-3 bg-emerald-950/90 rounded-xl text-xs font-mono text-emerald-200 border border-emerald-700/60 flex items-center justify-between">
            <span className="flex items-center space-x-1.5 text-amber-300">
              <ShieldCheck className="w-4 h-4" />
              <span>{successReceipt.admin_note || 'স্বয়ংক্রিয়ভাবে ফান্ড ক্রেডিট করা হয়েছে'}</span>
            </span>
            <span className="text-[10px] text-emerald-400">
              {new Date(successReceipt.created_at).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DEPOSIT INTERFACE */}
      {/* ========================================================================= */}
      {activeMode === 'DEPOSIT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column: Payment Channel Selector */}
          <div className="lg:col-span-5 space-y-3 font-mono">
            <label className="block text-xs uppercase tracking-wider text-emerald-300 font-bold px-1">
              ১. পেমেন্ট চ্যানেল বেছে নিন (Select Gateway)
            </label>

            <div className="space-y-2">
              {PAYMENT_CHANNELS.map((ch) => {
                const isSelected = selectedMethod === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      soundEngine.playClick(800);
                      setSelectedMethod(ch.id);
                    }}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? `bg-gradient-to-r ${ch.themeGradient} text-white border-amber-400 shadow-xl shadow-emerald-950/60 scale-[1.01]`
                        : 'bg-emerald-950/80 border-emerald-700/60 hover:border-amber-400/60 text-emerald-200'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-sm sm:text-base flex items-center space-x-2">
                        <span>{ch.name}</span>
                      </div>
                      <div className="text-[11px] opacity-80 font-sans">{ch.banglaName}</div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        isSelected ? 'bg-black/40 text-white' : 'bg-emerald-900/80 text-emerald-300 border border-emerald-700'
                      }`}>
                        {ch.fee}
                      </span>
                      <div className="text-[10px] opacity-75">{ch.type}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Deposit Form, Number & Instructions */}
          <div className="lg:col-span-7 rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-7 space-y-5 shadow-xl">
            
            {/* Header with Selected Channel info */}
            <div className="border-b border-emerald-800 pb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-white flex items-center space-x-2">
                  <span>{activeChannel.name} ডিপোজিট</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${activeChannel.badgeColor}`}>
                    {activeChannel.type}
                  </span>
                </h2>
                <p className="text-xs text-emerald-300 font-mono mt-0.5">
                  সীমা: {currentUser.currency === 'BDT' ? `৳${activeChannel.minDepositBDT}` : `$${activeChannel.minDepositUSD}`} - {currentUser.currency === 'BDT' ? `৳${activeChannel.maxDepositBDT.toLocaleString()}` : `$${activeChannel.maxDepositUSD.toLocaleString()}`}
                </p>
              </div>

              {/* Instant Credit Toggle */}
              <div className="flex items-center space-x-2 bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-700 text-xs font-mono text-emerald-200">
                <span className="text-[10px] text-emerald-400">অটো-ক্রেডিট:</span>
                <input
                  type="checkbox"
                  checked={autoApproveSimulation}
                  onChange={(e) => setAutoApproveSimulation(e.target.checked)}
                  className="w-4 h-4 rounded bg-emerald-900 border-emerald-600 text-amber-500 focus:ring-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Agent / Gateway Number Display with 1-Click Copy */}
            <div className="bg-emerald-950/90 p-4 rounded-2xl border-2 border-amber-400/50 space-y-2 shadow-md">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="font-bold uppercase tracking-wider text-emerald-200">
                  {activeChannel.name} ভেরিফাইড নম্বর:
                </span>
                <span className="text-amber-300 font-bold flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>অফিসিয়াল মার্চেন্ট</span>
                </span>
              </div>

              <div className="flex items-center justify-between bg-emerald-900/80 px-4 py-3 rounded-xl border border-emerald-700/80">
                <span className="font-mono text-base sm:text-xl font-black text-amber-300 select-all tracking-wider">
                  {activeChannel.accountNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopyAccount}
                  className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-mono text-xs font-black transition-all active:scale-95 cursor-pointer shadow-md"
                >
                  {copiedAccount ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" />}
                  <span>{copiedAccount ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                </button>
              </div>
            </div>

            {/* Deposit Form */}
            <form onSubmit={handleDepositSubmit} className="space-y-4 font-mono text-xs">
              
              {/* Quick Amount Selector */}
              <div>
                <label className="block text-emerald-200 mb-1.5 font-bold">
                  ডিপোজিট পরিমাণ ({currentUser.currency}) *
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2.5">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick(750);
                        setDepositAmount(amt);
                      }}
                      className={`min-h-[42px] py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                        depositAmount === amt
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-md font-black'
                          : 'bg-emerald-950 border border-emerald-700/80 text-emerald-200 hover:border-amber-400/60'
                      }`}
                    >
                      {currentUser.currency === 'BDT' ? `৳${amt}` : `$${amt}`}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  required
                  min={currentUser.currency === 'BDT' ? activeChannel.minDepositBDT : activeChannel.minDepositUSD}
                  max={currentUser.currency === 'BDT' ? activeChannel.maxDepositBDT : activeChannel.maxDepositUSD}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="w-full min-h-[44px] bg-emerald-950 border-2 border-emerald-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-base font-black text-white focus:outline-none transition-colors"
                />
              </div>

              {/* Sender Phone & Transaction ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-200 mb-1 font-semibold">
                    আপনার প্রেরক নম্বর (Sender Number)
                  </label>
                  <input
                    type="text"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full min-h-[44px] bg-emerald-950 border border-emerald-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white placeholder-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-amber-300 mb-1 font-bold">
                    ট্রানজেকশন আইডি (TrxID) *
                  </label>
                  <input
                    type="text"
                    required
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    placeholder="e.g. BK98A2104X"
                    className="w-full min-h-[44px] bg-emerald-950 border-2 border-amber-400/60 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-amber-300 font-black uppercase placeholder-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Promo Code Pill */}
              <div className="flex items-center space-x-2 bg-emerald-950 p-2.5 rounded-xl border border-emerald-700/80">
                <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="PROMO CODE"
                  className="bg-transparent text-xs font-mono text-white uppercase focus:outline-none flex-1 placeholder-emerald-600"
                />
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-bold">
                  +100% WELCOME BONUS
                </span>
              </div>

              {/* Step-by-Step Instructions Accordion */}
              <div className="bg-emerald-950/80 p-3.5 rounded-xl border border-emerald-800 space-y-1.5 text-xs text-emerald-200">
                <div className="font-bold text-amber-400 flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>পেমেন্ট নির্দেশিকা (Payment Steps):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-emerald-300/80 font-sans">
                  {activeChannel.instructions.map((inst, i) => (
                    <li key={i}>{inst}</li>
                  ))}
                </ol>
              </div>

              {/* Big Action Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[52px] py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer mt-2"
              >
                <ArrowUpRight className="w-5 h-5 stroke-[3]" />
                <span>
                  {submitting
                    ? 'যাচাই করা হচ্ছে...'
                    : `ডিপোজিট নিশ্চিত করুন (${currentUser.currency === 'BDT' ? `৳${depositAmount.toLocaleString()}` : `$${depositAmount}`})`}
                </span>
              </button>
            </form>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. WITHDRAWAL INTERFACE */}
      {/* ========================================================================= */}
      {activeMode === 'WITHDRAWAL' && (
        <div className="max-w-2xl mx-auto rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="border-b border-emerald-800 pb-4">
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center space-x-2">
              <ArrowDownLeft className="w-5 h-5 text-amber-400" />
              <span>ইনস্ট্যান্ট ভিআইপি ক্যাশ-আউট (Withdrawal)</span>
            </h2>
            <p className="text-xs text-emerald-300 font-mono mt-1">
              বিকাশ, নগদ ও রকেটে সরাসরি ০-৪ সেকেন্ডের মধ্যে দ্রুত ট্রান্সফার।
            </p>
          </div>

          <form onSubmit={handleWithdrawalSubmit} className="space-y-4 font-mono text-xs">
            {/* Payout Channel Selection */}
            <div>
              <label className="block text-emerald-200 mb-1.5 font-bold">
                ক্যাশ-আউট চ্যানেল নির্বাচন করুন *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['BKASH', 'NAGAD', 'ROCKET'] as PaymentMethodType[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick(750);
                      setSelectedMethod(m);
                    }}
                    className={`py-3 rounded-xl border-2 font-bold transition-all cursor-pointer ${
                      selectedMethod === m
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 border-amber-400 shadow-md font-black'
                        : 'bg-emerald-950 border-emerald-700 text-emerald-200 hover:bg-emerald-900'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Account Number */}
            <div>
              <label className="block text-emerald-200 mb-1 font-bold">
                আপনার {selectedMethod} মোবাইল নম্বর *
              </label>
              <input
                type="text"
                required
                value={receiverNumber}
                onChange={(e) => setReceiverNumber(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full min-h-[44px] bg-emerald-950 border-2 border-emerald-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white placeholder-emerald-600 focus:outline-none"
              />
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-emerald-200 mb-1 font-bold">
                উত্তোলনের পরিমাণ ({currentUser.currency}) *
              </label>
              <input
                type="number"
                required
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                min={currentUser.currency === 'BDT' ? 500 : 5}
                className="w-full min-h-[44px] bg-emerald-950 border-2 border-emerald-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm font-black text-white focus:outline-none"
              />
            </div>

            {/* Fee Breakdown */}
            <div className="bg-emerald-950/90 p-3.5 rounded-xl border border-emerald-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-emerald-300">
                <span>উত্তোলনের পরিমাণ:</span>
                <span className="font-bold text-white">{currentUser.currency === 'BDT' ? `৳${withdrawAmount}` : `$${withdrawAmount}`}</span>
              </div>
              <div className="flex justify-between text-emerald-300">
                <span>সার্ভিস ফি (০%):</span>
                <span className="text-amber-300 font-bold">৳০.০০ (ফ্রি)</span>
              </div>
              <div className="flex justify-between text-white font-black border-t border-emerald-800 pt-1.5 text-sm">
                <span>মোট পাবেন:</span>
                <span className="text-amber-300">
                  {currentUser.currency === 'BDT' ? `৳${withdrawAmount}` : `$${withdrawAmount}`}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[50px] py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer mt-2"
            >
              <ArrowDownLeft className="w-5 h-5 stroke-[3]" />
              <span>
                {submitting ? 'ক্যাশ-আউট প্রক্রিয়াধীন...' : 'উইথড্রয়াল রিকোয়েস্ট সাবমিট করুন'}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. HISTORY & PAYMENT REQUESTS LEDGER */}
      {/* ========================================================================= */}
      {activeMode === 'HISTORY' && (
        <div className="rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-[#02180e] border-2 border-emerald-600/40 p-5 sm:p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center space-x-2 font-sans">
              <Receipt className="w-4 h-4 text-amber-400" />
              <span>পেমেন্ট ও ক্যাশিয়ার ট্রানজেকশন হিস্ট্রি</span>
            </h2>
            <span className="text-xs text-emerald-300 font-mono">
              মোট {paymentRequests.length} টি রেকর্ড
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-emerald-950 text-emerald-300 uppercase text-[10px]">
                <tr>
                  <th className="p-3">রিকোয়েস্ট আইডি</th>
                  <th className="p-3">ধরন</th>
                  <th className="p-3">মেথড</th>
                  <th className="p-3">পরিমাণ</th>
                  <th className="p-3">TrxID / নম্বর</th>
                  <th className="p-3">স্ট্যাটাস</th>
                  <th className="p-3">সময়</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-800/80">
                {paymentRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-emerald-500">
                      কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি
                    </td>
                  </tr>
                ) : (
                  paymentRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-emerald-900/40 transition-colors">
                      <td className="p-3 font-semibold text-emerald-200 truncate max-w-[130px]">{req.id}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.type === 'DEPOSIT'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {req.type}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-white">{req.method}</td>
                      <td className="p-3 font-black text-amber-300">
                        {req.currency === 'BDT' ? '৳' : '$'} {req.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-emerald-200">
                        <div className="truncate max-w-[120px]">{req.trx_id}</div>
                        <div className="text-[10px] text-emerald-400/80">{req.sender_number || req.receiver_number}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : req.status === 'PENDING'
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3 text-emerald-400 text-[11px]">
                        {new Date(req.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </motion.div>
  );
};
