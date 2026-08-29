-- ============================================================================
-- Migration: 0001_canonical_wallet_schema.sql
-- Description: Align wallets table with canonical integer IDs and 4-decimal precision
-- Ensures single production source of truth without duplicate wallet models.
-- ============================================================================

-- 1. Ensure balance_minor column exists on wallets table
ALTER TABLE IF EXISTS wallets ADD COLUMN IF NOT EXISTS balance_minor BIGINT DEFAULT 0;

-- 2. Ensure commission_balance column exists on wallets table
ALTER TABLE IF EXISTS wallets ADD COLUMN IF NOT EXISTS commission_balance NUMERIC(18, 4) DEFAULT 0.0000;

-- 3. Ensure unique constraint exists on (user_id, currency)
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_wallet_user_currency'
  ) THEN
    ALTER TABLE wallets ADD CONSTRAINT uq_wallet_user_currency UNIQUE (user_id, currency);
  END IF;
END $$;

-- 4. Backfill balance_minor from real_balance (scale 4 = 10,000 minor units per major unit)
UPDATE wallets 
SET balance_minor = ROUND(real_balance * 10000) 
WHERE (balance_minor IS NULL OR balance_minor = 0) AND real_balance > 0;
