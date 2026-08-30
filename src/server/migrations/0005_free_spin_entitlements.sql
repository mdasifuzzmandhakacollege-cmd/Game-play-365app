-- ============================================================================
-- Migration: 0005_free_spin_entitlements.sql
-- Description: PLAY369 Task 3.4 - Authoritative PostgreSQL Free Spin Entitlements
-- 1. Creates free_spin_entitlements table for non-monetary Lucky Wheel rewards
-- 2. Enforces strict ACID idempotency with sourceReference and (userId, source, spinDateUtc) unique indexes
-- ============================================================================

CREATE TABLE IF NOT EXISTS free_spin_entitlements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source VARCHAR(32) DEFAULT 'LUCKY_WHEEL' NOT NULL,
  source_reference VARCHAR(128) NOT NULL,
  quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  status VARCHAR(32) DEFAULT 'ACTIVE' NOT NULL,
  spin_date_utc VARCHAR(10) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Unique constraints to enforce strict idempotency and prevent duplicate entitlements
CREATE UNIQUE INDEX IF NOT EXISTS free_spin_entitlements_source_ref_idx 
  ON free_spin_entitlements(source_reference);

CREATE UNIQUE INDEX IF NOT EXISTS free_spin_entitlements_user_source_date_idx 
  ON free_spin_entitlements(user_id, source, spin_date_utc);

CREATE INDEX IF NOT EXISTS free_spin_entitlements_user_status_idx 
  ON free_spin_entitlements(user_id, status);
