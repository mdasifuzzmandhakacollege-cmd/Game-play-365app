/**
 * @file paymentGateway.ts
 * @description Type definitions for Gameplay 365 Fully Automated Payment Gateway & Wallet System.
 */

export type PaymentProviderId =
  | 'bkash'
  | 'nagad'
  | 'rocket'
  | 'upay'
  | 'bank_transfer'
  | 'card_payment'
  | 'usdt_crypto'
  | 'manual_channel';

export type PaymentMethod =
  | 'BKASH'
  | 'NAGAD'
  | 'ROCKET'
  | 'UPAY'
  | 'BANK_TRANSFER'
  | 'CARD_PAYMENT'
  | 'USDT'
  | 'MANUAL';

export type DepositStatus =
  | 'CREATED'
  | 'AWAITING_PAYMENT'
  | 'TRX_SUBMITTED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'CREDITED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REJECTED'
  | 'UNDER_REVIEW';

export type WithdrawalStatus =
  | 'CREATED'
  | 'VALIDATING'
  | 'RISK_CHECK'
  | 'WITHDRAWAL_RESERVED'
  | 'PAYOUT_PROCESSING'
  | 'WITHDRAWAL_COMPLETED'
  | 'FAILED'
  | 'RESERVATION_RELEASED'
  | 'REJECTED'
  | 'UNDER_REVIEW';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';

export interface PaymentDestinationAccount {
  id: string;
  provider: PaymentProviderId;
  method: PaymentMethod;
  accountNumber: string;
  accountName: string;
  accountType: 'MERCHANT' | 'PERSONAL' | 'AGENT' | 'BILLER' | 'BANK_ACCOUNT' | 'CRYPTO_VAULT';
  bankName?: string;
  branchName?: string;
  routingNumber?: string;
  dailyLimit: number;
  currentDayVolume: number;
  assignedCapacityPercent: number; // e.g. 80%
  isActive: boolean;
  isMaintenance: boolean;
  priority: number;
  qrCodeUrl?: string;
  instructions: string[];
}

export interface DepositIntentRequest {
  userId: string;
  username: string;
  provider: PaymentProviderId;
  method: PaymentMethod;
  amount: number;
  currency: 'BDT' | 'USD';
  idempotencyKey?: string;
  clientIp?: string;
  deviceFingerprint?: string;
}

export interface DepositIntent {
  id: string; // e.g. DEP-20260822-8X91K
  userId: string;
  username: string;
  provider: PaymentProviderId;
  method: PaymentMethod;
  amount: number;
  currency: 'BDT' | 'USD';
  status: DepositStatus;
  destinationAccount: PaymentDestinationAccount;
  referenceCode: string;
  providerTransactionId?: string;
  senderNumber?: string;
  createdAt: string;
  expiresAt: string;
  verifiedAt?: string;
  creditedAt?: string;
  failedReason?: string;
  riskScore: number;
  idempotencyKey?: string;
  auditTrail: Array<{
    status: DepositStatus;
    timestamp: string;
    note: string;
  }>;
}

export interface PaymentVerificationResult {
  verified: boolean;
  status: 'VERIFIED' | 'PENDING' | 'FAILED' | 'UNDER_REVIEW';
  providerTransactionId: string;
  amountReceived?: number;
  paidAt?: string;
  message: string;
  rawProviderResponse?: Record<string, any>;
  riskFlag?: string;
}

export interface WithdrawalPayoutRequest {
  userId: string;
  username: string;
  provider: PaymentProviderId;
  method: PaymentMethod;
  amount: number;
  currency: 'BDT' | 'USD';
  recipientAccount: string;
  recipientName?: string;
  bankName?: string;
  idempotencyKey: string;
  clientIp?: string;
}

export interface WithdrawalRecord {
  id: string; // e.g. WTH-20260822-9Y44M
  userId: string;
  username: string;
  provider: PaymentProviderId;
  method: PaymentMethod;
  amount: number;
  currency: 'BDT' | 'USD';
  recipientAccount: string;
  recipientName?: string;
  status: WithdrawalStatus;
  reservedBalanceBefore: number;
  availableBalanceBefore: number;
  availableBalanceAfter: number;
  providerReference?: string;
  createdAt: string;
  processedAt?: string;
  completedAt?: string;
  failedReason?: string;
  riskScore: number;
  idempotencyKey: string;
  auditTrail: Array<{
    status: WithdrawalStatus;
    timestamp: string;
    note: string;
  }>;
}

export interface DoubleEntryLedgerEntry {
  id: string;
  transactionId: string;
  walletId: string;
  userId: string;
  entryType: 'DEPOSIT_CREDIT' | 'WITHDRAWAL_RESERVE' | 'WITHDRAWAL_FINALIZE' | 'WITHDRAWAL_RELEASE' | 'SYSTEM_ADJUSTMENT';
  debitAccount: string; // e.g., 'SYSTEM_LIABILITY_ACCOUNT' or 'USER_WALLET_10291'
  creditAccount: string;
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  reservedBefore?: number;
  reservedAfter?: number;
  reference: string;
  createdAt: string;
}

export interface WebhookLog {
  id: string;
  provider: PaymentProviderId;
  eventId: string;
  signature: string;
  signatureValid: boolean;
  payload: Record<string, any>;
  processed: boolean;
  processResult?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string; // 'SYSTEM', 'USER', or 'ADMIN:username'
  action: string; // 'DEPOSIT_INTENT_CREATED', 'TRX_VERIFIED', 'WALLET_CREDITED', 'WITHDRAWAL_RESERVED', etc.
  resource: 'DEPOSIT' | 'WITHDRAWAL' | 'WALLET' | 'PROVIDER' | 'DESTINATION_POOL';
  resourceId: string;
  ipAddress: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface RiskAnalysis {
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  factors: string[];
  isBlocked: boolean;
  requiresManualReview: boolean;
}
