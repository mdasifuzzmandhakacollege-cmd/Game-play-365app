-- ============================================================================
-- iGaming B2B Seamless Wallet - PostgreSQL ACID Schema & Ledger Architecture
-- Author: Senior iGaming System Architect
-- Engine: PostgreSQL 14+ with Row-Level Locking (SELECT ... FOR UPDATE)
-- ============================================================================

-- Enable UUID extension for high-performance distributed primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean up existing tables if re-provisioning (order matters due to foreign keys)
-- DROP TABLE IF EXISTS idempotency_keys CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS game_rounds CASCADE;
-- DROP TABLE IF EXISTS wallets CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS game_providers CASCADE;

-- ----------------------------------------------------------------------------
-- 1. Game Providers Table (Catalog of integrated B2B game providers)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_providers (
    id VARCHAR(64) PRIMARY KEY,                   -- e.g., 'pragmatic_play', 'evolution', 'pgsoft', 'spribe'
    name VARCHAR(128) NOT NULL,
    secret_key VARCHAR(255) NOT NULL,             -- Shared HMAC-SHA256 secret key
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_ips TEXT[] DEFAULT '{}',              -- IP Whitelist array
    webhook_timeout_ms INTEGER NOT NULL DEFAULT 4000, -- Strict provider timeout (e.g. 4000ms)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Users Table (Platform players registered under the primary operator)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) NOT NULL UNIQUE,
    operator_id VARCHAR(64) NOT NULL DEFAULT 'DEFAULT_OPERATOR',
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',    -- ISO-4217 Currency Code (e.g., 'USD', 'EUR', 'BRL')
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED', 'SELF_EXCLUDED', 'LOCKED'
    country_code VARCHAR(2) DEFAULT 'US',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_operator_username ON users(operator_id, username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ----------------------------------------------------------------------------
-- 3. Wallets Table (Player ledger balance with strict integrity constraints)
-- Row-level locking (SELECT ... FOR UPDATE) is executed on this table during transactions.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(3) NOT NULL,
    
    -- Integer minor units (e.g. 10050 = 100.50 BDT/USD) for exact zero-drift arithmetic
    balance_minor BIGINT NOT NULL DEFAULT 0,
    
    -- Balances stored with 4 decimal places for micro-cent precision in casino games
    real_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    bonus_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    locked_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    
    -- Optimistic locking version integer (backup guard)
    version BIGINT NOT NULL DEFAULT 1,
    
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'FROZEN', 'CLOSED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints: A user can have only one wallet per currency
    CONSTRAINT uq_wallet_user_currency UNIQUE (user_id, currency),
    
    -- Zero-overdraft constraint: Real balance and minor balance cannot drop below zero
    CONSTRAINT chk_balance_minor_non_negative CHECK (balance_minor >= 0),
    CONSTRAINT chk_real_balance_non_negative CHECK (real_balance >= 0),
    CONSTRAINT chk_bonus_balance_non_negative CHECK (bonus_balance >= 0)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_currency ON wallets(user_id, currency);

-- ----------------------------------------------------------------------------
-- 3b. Immutable Ledger Entries Table (Append-Only Core Financial Ledger)
-- Every financial debit, credit, reversal, or adjustment is permanently recorded.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger_entries (
    id VARCHAR(64) PRIMARY KEY,
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    user_id UUID NOT NULL REFERENCES users(id),
    transaction_id VARCHAR(128) NOT NULL,
    reference_transaction_id VARCHAR(128),
    type VARCHAR(32) NOT NULL,                    -- 'DEBIT', 'CREDIT', 'REVERSAL', 'ADJUSTMENT'
    amount_minor BIGINT NOT NULL,                 -- Exact integer minor units
    currency VARCHAR(3) NOT NULL,
    before_balance_minor BIGINT NOT NULL,
    after_balance_minor BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'COMMITTED', -- 'COMMITTED', 'REJECTED', 'ROLLED_BACK'
    correlation_id VARCHAR(128) NOT NULL,
    audit_metadata JSONB DEFAULT '{}'::jsonb,     -- Masked audit trail (no secrets)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_ledger_amount_minor_positive CHECK (amount_minor > 0),
    CONSTRAINT chk_ledger_balances_non_negative CHECK (before_balance_minor >= 0 AND after_balance_minor >= 0),
    CONSTRAINT uq_ledger_user_transaction UNIQUE (user_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_wallet_created ON ledger_entries(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_user_tx ON ledger_entries(user_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_correlation ON ledger_entries(correlation_id);

-- ----------------------------------------------------------------------------
-- 3c. Idempotency Records Table (Guarantees Exactly-Once Processing)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_records (
    idempotency_key VARCHAR(192) PRIMARY KEY,
    transaction_id VARCHAR(128) NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 200,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_expires ON idempotency_records(expires_at);

-- ----------------------------------------------------------------------------
-- 4. Game Rounds Table (Tracks the lifecycle of casino spins/rounds)
-- A game round typically starts with a BET, can have multiple BETs/WINs, and closes on settlement.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS game_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(64) NOT NULL REFERENCES game_providers(id),
    provider_round_id VARCHAR(128) NOT NULL,     -- Provider's unique round ID (e.g. 'RND_8892183')
    user_id UUID NOT NULL REFERENCES users(id),
    game_id VARCHAR(128) NOT NULL,               -- e.g. 'vs20olympgate', 'sweet_bonanza'
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',   -- 'OPEN', 'SETTLED', 'CANCELLED', 'REFUNDED'
    total_bet NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    total_win NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    net_payout NUMERIC(18, 4) GENERATED ALWAYS AS (total_win - total_bet) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,

    CONSTRAINT uq_provider_round UNIQUE (provider_id, provider_round_id)
);

CREATE INDEX IF NOT EXISTS idx_game_rounds_user_created ON game_rounds(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_rounds_status ON game_rounds(status);

-- ----------------------------------------------------------------------------
-- 5. Transactions Table (Immutable Double-Entry Financial Ledger)
-- Every /bet, /win, and /refund logs an immutable row here.
-- Idempotency is enforced by the UNIQUE index on (provider_id, transaction_id).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id VARCHAR(64) NOT NULL REFERENCES game_providers(id),
    
    -- Provider's external unique transaction identifier
    transaction_id VARCHAR(128) NOT NULL,
    
    -- Reference to parent transaction (e.g., /win or /refund referencing the original /bet)
    reference_transaction_id VARCHAR(128),
    
    user_id UUID NOT NULL REFERENCES users(id),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    round_id UUID REFERENCES game_rounds(id),
    provider_round_id VARCHAR(128),
    game_id VARCHAR(128) NOT NULL,
    
    type VARCHAR(32) NOT NULL,                   -- 'BET', 'WIN', 'REFUND', 'JACKPOT', 'PROMO', 'TIP'
    amount NUMERIC(18, 4) NOT NULL,              -- Transaction amount (positive numeric)
    currency VARCHAR(3) NOT NULL,
    
    -- Financial snapshots for auditability
    before_balance NUMERIC(18, 4) NOT NULL,
    after_balance NUMERIC(18, 4) NOT NULL,
    
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED', -- 'COMPLETED', 'FAILED', 'REJECTED', 'ROLLED_BACK'
    error_code VARCHAR(64),
    
    -- Complete provider payload preserved for auditing and dispute resolution
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Enforce idempotency: The same provider cannot submit the same transaction_id twice
    CONSTRAINT uq_provider_tx_id UNIQUE (provider_id, transaction_id),
    CONSTRAINT chk_tx_amount_positive CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_round_id ON transactions(provider_round_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ref_tx ON transactions(provider_id, reference_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(type, status);

-- ----------------------------------------------------------------------------
-- 6. Idempotency Records Table (Fast cache store / permanent response repository)
-- Used to immediately return identical responses for duplicated/retried requests.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key VARCHAR(192) PRIMARY KEY,     -- Hash of (provider_id + ':' + endpoint + ':' + transaction_id)
    provider_id VARCHAR(64) NOT NULL,
    endpoint VARCHAR(64) NOT NULL,
    status_code INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- ----------------------------------------------------------------------------
-- 7. Audit Trigger Function: Auto-update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE OR REPLACE TRIGGER trg_wallets_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ============================================================================
-- 8. Seed Initial Default Data (Demo Provider & Test Player)
-- ============================================================================
INSERT INTO game_providers (id, name, secret_key, webhook_timeout_ms)
VALUES 
    ('pragmatic_play', 'Pragmatic Play Live & Slots', 'sk_live_pragmatic_seamless_88492048102', 4000),
    ('evolution', 'Evolution Gaming Live Casino', 'sk_live_evolution_seamless_39104859103', 4000),
    ('pgsoft', 'Pocket Games Soft', 'sk_live_pgsoft_seamless_91823019482', 4000),
    ('spribe', 'Spribe Turbo Games (Aviator)', 'sk_live_spribe_seamless_74910284910', 4000)
ON CONFLICT (id) DO UPDATE SET secret_key = EXCLUDED.secret_key;

INSERT INTO users (id, username, operator_id, currency, status)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'high_roller_alex', 'CASINO_ROYAL_01', 'USD', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000002', 'slot_queen_maria', 'CASINO_ROYAL_01', 'USD', 'ACTIVE'),
    ('a0000000-0000-0000-0000-000000000003', 'suspended_user_dave', 'CASINO_ROYAL_01', 'USD', 'SUSPENDED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO wallets (id, user_id, currency, real_balance, bonus_balance)
VALUES 
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'USD', 2500.0000, 100.0000),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'USD', 500.0000, 50.0000),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'USD', 100.0000, 0.0000)
ON CONFLICT (user_id, currency) DO NOTHING;
