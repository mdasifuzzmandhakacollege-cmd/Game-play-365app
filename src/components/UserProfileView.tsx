import React, { useState } from 'react';
import {
  Crown,
  Sparkles,
  Shield,
  Award,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  Zap,
  Gift,
  Coins
} from 'lucide-react';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { useWalletGame } from '../contexts/WalletGameContext';
import { useAuth } from '../contexts/AuthContext';
import { WageringRequirements } from './WageringRequirements';
import { GoogleDrivePickerHub } from './GoogleDrivePickerHub';

interface UserProfileViewProps {
  currentUser: UserEntity;
  currentWallet?: WalletEntity;
  currency: 'BDT' | 'USD';
  onOpenCashier: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  currentUser,
  currentWallet,
  currency,
  onOpenCashier
}) => {
  const { transactions } = useWalletGame();
  const { user: authUser } = useAuth();
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTx, setSearchTx] = useState<string>('');
  const [copiedId, setCopiedId] = useState<boolean>(false);

  const userTransactions = transactions.filter((tx) => tx.user_id === currentUser.id);

  // VIP Stats Calculation
  const totalBets = userTransactions
    .filter((tx) => tx.type === 'BET')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalWins = userTransactions
    .filter((tx) => tx.type === 'WIN' || tx.type === 'JACKPOT')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netProfit = totalWins - totalBets;
  const winCount = userTransactions.filter((tx) => (tx.type === 'WIN' || tx.type === 'JACKPOT') && tx.amount > 0).length;
  const betCount = userTransactions.filter((tx) => tx.type === 'BET').length;
  const winRate = betCount > 0 ? ((winCount / betCount) * 100).toFixed(1) : '0.0';

  const filteredTxs = userTransactions.filter((tx) => {
    const matchType = filterType === 'ALL' || tx.type === filterType;
    const matchSearch =
      tx.transaction_id.toLowerCase().includes(searchTx.toLowerCase()) ||
      tx.game_id.toLowerCase().includes(searchTx.toLowerCase()) ||
      tx.provider_id.toLowerCase().includes(searchTx.toLowerCase());
    return matchType && matchSearch;
  });

  const handleCopyUserId = () => {
    navigator.clipboard.writeText(currentUser.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-2.5 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24 text-white">
      {/* Top VIP Card & Player Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Holographic Metallic VIP Card */}
        <div className="lg:col-span-6 relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-950/40 border border-amber-500/40 p-4 sm:p-7 shadow-2xl space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
              <span className="text-xs sm:text-sm font-black font-mono tracking-widest text-amber-300 uppercase">
                VIP CLUB PREMIER
              </span>
            </div>
            <span className="px-2.5 sm:px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-[11px] sm:text-xs font-mono uppercase shadow-md">
              GOLD TIER
            </span>
          </div>

          <div>
            <div className="text-xl sm:text-3xl font-black text-white font-mono truncate">
              {currentUser.username}
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 mt-1">
              <span className="truncate max-w-[170px] sm:max-w-[260px]">ID: {currentUser.id}</span>
              <button 
                onClick={handleCopyUserId} 
                className="min-w-[30px] min-h-[30px] p-1.5 text-amber-400 hover:text-amber-300 active:scale-95 transition-all flex items-center justify-center"
                aria-label="ইউজার আইডি কপি"
              >
                {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Balances breakdown */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-slate-950/90 p-3 sm:p-4 rounded-2xl border border-slate-800 font-mono shadow-inner">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold truncate">Real Balance</div>
              <div className="text-xs sm:text-base font-black text-amber-300 truncate">
                {currentUser.currency === 'BDT' ? `৳${currentWallet?.real_balance.toLocaleString()}` : `$${currentWallet?.real_balance.toFixed(2)}`}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold truncate">Bonus Balance</div>
              <div className="text-xs sm:text-base font-black text-emerald-400 truncate">
                {currentUser.currency === 'BDT' ? `৳${currentWallet?.bonus_balance.toLocaleString()}` : `$${currentWallet?.bonus_balance.toFixed(2)}`}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-bold truncate">Locked Wager</div>
              <div className="text-xs sm:text-base font-black text-slate-400 truncate">
                {currentUser.currency === 'BDT' ? `৳${currentWallet?.locked_balance.toLocaleString()}` : `$${currentWallet?.locked_balance.toFixed(2)}`}
              </div>
            </div>
          </div>

          {/* VIP Progress Bar */}
          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between text-slate-300">
              <span className="text-[11px] sm:text-xs">Next Tier: <strong>PLATINUM VIP</strong></span>
              <span className="text-amber-400 font-bold text-[11px] sm:text-xs">72% Completed</span>
            </div>
            <div className="w-full bg-slate-800 h-2 sm:h-2.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full w-[72%]" />
            </div>
          </div>
        </div>

        {/* VIP Benefits & Financial Metrics */}
        <div className="lg:col-span-6 grid grid-cols-2 gap-2.5 sm:gap-4">
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between font-mono">
            <div className="text-[11px] sm:text-xs text-slate-400 uppercase flex items-center justify-between font-bold">
              <span>Total Wagered</span>
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-base sm:text-xl font-black text-white mt-2 truncate">
              {currentUser.currency === 'BDT' ? `৳${totalBets.toLocaleString()}` : `$${totalBets.toFixed(2)}`}
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-400 mt-1 font-semibold">+1.2% Daily Cashback</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between font-mono">
            <div className="text-[11px] sm:text-xs text-slate-400 uppercase flex items-center justify-between font-bold">
              <span>Net P/L</span>
              {netProfit >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
            </div>
            <div className={`text-base sm:text-xl font-black mt-2 truncate ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {netProfit >= 0 ? '+' : ''}
              {currentUser.currency === 'BDT' ? `৳${netProfit.toLocaleString()}` : `$${netProfit.toFixed(2)}`}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1">Win Rate: {winRate}%</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between font-mono">
            <div className="text-[11px] sm:text-xs text-slate-400 uppercase flex items-center justify-between font-bold">
              <span>VIP Payout SLA</span>
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-base sm:text-xl font-black text-cyan-300 mt-2">&lt; 5 Mins</div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 mt-1">bKash / Nagad Direct</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-xl flex flex-col justify-between font-mono">
            <div className="text-[11px] sm:text-xs text-slate-400 uppercase flex items-center justify-between font-bold">
              <span>Daily Limit</span>
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-base sm:text-xl font-black text-purple-300 mt-2 truncate">
              {currentUser.currency === 'BDT' ? '৳ 50 Lac' : '$50,000'}
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-400 mt-1 font-semibold">Instant VIP Gold</div>
          </div>
        </div>
      </div>

      {/* Wagering Turnover Progression & Bonus Conversion */}
      <WageringRequirements
        currentUser={currentUser}
        currentWallet={currentWallet}
        currency={currency}
      />

      {/* Google Drive Picker Hub & KYC Document Vault */}
      <GoogleDrivePickerHub
        currentUser={currentUser}
      />

      {/* Transaction History Ledger Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Double-Entry Immutable Transaction Ledger</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Audit-ready records with row-level locked before/after balance checks.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="min-h-[40px] bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 font-mono focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="BET">BET (Debits)</option>
              <option value="WIN">WIN (Credits)</option>
              <option value="PROMO">PROMO (Deposits)</option>
              <option value="TIP">TIP (Withdrawals)</option>
              <option value="REFUND">REFUND</option>
            </select>

            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search TxID..."
                value={searchTx}
                onChange={(e) => setSearchTx(e.target.value)}
                className="w-full min-h-[40px] bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-3">Tx ID</th>
                <th className="p-3">Provider &amp; Game</th>
                <th className="p-3">Type</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Balance Before &rarr; After</th>
                <th className="p-3">Status</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    No transactions recorded for this filter
                  </td>
                </tr>
              ) : (
                filteredTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 text-slate-300 font-semibold truncate max-w-[140px]">
                      {tx.transaction_id}
                    </td>
                    <td className="p-3">
                      <div className="text-white font-bold">{tx.game_id}</div>
                      <div className="text-[10px] text-slate-500">{tx.provider_id}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.type === 'BET'
                          ? 'bg-red-500/20 text-red-400'
                          : tx.type === 'WIN' || tx.type === 'JACKPOT'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-3 font-bold">
                      <span className={tx.type === 'BET' || tx.type === 'TIP' ? 'text-red-400' : 'text-emerald-400'}>
                        {tx.type === 'BET' || tx.type === 'TIP' ? '-' : '+'}
                        {tx.currency === 'BDT' ? '৳' : '$'} {tx.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      <span>${tx.before_balance.toFixed(2)}</span>
                      <span className="mx-1 text-slate-600">&rarr;</span>
                      <span className="text-white font-semibold">${tx.after_balance.toFixed(2)}</span>
                    </td>
                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 text-[11px]">
                      {new Date(tx.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
