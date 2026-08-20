import React, { useState } from 'react';
import {
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  QrCode,
  ShieldCheck,
  Sparkles,
  Gift,
  Coins,
  Receipt,
  Download,
  RefreshCw,
  Search,
  ExternalLink
} from 'lucide-react';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { UserEntity, WalletEntity, PaymentMethodType, PaymentRequestEntity } from '../server/types/seamless';
import { notificationService } from '../services/notificationService';

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
    name: 'bKash Merchant / Personal',
    banglaName: 'বিকাশ সেন্ড মানি / পেমেন্ট',
    type: 'Merchant Wallet',
    accountNumber: '01900-112233',
    accentColor: 'from-[#E2136E] to-[#b30f57]',
    badgeColor: 'bg-[#E2136E]/20 text-[#E2136E] border-[#E2136E]/40',
    fee: '0% VIP Free',
    minDepositBDT: 500,
    maxDepositBDT: 50000,
    minDepositUSD: 5,
    maxDepositUSD: 500,
    instructions: [
      'Open your bKash Mobile App or dial *247#',
      'Select "Send Money" or "Payment" option',
      'Enter Playall 365 Agent Number: 01900-112233',
      'Enter deposit amount and confirm your bKash PIN',
      'Copy the 8-10 character Transaction ID (TrxID) and paste it below'
    ]
  },
  {
    id: 'NAGAD',
    name: 'Nagad Agent / Cash-in',
    banglaName: 'নগদ ক্যাশ ইন / সেন্ড মানি',
    type: 'Agent Wallet',
    accountNumber: '01844-992200',
    accentColor: 'from-[#F7941D] to-[#d67b0d]',
    badgeColor: 'bg-[#F7941D]/20 text-[#F7941D] border-[#F7941D]/40',
    fee: '0% VIP Free',
    minDepositBDT: 500,
    maxDepositBDT: 50000,
    minDepositUSD: 5,
    maxDepositUSD: 500,
    instructions: [
      'Open Nagad App or dial *167#',
      'Select "Send Money" or "Cash Out to Agent"',
      'Enter Nagad Agent Number: 01844-992200',
      'Confirm transaction with your Nagad PIN',
      'Copy your Nagad Transaction ID and paste below'
    ]
  },
  {
    id: 'ROCKET',
    name: 'Rocket (DBBL Banking)',
    banglaName: 'রকেট মোবাইল ব্যাংকিং',
    type: 'Biller Wallet',
    accountNumber: '01711-884422-9',
    accentColor: 'from-[#8C3494] to-[#6d2574]',
    badgeColor: 'bg-[#8C3494]/20 text-[#8C3494] border-[#8C3494]/40',
    fee: '0% VIP Free',
    minDepositBDT: 1000,
    maxDepositBDT: 50000,
    minDepositUSD: 10,
    maxDepositUSD: 500,
    instructions: [
      'Open Rocket App or dial *322#',
      'Select "Send Money" option',
      'Enter Biller/Agent: 01711-884422-9',
      'Enter amount and your 4-digit Rocket PIN',
      'Paste the 10-digit TrxID below to confirm'
    ]
  },
  {
    id: 'UPAY',
    name: 'Upay (UCB Mobile)',
    banglaName: 'উপায় পেমেন্ট',
    type: 'Direct Gateway',
    accountNumber: '01399-556677',
    accentColor: 'from-[#0072CE] to-[#005299]',
    badgeColor: 'bg-[#0072CE]/20 text-[#0072CE] border-[#0072CE]/40',
    fee: '0% VIP Free',
    minDepositBDT: 500,
    maxDepositBDT: 25000,
    minDepositUSD: 5,
    maxDepositUSD: 250,
    instructions: [
      'Open Upay App',
      'Choose "Payment" or "Fund Transfer"',
      'Enter Number: 01399-556677',
      'Submit and paste the TrxID'
    ]
  },
  {
    id: 'USDT',
    name: 'USDT Crypto (TRC-20)',
    banglaName: 'ইউএসডিটি ক্রিপ্টো ইনস্ট্যান্ট',
    type: 'Blockchain TRC20',
    accountNumber: 'TK89xVqLiveSeamlessCasinoCryptoVault99201',
    accentColor: 'from-[#26A17B] to-[#1a7357]',
    badgeColor: 'bg-[#26A17B]/20 text-[#26A17B] border-[#26A17B]/40',
    fee: '0% Network Rebate',
    minDepositBDT: 1200,
    maxDepositBDT: 1000000,
    minDepositUSD: 10,
    maxDepositUSD: 10000,
    instructions: [
      'Open Binance, TrustWallet, or OKX',
      'Select Withdrawal -> USDT -> TRC-20 Network',
      'Paste Address: TK89xVqLiveSeamlessCasinoCryptoVault99201',
      'Paste Transaction Hash (TxID) below'
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
  const [activeMode, setActiveMode] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'HISTORY'>('DEPOSIT');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('BKASH');
  
  // Deposit Form States
  const [depositAmount, setDepositAmount] = useState<number>(currency === 'BDT' ? 2500 : 25);
  const [senderNumber, setSenderNumber] = useState<string>('01712-349911');
  const [trxId, setTrxId] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('GAMEPLAY100');
  const [promoApplied, setPromoApplied] = useState<boolean>(true);
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
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxId || trxId.trim().length < 6) {
      setErrorMsg('Please enter a valid 8-10 character Transaction ID (TrxID)');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const receipt = await seamlessEngine.submitDepositRequest({
        userId: currentUser.id,
        method: selectedMethod,
        amount: depositAmount,
        currency: currentUser.currency,
        senderNumber: senderNumber,
        receiverNumber: activeChannel.accountNumber,
        trxId: trxId.trim(),
        autoApprove: autoApproveSimulation
      });

      setSuccessReceipt(receipt);
      onLedgerMutated();
      setTrxId('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Deposit submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverNumber || receiverNumber.trim().length < 8) {
      setErrorMsg('Please enter a valid mobile / wallet number');
      return;
    }

    if (currentWallet && currentWallet.real_balance < withdrawAmount) {
      setErrorMsg('Insufficient real balance for this withdrawal amount');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const receipt = await seamlessEngine.submitWithdrawalRequest({
        userId: currentUser.id,
        method: selectedMethod,
        amount: withdrawAmount,
        currency: currentUser.currency,
        receiverNumber: receiverNumber.trim(),
        autoApprove: autoApproveSimulation
      });

      // Push real-time notification for withdrawal
      notificationService.pushNotification(currentUser.id, {
        userId: currentUser.id,
        title: autoApproveSimulation
          ? `✅ ${selectedMethod.toUpperCase()} উইথড্রয়াল অনুমোদিত`
          : `⏳ ${selectedMethod.toUpperCase()} উইথড্রয়াল রিকোয়েস্ট পেন্ডিং`,
        message: autoApproveSimulation
          ? `আপনার ${currentUser.currency === 'BDT' ? '৳' : '$'}${withdrawAmount.toLocaleString()} টাকার উইথড্রয়াল অনুমোদিত হয়েছে (TrxID: ${receipt.id}).`
          : `আপনার ${currentUser.currency === 'BDT' ? '৳' : '$'}${withdrawAmount.toLocaleString()} টাকার উইথড্রয়াল রিকোয়েস্ট রিভিউ করা হচ্ছে।`,
        type: 'WITHDRAWAL_APPROVED',
        amount: withdrawAmount,
        currency: currentUser.currency as 'BDT' | 'USD',
        isRead: false,
        actionTab: 'cashier'
      });

      setSuccessReceipt(receipt);
      onLedgerMutated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Withdrawal submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const paymentRequests = seamlessEngine.getPaymentRequests();

  return (
    <div className="max-w-5xl mx-auto px-2.5 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24 text-white">
      {/* Cashier Top Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-cyan-950/40 border border-amber-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold">
            <CreditCard className="w-3.5 h-3.5" />
            <span>GAMEPLAY365 SECURE CASHIER</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
            Local Payment Gateway &amp; Instant Cashier
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Instant deposits &amp; fast withdrawals via bKash, Nagad, Rocket, and Upay.
          </p>
        </div>

        {/* Current Balance Summary Pill */}
        <div className="bg-slate-950/90 border border-slate-800 p-3 sm:p-3.5 rounded-2xl flex items-center justify-between sm:justify-start space-x-4 font-mono shadow-inner">
          <div>
            <div className="text-[10px] text-slate-400 uppercase font-bold">Available Real Balance</div>
            <div className="text-base sm:text-lg font-black text-amber-300">
              {currentUser.currency === 'BDT' ? `৳ ${currentWallet?.real_balance.toLocaleString()}` : `$ ${currentWallet?.real_balance.toFixed(2)}`}
            </div>
          </div>
          <div className="border-l border-slate-800 pl-4">
            <div className="text-[10px] text-slate-400 uppercase font-bold">VIP Payout Fee</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-400">0% FREE</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 font-mono text-xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => {
            setActiveMode('DEPOSIT');
            setSuccessReceipt(null);
            setErrorMsg(null);
          }}
          className={`flex-1 min-h-[44px] px-3 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all text-xs sm:text-sm shrink-0 active:scale-95 cursor-pointer ${
            activeMode === 'DEPOSIT'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>DEPOSIT</span>
        </button>

        <button
          onClick={() => {
            setActiveMode('WITHDRAWAL');
            setSuccessReceipt(null);
            setErrorMsg(null);
          }}
          className={`flex-1 min-h-[44px] px-3 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all text-xs sm:text-sm shrink-0 active:scale-95 cursor-pointer ${
            activeMode === 'WITHDRAWAL'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 shadow-lg font-black'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>WITHDRAWAL</span>
        </button>

        <button
          onClick={() => {
            setActiveMode('HISTORY');
            setSuccessReceipt(null);
            setErrorMsg(null);
          }}
          className={`min-h-[44px] px-4 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all text-xs sm:text-sm shrink-0 active:scale-95 cursor-pointer ${
            activeMode === 'HISTORY'
              ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Ledger ({paymentRequests.length})</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-mono flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Receipt Popup */}
      {successReceipt && (
        <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-2xl p-6 text-white space-y-4 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold font-mono text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>{successReceipt.type} REQUEST SUBMITTED</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              STATUS: {successReceipt.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
            <div>
              <span className="text-slate-400">Request ID</span>
              <div className="font-bold text-white">{successReceipt.id}</div>
            </div>
            <div>
              <span className="text-slate-400">Method</span>
              <div className="font-bold text-amber-300">{successReceipt.method}</div>
            </div>
            <div>
              <span className="text-slate-400">Amount</span>
              <div className="font-bold text-emerald-300 text-sm">
                {successReceipt.currency === 'BDT' ? '৳' : '$'} {successReceipt.amount.toLocaleString()}
              </div>
            </div>
            <div>
              <span className="text-slate-400">TrxID / Hash</span>
              <div className="font-bold text-cyan-300">{successReceipt.trx_id}</div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/80 rounded-xl text-xs font-mono text-slate-300 border border-slate-800 flex items-center justify-between">
            <span>{successReceipt.admin_note || 'Instant Verified'}</span>
            <span className="text-[10px] text-slate-500">
              {new Date(successReceipt.created_at).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DEPOSIT SECTION */}
      {/* ========================================================================= */}
      {activeMode === 'DEPOSIT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Payment Method Selection */}
          <div className="lg:col-span-5 space-y-3">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 font-bold">
              1. Select Local Deposit Channel
            </label>

            <div className="space-y-2">
              {PAYMENT_CHANNELS.map((ch) => {
                const isSelected = selectedMethod === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedMethod(ch.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between ${
                      isSelected
                        ? `bg-gradient-to-r ${ch.accentColor} text-white border-white/40 shadow-xl scale-[1.01]`
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">{ch.name}</div>
                      <div className="text-[11px] opacity-80">{ch.banglaName}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      isSelected ? 'bg-slate-950/40 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {ch.fee}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Deposit Form & Instructions */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <span>{activeChannel.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${activeChannel.badgeColor}`}>
                    {activeChannel.type}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Min: {currentUser.currency === 'BDT' ? `৳${activeChannel.minDepositBDT}` : `$${activeChannel.minDepositUSD}`} | Max: {currentUser.currency === 'BDT' ? `৳${activeChannel.maxDepositBDT}` : `$${activeChannel.maxDepositUSD}`}
                </p>
              </div>

              {/* Instant Auto-Approve Simulation Toggle */}
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                <span className="text-[10px] text-slate-400">Auto-Credit:</span>
                <input
                  type="checkbox"
                  checked={autoApproveSimulation}
                  onChange={(e) => setAutoApproveSimulation(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                />
              </div>
            </div>

            {/* Agent Number Display with 1-Click Copy */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Playall 365 {activeChannel.id} Agent Number
                </span>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Verified Agent</span>
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-900 px-4 py-3 rounded-xl border border-slate-800">
                <span className="font-mono text-base sm:text-lg font-black text-amber-300 select-all">
                  {activeChannel.accountNumber}
                </span>
                <button
                  onClick={handleCopyAccount}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-mono text-xs transition-all"
                >
                  {copiedAccount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1 text-xs text-slate-300">
              <div className="font-bold text-amber-400 font-mono text-[11px] uppercase">
                Payment Steps:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
                {activeChannel.instructions.map((inst, i) => (
                  <li key={i}>{inst}</li>
                ))}
              </ol>
            </div>

            {/* Deposit Form */}
            <form onSubmit={handleDepositSubmit} className="space-y-4">
              {/* Amount Selection */}
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1.5 font-bold">
                  Deposit Amount ({currentUser.currency})
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2.5">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDepositAmount(amt)}
                      className={`min-h-[44px] py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all active:scale-95 cursor-pointer ${
                        depositAmount === amt
                          ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {currentUser.currency === 'BDT' ? `৳${amt}` : `$${amt}`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value))}
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm sm:text-base font-mono text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Sender Phone & Transaction ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1 font-semibold">
                    Your Sender Number
                  </label>
                  <input
                    type="text"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1 font-bold text-amber-300">
                    Transaction ID (TrxID) *
                  </label>
                  <input
                    type="text"
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    placeholder="e.g. BK98A2104X"
                    required
                    className="w-full min-h-[44px] bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-amber-300 uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Promo Code */}
              <div className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Promo Code"
                  className="bg-transparent text-xs sm:text-sm font-mono text-white uppercase focus:outline-none flex-1"
                />
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-mono font-bold shrink-0">
                  +100% BONUS
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[50px] py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-emerald-500/25 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <ArrowUpRight className="w-5 h-5 stroke-[3]" />
                <span>
                  {submitting
                    ? 'VERIFYING WITH GATEWAY...'
                    : `CONFIRM DEPOSIT (${currentUser.currency === 'BDT' ? `৳${depositAmount}` : `$${depositAmount}`})`}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. WITHDRAWAL SECTION */}
      {/* ========================================================================= */}
      {activeMode === 'WITHDRAWAL' && (
        <div className="max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div>
            <h2 className="text-lg font-black text-white">Instant VIP Withdrawal</h2>
            <p className="text-xs text-slate-400 font-mono">
              Direct transfer to your bKash, Nagad, or Rocket account within 5-15 minutes.
            </p>
          </div>

          <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
            {/* Method selection */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">
                Payout Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['BKASH', 'NAGAD', 'ROCKET'] as PaymentMethodType[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMethod(m)}
                    className={`py-3 rounded-xl border font-mono text-xs font-bold transition-all ${
                      selectedMethod === m
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Withdrawal Account */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Your {selectedMethod} Mobile Account Number
              </label>
              <input
                type="text"
                value={receiverNumber}
                onChange={(e) => setReceiverNumber(e.target.value)}
                placeholder="017XXXXXXXX"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Withdrawal Amount */}
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Withdrawal Amount ({currentUser.currency})
              </label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(Number(e.target.value))}
                min={currentUser.currency === 'BDT' ? 500 : 5}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Fee Breakdown */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Withdrawal Amount:</span>
                <span>{currentUser.currency === 'BDT' ? `৳${withdrawAmount}` : `$${withdrawAmount}`}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>VIP Payout Fee (0%):</span>
                <span className="text-emerald-400">৳0.00 (FREE)</span>
              </div>
              <div className="flex justify-between text-white font-bold border-t border-slate-800 pt-1">
                <span>Net You Receive:</span>
                <span className="text-amber-300">
                  {currentUser.currency === 'BDT' ? `৳${withdrawAmount}` : `$${withdrawAmount}`}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[3]" />
              <span>
                {submitting ? 'DISPATCHING PAYOUT...' : 'SUBMIT INSTANT WITHDRAWAL'}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PAYMENT REQUESTS HISTORY LEDGER */}
      {/* ========================================================================= */}
      {activeMode === 'HISTORY' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-cyan-400" />
              <span>Local Cashier Payment Requests History</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Total {paymentRequests.length} records
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-3">Request ID</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">TrxID / Number</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {paymentRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-semibold text-slate-200">{req.id}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        req.type === 'DEPOSIT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {req.type}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-white">{req.method}</td>
                    <td className="p-3 font-bold text-amber-300">
                      {req.currency === 'BDT' ? '৳' : '$'} {req.amount.toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-300">
                      <div>{req.trx_id}</div>
                      <div className="text-[10px] text-slate-500">{req.sender_number || req.receiver_number}</div>
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
                    <td className="p-3 text-slate-400 text-[11px]">
                      {new Date(req.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
