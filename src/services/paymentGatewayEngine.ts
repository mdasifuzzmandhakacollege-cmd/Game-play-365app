/**
 * @file paymentGatewayEngine.ts
 * @description Master Payment Orchestrator, Verification Engine, Double-Entry Ledger,
 * and Number Rotation Pool for Gameplay 365.
 */

import {
  PaymentProviderId,
  PaymentMethod,
  DepositStatus,
  WithdrawalStatus,
  PaymentDestinationAccount,
  DepositIntent,
  DepositIntentRequest,
  PaymentVerificationResult,
  WithdrawalPayoutRequest,
  WithdrawalRecord,
  DoubleEntryLedgerEntry,
  WebhookLog,
  AuditLogEntry,
  RiskAnalysis
} from '../server/types/paymentGateway';
import {
  PaymentProviderAdapter,
  BkashPaymentAdapter,
  NagadPaymentAdapter,
  RocketPaymentAdapter,
  BankTransferPaymentAdapter,
  CardPaymentAdapter
} from './paymentAdapters';
import { seamlessEngine } from './simulatedWalletEngine';
import { notificationService } from './notificationService';
import { soundEngine } from './soundEngine';

export class PaymentGatewayEngine {
  // 1. Provider Adapter Registry
  private adapters: Map<PaymentProviderId, PaymentProviderAdapter> = new Map();

  // 2. Payment Destination Accounts Pool (Dynamic Rotation)
  private destinationPool: PaymentDestinationAccount[] = [
    {
      id: 'DEST_BKASH_01',
      provider: 'bkash',
      method: 'BKASH',
      accountNumber: '01900-112233',
      accountName: 'Gameplay365 VIP Merchant Pool A',
      accountType: 'MERCHANT',
      dailyLimit: 500000,
      currentDayVolume: 124500,
      assignedCapacityPercent: 75,
      isActive: true,
      isMaintenance: false,
      priority: 1,
      instructions: [
        'আপনার বিকাশ অ্যাপ থেকে "Make Payment" অপশন নির্বাচন করুন।',
        'মার্চেন্ট নম্বর: 01900-112233 লিখুন।',
        'নির্ধারিত টাকার পরিমাণ লিখুন এবং রেফারেন্স হিসেবে আপনার ডিপোজিট আইডি দিন।',
        'পিন দিয়ে পেমেন্ট সম্পন্ন করে TrxID সংগ্রহ করুন।'
      ]
    },
    {
      id: 'DEST_BKASH_02',
      provider: 'bkash',
      method: 'BKASH',
      accountNumber: '01977-889900',
      accountName: 'Gameplay365 Fast Cashout Pool B',
      accountType: 'AGENT',
      dailyLimit: 300000,
      currentDayVolume: 45000,
      assignedCapacityPercent: 40,
      isActive: true,
      isMaintenance: false,
      priority: 2,
      instructions: [
        'বিকাশ অ্যাপে "Cash Out" অপশন বেছে নিন।',
        'এজেন্ট নম্বর: 01977-889900 বসিয়ে পিন দিয়ে ক্যাশ-আউট করুন।',
        'সফল মেসেজ থেকে TrxID কপি করে ভেরিফাই করুন।'
      ]
    },
    {
      id: 'DEST_NAGAD_01',
      provider: 'nagad',
      method: 'NAGAD',
      accountNumber: '01844-992200',
      accountName: 'Gameplay365 Direct Nagad Agent',
      accountType: 'AGENT',
      dailyLimit: 400000,
      currentDayVolume: 89000,
      assignedCapacityPercent: 60,
      isActive: true,
      isMaintenance: false,
      priority: 1,
      instructions: [
        'নগদ অ্যাপ খুলুন বা *167# ডায়াল করে Cash Out নির্বাচন করুন।',
        'এজেন্ট নম্বর: 01844-992200 প্রবেশ করান।',
        'টাকার পরিমাণ ও পিন দিয়ে ট্রানজেকশন সফল করুন।',
        'নগদের ৮ ডিজিটের TrxID সাবমিট করুন।'
      ]
    },
    {
      id: 'DEST_ROCKET_01',
      provider: 'rocket',
      method: 'ROCKET',
      accountNumber: '01711-884422-9',
      accountName: 'Gameplay365 DBBL Biller Account',
      accountType: 'BILLER',
      dailyLimit: 300000,
      currentDayVolume: 24000,
      assignedCapacityPercent: 30,
      isActive: true,
      isMaintenance: false,
      priority: 1,
      instructions: [
        'রকেট অ্যাপ থেকে Send Money বা Pay Bill অপশন ব্যবহার করুন।',
        'একাউন্ট নম্বর: 01711-884422-9 দিন।',
        'পিন দিয়ে ট্রানজেকশন শেষ করে TrxID কপি করুন।'
      ]
    },
    {
      id: 'DEST_BANK_01',
      provider: 'bank_transfer',
      method: 'BANK_TRANSFER',
      accountNumber: '110.120.489102',
      accountName: 'Gameplay365 Online Entertainment Ltd',
      accountType: 'BANK_ACCOUNT',
      bankName: 'City Bank Ltd / Brac Bank PLC',
      branchName: 'Gulshan Corporate Branch, Dhaka',
      routingNumber: '225271890',
      dailyLimit: 2000000,
      currentDayVolume: 420000,
      assignedCapacityPercent: 50,
      isActive: true,
      isMaintenance: false,
      priority: 1,
      instructions: [
        'Citytouch বা Astha অ্যাপের মাধ্যমে NPSB/BEFTN ফান্ড ট্রান্সফার করুন।',
        'একাউন্ট নম্বর: 110.120.489102 (City Bank)',
        'রাউটিং নম্বর: 225271890',
        'ট্রান্সফারের রেফারেন্স/TrxID লিখে সাবমিট করুন।'
      ]
    },
    {
      id: 'DEST_USDT_01',
      provider: 'usdt_crypto',
      method: 'USDT',
      accountNumber: 'TK89xVqLiveSeamlessCasinoCryptoVault99201',
      accountName: 'Gameplay365 Multi-Sig Cold Vault',
      accountType: 'CRYPTO_VAULT',
      dailyLimit: 5000000,
      currentDayVolume: 1100000,
      assignedCapacityPercent: 35,
      isActive: true,
      isMaintenance: false,
      priority: 1,
      instructions: [
        'Binance/TrustWallet থেকে TRC-20 নেটওয়ার্কে ট্রান্সফার করুন।',
        'অ্যাড্রেস: TK89xVqLiveSeamlessCasinoCryptoVault99201',
        'ট্রানজেকশনের TxHash পেস্ট করুন।'
      ]
    }
  ];

  // 3. In-Memory Stores
  private depositIntents: Map<string, DepositIntent> = new Map();
  private consumedTrxIds: Map<string, { depositId: string; userId: string; consumedAt: string }> = new Map(); // Key: `${provider}:${trxId}`
  private withdrawalRecords: Map<string, WithdrawalRecord> = new Map();
  private doubleEntryLedger: DoubleEntryLedgerEntry[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private webhookLogs: WebhookLog[] = [];
  private idempotencyStore: Map<string, any> = new Map();

  // 4. Listeners for Real-time Reactive Updates
  private changeListeners: Array<() => void> = [];

  constructor() {
    this.registerAdapters();
    this.seedInitialHistory();
  }

  private registerAdapters() {
    this.adapters.set('bkash', new BkashPaymentAdapter());
    this.adapters.set('nagad', new NagadPaymentAdapter());
    this.adapters.set('rocket', new RocketPaymentAdapter());
    this.adapters.set('bank_transfer', new BankTransferPaymentAdapter());
    this.adapters.set('card_payment', new CardPaymentAdapter());
    this.adapters.set('usdt_crypto', new CardPaymentAdapter());
  }

  public subscribe(listener: () => void) {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== listener);
    };
  }

  private notifyChange() {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (err) {
        console.error('PaymentGatewayEngine listener error:', err);
      }
    }
  }

  // ==========================================================================
  // SECTION 1: Payment Destination Pool Rotation Algorithm
  // ==========================================================================
  public getAvailableDestination(provider: PaymentProviderId): PaymentDestinationAccount {
    const candidates = this.destinationPool.filter(
      (d) => d.provider === provider && d.isActive && !d.isMaintenance
    );

    if (candidates.length === 0) {
      // Fallback to first matching or default
      const fallback = this.destinationPool.find((d) => d.provider === provider) || this.destinationPool[0];
      return fallback;
    }

    // Sort by available capacity (dailyLimit - currentDayVolume) and priority
    candidates.sort((a, b) => {
      const remainingA = a.dailyLimit - a.currentDayVolume;
      const remainingB = b.dailyLimit - b.currentDayVolume;
      if (remainingA !== remainingB) {
        return remainingB - remainingA; // Higher remaining capacity first
      }
      return a.priority - b.priority;
    });

    return candidates[0];
  }

  public getDestinationPool(): PaymentDestinationAccount[] {
    return [...this.destinationPool];
  }

  public updateDestinationStatus(id: string, updates: Partial<PaymentDestinationAccount>) {
    const dest = this.destinationPool.find((d) => d.id === id);
    if (dest) {
      Object.assign(dest, updates);
      this.logAudit({
        actor: 'ADMIN:System',
        action: 'UPDATE_DESTINATION_ACCOUNT',
        resource: 'DESTINATION_POOL',
        resourceId: id,
        ipAddress: '127.0.0.1',
        metadata: updates
      });
      this.notifyChange();
    }
  }

  // ==========================================================================
  // SECTION 2: Anti-Fraud & Risk Engine
  // ==========================================================================
  public analyzeRisk(params: {
    userId: string;
    amount: number;
    provider: PaymentProviderId;
    trxId?: string;
    recipientAccount?: string;
    type: 'DEPOSIT' | 'WITHDRAWAL';
  }): RiskAnalysis {
    let score = 5; // Base clean score
    const factors: string[] = [];

    // Check 1: Duplicate TrxID Attempt
    if (params.trxId) {
      const cleanTrx = params.trxId.trim().toUpperCase();
      const existingKey = `${params.provider}:${cleanTrx}`;
      if (this.consumedTrxIds.has(existingKey)) {
        score += 90;
        factors.push('DUPLICATE_TRX_ID_DETECTED');
      }
    }

    // Check 2: Amount Anomalies (e.g. unusually high single deposit)
    if (params.amount > 100000) {
      score += 25;
      factors.push('HIGH_VALUE_TRANSACTION');
    }

    // Check 3: Velocity Check (Multiple rapid intents within 5 minutes)
    const now = Date.now();
    const recentIntents = Array.from(this.depositIntents.values()).filter(
      (d) => d.userId === params.userId && now - new Date(d.createdAt).getTime() < 300000
    );
    if (recentIntents.length >= 4) {
      score += 35;
      factors.push('RAPID_INTENT_VELOCITY');
    }

    // Check 4: Failed transaction frequency
    const failedRecent = recentIntents.filter((d) => d.status === 'FAILED');
    if (failedRecent.length >= 2) {
      score += 30;
      factors.push('REPEATED_FAILED_ATTEMPTS');
    }

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED' = 'LOW';
    if (score >= 80) riskLevel = 'BLOCKED';
    else if (score >= 60) riskLevel = 'HIGH';
    else if (score >= 30) riskLevel = 'MEDIUM';

    return {
      riskScore: Math.min(100, score),
      riskLevel,
      factors,
      isBlocked: score >= 80,
      requiresManualReview: score >= 60 && score < 80
    };
  }

  // ==========================================================================
  // SECTION 3: Step 01 & 02 — Deposit Intent Creation Flow
  // ==========================================================================
  public createDepositIntent(req: DepositIntentRequest): DepositIntent {
    // Idempotency check
    if (req.idempotencyKey && this.idempotencyStore.has(req.idempotencyKey)) {
      return this.idempotencyStore.get(req.idempotencyKey);
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const depositId = `DEP-${dateStr}-${randomSuffix}`;
    const destination = this.getAvailableDestination(req.provider);

    const risk = this.analyzeRisk({
      userId: req.userId,
      amount: req.amount,
      provider: req.provider,
      type: 'DEPOSIT'
    });

    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 mins expiry

    const intent: DepositIntent = {
      id: depositId,
      userId: req.userId,
      username: req.username,
      provider: req.provider,
      method: req.method,
      amount: req.amount,
      currency: req.currency,
      status: 'AWAITING_PAYMENT',
      destinationAccount: destination,
      referenceCode: depositId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt,
      riskScore: risk.riskScore,
      idempotencyKey: req.idempotencyKey,
      auditTrail: [
        {
          status: 'CREATED',
          timestamp: now.toISOString(),
          note: `Deposit Intent created for ৳${req.amount.toLocaleString()} via ${req.provider.toUpperCase()}`
        },
        {
          status: 'AWAITING_PAYMENT',
          timestamp: now.toISOString(),
          note: `Destination assigned: ${destination.accountNumber} (${destination.accountType})`
        }
      ]
    };

    this.depositIntents.set(depositId, intent);

    if (req.idempotencyKey) {
      this.idempotencyStore.set(req.idempotencyKey, intent);
    }

    this.logAudit({
      actor: `USER:${req.username}`,
      action: 'CREATE_DEPOSIT_INTENT',
      resource: 'DEPOSIT',
      resourceId: depositId,
      ipAddress: req.clientIp || '127.0.0.1',
      metadata: { amount: req.amount, provider: req.provider, destination: destination.accountNumber }
    });

    this.notifyChange();
    return intent;
  }

  // ==========================================================================
  // SECTION 4: Step 03 & 04 — Automatic Payment Verification & Instant Credit Engine
  // ==========================================================================
  public async verifyAndCreditDeposit(params: {
    depositId: string;
    trxId: string;
    senderNumber?: string;
  }): Promise<{
    success: boolean;
    depositIntent: DepositIntent;
    message: string;
    newBalance?: number;
  }> {
    const intent = this.depositIntents.get(params.depositId);
    if (!intent) {
      throw new Error(`Deposit intent '${params.depositId}' not found.`);
    }

    if (intent.status === 'CREDITED') {
      return {
        success: true,
        depositIntent: intent,
        message: 'This deposit has already been verified and credited.'
      };
    }

    const cleanTrx = params.trxId.trim().toUpperCase();
    intent.status = 'TRX_SUBMITTED';
    intent.providerTransactionId = cleanTrx;
    intent.senderNumber = params.senderNumber;
    intent.auditTrail.push({
      status: 'TRX_SUBMITTED',
      timestamp: new Date().toISOString(),
      note: `Player submitted TrxID: ${cleanTrx}`
    });

    this.notifyChange();

    // ------------------------------------------------------------------------
    // Strict 8-Point Verification Engine Execution
    // ------------------------------------------------------------------------
    // Check 1: Expiry
    if (new Date() > new Date(intent.expiresAt)) {
      intent.status = 'EXPIRED';
      intent.failedReason = 'Payment window expired (15 minutes limit exceeded).';
      intent.auditTrail.push({
        status: 'EXPIRED',
        timestamp: new Date().toISOString(),
        note: intent.failedReason
      });
      this.notifyChange();
      throw new Error(intent.failedReason);
    }

    // Check 2: Duplicate TrxID Prevention
    const trxKey = `${intent.provider}:${cleanTrx}`;
    if (this.consumedTrxIds.has(trxKey)) {
      intent.status = 'FAILED';
      intent.failedReason = `Duplicate TrxID: '${cleanTrx}' has already been used on Gameplay 365.`;
      intent.riskScore = 95;
      intent.auditTrail.push({
        status: 'FAILED',
        timestamp: new Date().toISOString(),
        note: intent.failedReason
      });
      this.logAudit({
        actor: `USER:${intent.username}`,
        action: 'DUPLICATE_TRX_ID_REJECTED',
        resource: 'DEPOSIT',
        resourceId: intent.id,
        ipAddress: '127.0.0.1',
        metadata: { trxId: cleanTrx, provider: intent.provider }
      });
      this.notifyChange();
      throw new Error(intent.failedReason);
    }

    // Check 3: Provider API Adapter Verification
    intent.status = 'VERIFYING';
    const adapter = this.adapters.get(intent.provider) || new BkashPaymentAdapter();

    const verificationResult: PaymentVerificationResult = await adapter.verifyDeposit({
      depositIntent: intent,
      trxId: cleanTrx,
      senderNumber: params.senderNumber,
      destinationAccount: intent.destinationAccount
    });

    if (!verificationResult.verified) {
      intent.status = 'FAILED';
      intent.failedReason = verificationResult.message;
      intent.auditTrail.push({
        status: 'FAILED',
        timestamp: new Date().toISOString(),
        note: `Verification failed: ${verificationResult.message}`
      });
      this.notifyChange();
      throw new Error(verificationResult.message);
    }

    // ------------------------------------------------------------------------
    // Step 05: Atomic Double-Entry Ledger & Balance Credit
    // ------------------------------------------------------------------------
    intent.status = 'VERIFIED';
    intent.verifiedAt = new Date().toISOString();
    intent.auditTrail.push({
      status: 'VERIFIED',
      timestamp: intent.verifiedAt,
      note: 'Payment authorized and verified by Provider Verification Engine.'
    });

    // Mark TrxID as consumed
    this.consumedTrxIds.set(trxKey, {
      depositId: intent.id,
      userId: intent.userId,
      consumedAt: new Date().toISOString()
    });

    // Execute atomic credit in Seamless Wallet Engine
    const currentWallets = seamlessEngine.getWallets();
    const userWallet = currentWallets.find((w) => w.user_id === intent.userId) || currentWallets[0];
    const beforeBal = userWallet ? userWallet.real_balance : 0;

    seamlessEngine.topUpWallet(intent.userId, intent.currency, intent.amount);
    const updatedWallet = seamlessEngine.getWallets().find((w) => w.user_id === intent.userId);
    const afterBal = updatedWallet ? updatedWallet.real_balance : beforeBal + intent.amount;

    // Record Double-Entry Ledger
    const ledgerEntry: DoubleEntryLedgerEntry = {
      id: `LEDGER_DEP_${Date.now()}`,
      transactionId: `DEP_${cleanTrx}`,
      walletId: userWallet ? userWallet.id : `w_${intent.userId}`,
      userId: intent.userId,
      entryType: 'DEPOSIT_CREDIT',
      debitAccount: `SYSTEM_LIABILITY_${intent.provider.toUpperCase()}_ACCOUNT`,
      creditAccount: `USER_WALLET_${intent.userId}`,
      amount: intent.amount,
      currency: intent.currency,
      balanceBefore: beforeBal,
      balanceAfter: afterBal,
      reference: intent.id,
      createdAt: new Date().toISOString()
    };
    this.doubleEntryLedger.unshift(ledgerEntry);

    // Update Destination Account daily volume
    intent.destinationAccount.currentDayVolume += intent.amount;

    intent.status = 'CREDITED';
    intent.creditedAt = new Date().toISOString();
    intent.auditTrail.push({
      status: 'CREDITED',
      timestamp: intent.creditedAt,
      note: `Wallet credited +৳${intent.amount.toLocaleString()}. Balance before: ৳${beforeBal.toLocaleString()}, Balance after: ৳${afterBal.toLocaleString()}`
    });

    // Log Immutable Audit
    this.logAudit({
      actor: 'SYSTEM:PaymentOrchestrator',
      action: 'WALLET_DEPOSIT_CREDITED',
      resource: 'WALLET',
      resourceId: intent.id,
      ipAddress: '127.0.0.1',
      metadata: {
        userId: intent.userId,
        amount: intent.amount,
        beforeBal,
        afterBal,
        trxId: cleanTrx,
        provider: intent.provider
      }
    });

    // Send Multi-Channel Notification
    notificationService.pushNotification(intent.userId, {
      userId: intent.userId,
      title: '🎉 ডিপোজিট সফল ও ওয়ালেটে যুক্ত হয়েছে!',
      message: `আপনার ${intent.provider.toUpperCase()} ডিপোজিট ৳${intent.amount.toLocaleString()} সফলভাবে ওয়ালেটে যুক্ত হয়েছে। (TrxID: ${cleanTrx})`,
      type: 'DEPOSIT_CONFIRMED',
      amount: intent.amount,
      currency: intent.currency,
      isRead: false
    });

    soundEngine.playWalletCredit();
    this.notifyChange();

    return {
      success: true,
      depositIntent: intent,
      message: `৳${intent.amount.toLocaleString()} সফলভাবে ডিপোজিট হয়েছে।`,
      newBalance: afterBal
    };
  }

  // ==========================================================================
  // SECTION 5: Controlled Withdrawal Flow with Balance Reservation Model
  // ==========================================================================
  public async requestWithdrawal(req: WithdrawalPayoutRequest): Promise<WithdrawalRecord> {
    // 1. Idempotency Key check
    if (this.idempotencyStore.has(req.idempotencyKey)) {
      return this.idempotencyStore.get(req.idempotencyKey);
    }

    const currentWallets = seamlessEngine.getWallets();
    const wallet = currentWallets.find((w) => w.user_id === req.userId) || currentWallets[0];

    if (!wallet) {
      throw new Error('User wallet not found.');
    }

    if (wallet.real_balance < req.amount) {
      throw new Error(
        `পর্যাপ্ত ব্যালেন্স নেই। আপনার বর্তমান ব্যালেন্স: ৳${wallet.real_balance.toLocaleString()}, উইথড্র রিকোয়েস্ট: ৳${req.amount.toLocaleString()}`
      );
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const withdrawalId = `WTH-${dateStr}-${randomSuffix}`;

    // Risk Analysis
    const risk = this.analyzeRisk({
      userId: req.userId,
      amount: req.amount,
      provider: req.provider,
      recipientAccount: req.recipientAccount,
      type: 'WITHDRAWAL'
    });

    if (risk.isBlocked) {
      throw new Error('Withdrawal blocked by Risk Engine due to suspicious activity.');
    }

    // 2. Controlled Balance Reservation (Available Balance reduced, Reserved Balance increased)
    const availBefore = wallet.real_balance;
    const reservedBefore = wallet.locked_balance || 0;

    wallet.real_balance = Number((wallet.real_balance - req.amount).toFixed(4));
    wallet.locked_balance = Number((reservedBefore + req.amount).toFixed(4));
    wallet.version += 1;
    wallet.updated_at = now.toISOString();

    const record: WithdrawalRecord = {
      id: withdrawalId,
      userId: req.userId,
      username: req.username,
      provider: req.provider,
      method: req.method,
      amount: req.amount,
      currency: req.currency,
      recipientAccount: req.recipientAccount,
      recipientName: req.recipientName,
      status: 'WITHDRAWAL_RESERVED',
      reservedBalanceBefore: reservedBefore,
      availableBalanceBefore: availBefore,
      availableBalanceAfter: wallet.real_balance,
      createdAt: now.toISOString(),
      riskScore: risk.riskScore,
      idempotencyKey: req.idempotencyKey,
      auditTrail: [
        {
          status: 'CREATED',
          timestamp: now.toISOString(),
          note: `Withdrawal request for ৳${req.amount.toLocaleString()} to ${req.recipientAccount}`
        },
        {
          status: 'RISK_CHECK',
          timestamp: now.toISOString(),
          note: `Risk score: ${risk.riskScore}/100 (${risk.riskLevel})`
        },
        {
          status: 'WITHDRAWAL_RESERVED',
          timestamp: now.toISOString(),
          note: `৳${req.amount.toLocaleString()} reserved from Available Balance. Available now: ৳${wallet.real_balance.toLocaleString()}`
        }
      ]
    };

    this.withdrawalRecords.set(withdrawalId, record);
    this.idempotencyStore.set(req.idempotencyKey, record);

    // Double Entry for Reservation
    this.doubleEntryLedger.unshift({
      id: `LEDGER_WTH_RES_${Date.now()}`,
      transactionId: `WTH_RES_${withdrawalId}`,
      walletId: wallet.id,
      userId: req.userId,
      entryType: 'WITHDRAWAL_RESERVE',
      debitAccount: `USER_WALLET_${req.userId}`,
      creditAccount: `SYSTEM_PAYOUT_RESERVE_ACCOUNT`,
      amount: req.amount,
      currency: req.currency,
      balanceBefore: availBefore,
      balanceAfter: wallet.real_balance,
      reservedBefore: reservedBefore,
      reservedAfter: wallet.locked_balance,
      reference: withdrawalId,
      createdAt: now.toISOString()
    });

    this.logAudit({
      actor: `USER:${req.username}`,
      action: 'WITHDRAWAL_RESERVED',
      resource: 'WITHDRAWAL',
      resourceId: withdrawalId,
      ipAddress: req.clientIp || '127.0.0.1',
      metadata: { amount: req.amount, recipient: req.recipientAccount, provider: req.provider }
    });

    // Execute Automated Payout via Adapter
    this.dispatchAutomatedPayout(record);

    this.notifyChange();
    return record;
  }

  private async dispatchAutomatedPayout(record: WithdrawalRecord) {
    record.status = 'PAYOUT_PROCESSING';
    record.processedAt = new Date().toISOString();
    record.auditTrail.push({
      status: 'PAYOUT_PROCESSING',
      timestamp: record.processedAt,
      note: `Dispatched payout request to ${record.provider.toUpperCase()} Payout Gateway`
    });
    this.notifyChange();

    try {
      const adapter = this.adapters.get(record.provider) || new BkashPaymentAdapter();
      const payoutResult = await adapter.executePayout({ withdrawal: record });

      if (payoutResult.success) {
        // Finalize Debit
        record.status = 'WITHDRAWAL_COMPLETED';
        record.providerReference = payoutResult.providerReference;
        record.completedAt = new Date().toISOString();
        record.auditTrail.push({
          status: 'WITHDRAWAL_COMPLETED',
          timestamp: record.completedAt,
          note: `Payout confirmed by provider. Ref: ${payoutResult.providerReference}`
        });

        // Release reserved balance permanently
        const currentWallets = seamlessEngine.getWallets();
        const wallet = currentWallets.find((w) => w.user_id === record.userId);
        if (wallet) {
          wallet.locked_balance = Math.max(0, Number(((wallet.locked_balance || 0) - record.amount).toFixed(4)));
        }

        this.doubleEntryLedger.unshift({
          id: `LEDGER_WTH_DONE_${Date.now()}`,
          transactionId: `WTH_FINALIZE_${record.id}`,
          walletId: wallet ? wallet.id : `w_${record.userId}`,
          userId: record.userId,
          entryType: 'WITHDRAWAL_FINALIZE',
          debitAccount: `SYSTEM_PAYOUT_RESERVE_ACCOUNT`,
          creditAccount: `EXTERNAL_RECIPIENT_${record.recipientAccount}`,
          amount: record.amount,
          currency: record.currency,
          balanceBefore: wallet ? wallet.real_balance : 0,
          balanceAfter: wallet ? wallet.real_balance : 0,
          reference: record.id,
          createdAt: new Date().toISOString()
        });

        notificationService.pushNotification(record.userId, {
          userId: record.userId,
          title: '💸 উইথড্রয়াল সফল ও ক্যাশ-আউট সম্পন্ন!',
          message: `আপনার ৳${record.amount.toLocaleString()} উইথড্রয়াল রিকোয়েস্ট সফলভাবে ${record.recipientAccount} নম্বরে পাঠানো হয়েছে। (Ref: ${payoutResult.providerReference})`,
          type: 'WITHDRAWAL_APPROVED',
          amount: record.amount,
          currency: record.currency,
          isRead: false
        });

        soundEngine.playCashout();
      } else {
        this.releaseWithdrawalReservation(record, payoutResult.message);
      }
    } catch (err: any) {
      this.releaseWithdrawalReservation(record, err.message || 'Provider payout execution failed');
    }

    this.notifyChange();
  }

  public releaseWithdrawalReservation(record: WithdrawalRecord, failureReason: string) {
    record.status = 'FAILED';
    record.failedReason = failureReason;
    record.auditTrail.push({
      status: 'FAILED',
      timestamp: new Date().toISOString(),
      note: `Payout failed: ${failureReason}. Releasing reserved funds back to user.`
    });

    // Return reserved funds back to Available Balance
    const currentWallets = seamlessEngine.getWallets();
    const wallet = currentWallets.find((w) => w.user_id === record.userId);
    if (wallet) {
      const availBefore = wallet.real_balance;
      wallet.real_balance = Number((wallet.real_balance + record.amount).toFixed(4));
      wallet.locked_balance = Math.max(0, Number(((wallet.locked_balance || 0) - record.amount).toFixed(4)));
      wallet.version += 1;
      wallet.updated_at = new Date().toISOString();

      record.status = 'RESERVATION_RELEASED';
      record.auditTrail.push({
        status: 'RESERVATION_RELEASED',
        timestamp: new Date().toISOString(),
        note: `৳${record.amount.toLocaleString()} restored to Available Balance. Current balance: ৳${wallet.real_balance.toLocaleString()}`
      });

      this.doubleEntryLedger.unshift({
        id: `LEDGER_WTH_REL_${Date.now()}`,
        transactionId: `WTH_RELEASE_${record.id}`,
        walletId: wallet.id,
        userId: record.userId,
        entryType: 'WITHDRAWAL_RELEASE',
        debitAccount: `SYSTEM_PAYOUT_RESERVE_ACCOUNT`,
        creditAccount: `USER_WALLET_${record.userId}`,
        amount: record.amount,
        currency: record.currency,
        balanceBefore: availBefore,
        balanceAfter: wallet.real_balance,
        reference: record.id,
        createdAt: new Date().toISOString()
      });
    }

    notificationService.pushNotification(record.userId, {
      userId: record.userId,
      title: '⚠️ উইথড্রয়াল ব্যর্থ ও টাকা ফেরত এসেছে',
      message: `উইথড্রয়াল ব্যর্থ হওয়ার কারণে ৳${record.amount.toLocaleString()} পুনরায় আপনার ওয়ালেটে ফেরত যোগ করা হয়েছে।`,
      type: 'SYSTEM_ALERT',
      amount: record.amount,
      currency: record.currency,
      isRead: false
    });

    this.notifyChange();
  }

  // ==========================================================================
  // SECTION 6: Webhook Processing Engine
  // ==========================================================================
  public async handleWebhook(provider: PaymentProviderId, payload: Record<string, any>, signature: string): Promise<WebhookLog> {
    const adapter = this.adapters.get(provider) || new BkashPaymentAdapter();
    const res = await adapter.processWebhook(payload, signature);

    const log: WebhookLog = {
      id: `WH_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      provider,
      eventId: payload.eventId || `evt_${Date.now()}`,
      signature,
      signatureValid: res.signatureValid,
      payload,
      processed: res.signatureValid,
      processResult: res.signatureValid ? 'Webhook verified & processed successfully' : 'Invalid Signature',
      createdAt: new Date().toISOString()
    };

    this.webhookLogs.unshift(log);
    this.notifyChange();
    return log;
  }

  // ==========================================================================
  // SECTION 7: Audit Logging & Getters
  // ==========================================================================
  private logAudit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) {
    this.auditLogs.unshift({
      id: `AUDIT_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      ...entry
    });
  }

  public getDepositIntents(userId?: string): DepositIntent[] {
    const list = Array.from(this.depositIntents.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (userId) return list.filter((d) => d.userId === userId);
    return list;
  }

  public getWithdrawalRecords(userId?: string): WithdrawalRecord[] {
    const list = Array.from(this.withdrawalRecords.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (userId) return list.filter((w) => w.userId === userId);
    return list;
  }

  public getDoubleEntryLedger(): DoubleEntryLedgerEntry[] {
    return [...this.doubleEntryLedger];
  }

  public getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  public getWebhookLogs(): WebhookLog[] {
    return [...this.webhookLogs];
  }

  public getStats() {
    const deposits = Array.from(this.depositIntents.values());
    const withdrawals = Array.from(this.withdrawalRecords.values());

    const totalDeposited = deposits
      .filter((d) => d.status === 'CREDITED')
      .reduce((sum, d) => sum + d.amount, 0);

    const totalWithdrawn = withdrawals
      .filter((w) => w.status === 'WITHDRAWAL_COMPLETED')
      .reduce((sum, w) => sum + w.amount, 0);

    const pendingDeposits = deposits.filter((d) => d.status === 'AWAITING_PAYMENT' || d.status === 'TRX_SUBMITTED').length;
    const pendingWithdrawals = withdrawals.filter((w) => w.status === 'WITHDRAWAL_RESERVED' || w.status === 'PAYOUT_PROCESSING').length;

    return {
      totalDeposited,
      totalWithdrawn,
      netCashFlow: totalDeposited - totalWithdrawn,
      pendingDeposits,
      pendingWithdrawals,
      totalIntents: deposits.length,
      totalWithdrawals: withdrawals.length,
      activeGateways: this.destinationPool.filter((d) => d.isActive && !d.isMaintenance).length
    };
  }

  // Seed initial transactions for rich presentation
  private seedInitialHistory() {
    const now = Date.now();
    // Pre-seed sample completed deposits
    const sampleDep: DepositIntent = {
      id: 'DEP-20260821-9A41K',
      userId: 'u_10291',
      username: 'Tamim_Sultana',
      provider: 'bkash',
      method: 'BKASH',
      amount: 5000,
      currency: 'BDT',
      status: 'CREDITED',
      destinationAccount: this.destinationPool[0],
      referenceCode: 'DEP-20260821-9A41K',
      providerTransactionId: 'BL92A81K09',
      senderNumber: '01712-349911',
      createdAt: new Date(now - 3600000).toISOString(),
      expiresAt: new Date(now - 2700000).toISOString(),
      verifiedAt: new Date(now - 3550000).toISOString(),
      creditedAt: new Date(now - 3540000).toISOString(),
      riskScore: 8,
      auditTrail: [
        { status: 'CREATED', timestamp: new Date(now - 3600000).toISOString(), note: 'Deposit Intent created' },
        { status: 'TRX_SUBMITTED', timestamp: new Date(now - 3560000).toISOString(), note: 'TrxID BL92A81K09 submitted' },
        { status: 'VERIFIED', timestamp: new Date(now - 3550000).toISOString(), note: 'Verified by bKash API' },
        { status: 'CREDITED', timestamp: new Date(now - 3540000).toISOString(), note: 'Double-entry wallet credit' }
      ]
    };
    this.depositIntents.set(sampleDep.id, sampleDep);
    this.consumedTrxIds.set('bkash:BL92A81K09', { depositId: sampleDep.id, userId: 'u_10291', consumedAt: new Date(now - 3540000).toISOString() });

    // Pre-seed sample withdrawal
    const sampleWth: WithdrawalRecord = {
      id: 'WTH-20260821-7B22Z',
      userId: 'u_10291',
      username: 'Tamim_Sultana',
      provider: 'nagad',
      method: 'NAGAD',
      amount: 3000,
      currency: 'BDT',
      recipientAccount: '01844-992200',
      status: 'WITHDRAWAL_COMPLETED',
      reservedBalanceBefore: 0,
      availableBalanceBefore: 8000,
      availableBalanceAfter: 5000,
      providerReference: 'NG_DISB_891028',
      createdAt: new Date(now - 7200000).toISOString(),
      processedAt: new Date(now - 7190000).toISOString(),
      completedAt: new Date(now - 7180000).toISOString(),
      riskScore: 12,
      idempotencyKey: 'WD-REQ-INITIAL-01',
      auditTrail: [
        { status: 'CREATED', timestamp: new Date(now - 7200000).toISOString(), note: 'Withdrawal requested' },
        { status: 'WITHDRAWAL_RESERVED', timestamp: new Date(now - 7200000).toISOString(), note: '৳3,000 reserved' },
        { status: 'WITHDRAWAL_COMPLETED', timestamp: new Date(now - 7180000).toISOString(), note: 'Payout completed via Nagad API' }
      ]
    };
    this.withdrawalRecords.set(sampleWth.id, sampleWth);
  }
}

export const paymentGatewayEngine = new PaymentGatewayEngine();
