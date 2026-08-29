import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

// ----------------------------------------------------------------------------
// 1. Users Table (Integrated with Firebase Auth UID & iGaming attributes)
// ----------------------------------------------------------------------------
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  username: varchar('username', { length: 64 }).notNull(),
  operatorId: varchar('operator_id', { length: 64 }).default('GAMEPLAY365_BD').notNull(),
  currency: varchar('currency', { length: 3 }).default('BDT').notNull(),
  status: varchar('status', { length: 32 }).default('ACTIVE').notNull(),
  countryCode: varchar('country_code', { length: 2 }).default('BD'),
  vipTier: varchar('vip_tier', { length: 32 }).default('V1_ROOKIE').notNull(),
  vipLevel: integer('vip_level').default(1).notNull(),
  referralCode: varchar('referral_code', { length: 32 }).unique(),
  referredByUserId: integer('referred_by_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// 2. Game Providers Table (B2B Game Providers Catalog & HMAC Keys)
// ----------------------------------------------------------------------------
export const gameProviders = pgTable('game_providers', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  secretKey: varchar('secret_key', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  webhookTimeoutMs: integer('webhook_timeout_ms').default(4000).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// 3. Wallets Table (Player ledger balance with high-precision balances)
// ----------------------------------------------------------------------------
export const wallets = pgTable('wallets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  realBalance: numeric('real_balance', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  bonusBalance: numeric('bonus_balance', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  lockedBalance: numeric('locked_balance', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  commissionBalance: numeric('commission_balance', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  balanceMinor: bigint('balance_minor', { mode: 'bigint' }).default(0n).notNull(),
  version: integer('version').default(1).notNull(),
  status: varchar('status', { length: 32 }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userCurrencyIdx: uniqueIndex('wallets_user_currency_idx').on(table.userId, table.currency),
}));

// ----------------------------------------------------------------------------
// 4. Game Rounds Table (Lifecycle of casino spins/rounds)
// ----------------------------------------------------------------------------
export const gameRounds = pgTable('game_rounds', {
  id: serial('id').primaryKey(),
  providerId: varchar('provider_id', { length: 64 })
    .references(() => gameProviders.id)
    .notNull(),
  providerRoundId: varchar('provider_round_id', { length: 128 }).notNull(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  gameId: varchar('game_id', { length: 128 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  status: varchar('status', { length: 32 }).default('OPEN').notNull(),
  totalBet: numeric('total_bet', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  totalWin: numeric('total_win', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

// ----------------------------------------------------------------------------
// 5. Transactions Table (Immutable Double-Entry Ledger)
// ----------------------------------------------------------------------------
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  providerId: varchar('provider_id', { length: 64 })
    .references(() => gameProviders.id)
    .notNull(),
  transactionId: varchar('transaction_id', { length: 128 }).notNull(),
  referenceTransactionId: varchar('reference_transaction_id', { length: 128 }),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  walletId: integer('wallet_id')
    .references(() => wallets.id)
    .notNull(),
  roundId: integer('round_id').references(() => gameRounds.id),
  providerRoundId: varchar('provider_round_id', { length: 128 }),
  gameId: varchar('game_id', { length: 128 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'BET', 'WIN', 'REFUND', 'PROMO', 'COMMISSION', 'DEPOSIT', 'WITHDRAWAL'
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  beforeBalance: numeric('before_balance', { precision: 18, scale: 4 }).notNull(),
  afterBalance: numeric('after_balance', { precision: 18, scale: 4 }).notNull(),
  status: varchar('status', { length: 32 }).default('COMPLETED').notNull(),
  errorCode: varchar('error_code', { length: 64 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// 6. Idempotency Records Table
// ----------------------------------------------------------------------------
export const idempotencyKeys = pgTable('idempotency_keys', {
  idempotencyKey: varchar('idempotency_key', { length: 192 }).primaryKey(),
  providerId: varchar('provider_id', { length: 64 }).notNull(),
  endpoint: varchar('endpoint', { length: 64 }).notNull(),
  statusCode: integer('status_code').notNull(),
  responseBody: jsonb('response_body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

// ----------------------------------------------------------------------------
// 7. Payment Requests Table (bKash, Nagad, Rocket, Upay Local Cashier)
// ----------------------------------------------------------------------------
export const paymentRequests = pgTable('payment_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  walletId: integer('wallet_id')
    .references(() => wallets.id)
    .notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'DEPOSIT', 'WITHDRAWAL'
  method: varchar('method', { length: 32 }).notNull(), // 'BKASH', 'NAGAD', 'ROCKET', 'UPAY', 'USDT'
  amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('BDT').notNull(),
  senderNumber: varchar('sender_number', { length: 64 }),
  receiverNumber: varchar('receiver_number', { length: 64 }),
  trxId: varchar('trx_id', { length: 128 }).notNull(),
  status: varchar('status', { length: 32 }).default('PENDING').notNull(), // 'PENDING', 'APPROVED', 'REJECTED'
  adminNote: text('admin_note'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// MODULE 1: Multi-Tier Affiliate & Commission Engine Tables
// ----------------------------------------------------------------------------
export const affiliateNodes = pgTable('affiliate_nodes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  parentAffiliateId: integer('parent_affiliate_id').references(() => users.id),
  grandParentAffiliateId: integer('grandparent_affiliate_id').references(() => users.id),
  referralCode: varchar('referral_code', { length: 32 }).notNull().unique(),
  tier1CommissionRate: numeric('tier1_commission_rate', { precision: 6, scale: 4 }).default('0.0050').notNull(), // 0.50% of subordinate valid bets
  tier2CommissionRate: numeric('tier2_commission_rate', { precision: 6, scale: 4 }).default('0.0020').notNull(), // 0.20%
  tier3CommissionRate: numeric('tier3_commission_rate', { precision: 6, scale: 4 }).default('0.0010').notNull(), // 0.10%
  totalDirectReferrals: integer('total_direct_referrals').default(0).notNull(),
  totalSubordinates: integer('total_subordinates').default(0).notNull(),
  totalTurnoverVolume: numeric('total_turnover_volume', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  totalCommissionEarned: numeric('total_commission_earned', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  unclaimedCommission: numeric('unclaimed_commission', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  status: varchar('status', { length: 32 }).default('ACTIVE').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const affiliateCommissions = pgTable('affiliate_commissions', {
  id: serial('id').primaryKey(),
  beneficiaryUserId: integer('beneficiary_user_id')
    .references(() => users.id)
    .notNull(),
  sourceUserId: integer('source_user_id')
    .references(() => users.id)
    .notNull(),
  sourceTransactionId: varchar('source_transaction_id', { length: 128 }).notNull(),
  tier: integer('tier').notNull(), // 1 for Direct (Tier A->B), 2 for Subordinate (Tier A->C), 3 for Tier D
  validBetAmount: numeric('valid_bet_amount', { precision: 18, scale: 4 }).notNull(),
  commissionRate: numeric('commission_rate', { precision: 6, scale: 4 }).notNull(),
  commissionAmount: numeric('commission_amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  status: varchar('status', { length: 32 }).default('SETTLED').notNull(), // 'PENDING', 'SETTLED', 'CLAIMED'
  settledAt: timestamp('settled_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    uniqueTxBeneficiaryTierIdx: uniqueIndex('affiliate_commissions_tx_beneficiary_tier_idx').on(
      table.sourceTransactionId,
      table.beneficiaryUserId,
      table.tier
    ),
  };
});

// ----------------------------------------------------------------------------
// MODULE 2: VIP & Loyalty Progression System Tables
// ----------------------------------------------------------------------------
export const vipLevels = pgTable('vip_levels', {
  level: integer('level').primaryKey(), // 1 to 10
  name: varchar('name', { length: 64 }).notNull(), // V1 Rookie, V2 Bronze, V3 Silver, V4 Gold, V5 Platinum, V6 Diamond, V7 Master, V8 Grandmaster, V9 Legend, V10 Immortal
  minCumulativeDeposit: numeric('min_cumulative_deposit', { precision: 18, scale: 4 }).notNull(),
  minCumulativeBet: numeric('min_cumulative_bet', { precision: 18, scale: 4 }).notNull(),
  levelUpBonus: numeric('level_up_bonus', { precision: 18, scale: 4 }).notNull(),
  dailyCashbackRate: numeric('daily_cashback_rate', { precision: 6, scale: 4 }).notNull(), // e.g. 0.0150 (1.5%)
  weeklyBonus: numeric('weekly_bonus', { precision: 18, scale: 4 }).notNull(),
  monthlyPerk: numeric('monthly_perk', { precision: 18, scale: 4 }).notNull(),
  payoutLimitDaily: numeric('payout_limit_daily', { precision: 18, scale: 4 }).notNull(),
  dedicatedHost: boolean('dedicated_host').default(false).notNull(),
  badgeColor: varchar('badge_color', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userVipProgress = pgTable('user_vip_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  currentLevel: integer('current_level').references(() => vipLevels.level).default(1).notNull(),
  cumulativeDeposit: numeric('cumulative_deposit', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  cumulativeBet: numeric('cumulative_bet', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  levelUpBonusClaimed: jsonb('level_up_bonus_claimed').default([]).notNull(), // [1, 2, 3]
  lastDailyCashbackDate: timestamp('last_daily_cashback_date', { withTimezone: true }),
  totalCashbackClaimed: numeric('total_cashback_claimed', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  lastUpgradedAt: timestamp('last_upgraded_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ----------------------------------------------------------------------------
// MODULE 3: Promotion & Event Engine Tables
// ----------------------------------------------------------------------------
export const dailyCheckIns = pgTable('daily_check_ins', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  checkInDate: timestamp('check_in_date', { withTimezone: true }).notNull(),
  streakDay: integer('streak_day').notNull(), // 1 to 7
  rewardAmount: numeric('reward_amount', { precision: 18, scale: 4 }).notNull(),
  rewardType: varchar('reward_type', { length: 32 }).default('BONUS_CREDIT').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const wheelSpins = pgTable('wheel_spins', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  prizeType: varchar('prize_type', { length: 32 }).notNull(), // 'REAL_CASH', 'BONUS_CASH', 'FREE_SPINS', 'JACKPOT_TICKET'
  prizeLabel: varchar('prize_label', { length: 64 }).notNull(),
  prizeValue: numeric('prize_value', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  isClaimed: boolean('is_claimed').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const wageringRequirements = pgTable('wagering_requirements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  promoName: varchar('promo_name', { length: 128 }).notNull(),
  bonusAmountGranted: numeric('bonus_amount_granted', { precision: 18, scale: 4 }).notNull(),
  requiredMultiplier: integer('required_multiplier').default(10).notNull(), // 10x rollover
  targetTurnoverAmount: numeric('target_turnover_amount', { precision: 18, scale: 4 }).notNull(),
  completedTurnoverAmount: numeric('completed_turnover_amount', { precision: 18, scale: 4 }).default('0.0000').notNull(),
  status: varchar('status', { length: 32 }).default('ACTIVE').notNull(), // 'ACTIVE', 'COMPLETED', 'EXPIRED'
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// ----------------------------------------------------------------------------
// Relations
// ----------------------------------------------------------------------------
export const usersRelations = relations(users, ({ one, many }) => ({
  wallets: many(wallets),
  gameRounds: many(gameRounds),
  transactions: many(transactions),
  paymentRequests: many(paymentRequests),
  affiliateNode: one(affiliateNodes, {
    fields: [users.id],
    references: [affiliateNodes.userId],
  }),
  vipProgress: one(userVipProgress, {
    fields: [users.id],
    references: [userVipProgress.userId],
  }),
  checkIns: many(dailyCheckIns),
  wheelSpins: many(wheelSpins),
  wageringRequirements: many(wageringRequirements),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
  paymentRequests: many(paymentRequests),
}));

export const gameProvidersRelations = relations(gameProviders, ({ many }) => ({
  rounds: many(gameRounds),
  transactions: many(transactions),
}));

export const gameRoundsRelations = relations(gameRounds, ({ one, many }) => ({
  provider: one(gameProviders, {
    fields: [gameRounds.providerId],
    references: [gameProviders.id],
  }),
  user: one(users, {
    fields: [gameRounds.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  provider: one(gameProviders, {
    fields: [transactions.providerId],
    references: [gameProviders.id],
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
  round: one(gameRounds, {
    fields: [transactions.roundId],
    references: [gameRounds.id],
  }),
}));

export const paymentRequestsRelations = relations(paymentRequests, ({ one }) => ({
  user: one(users, {
    fields: [paymentRequests.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [paymentRequests.walletId],
    references: [wallets.id],
  }),
}));
