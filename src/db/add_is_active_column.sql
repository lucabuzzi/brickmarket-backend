-- Safe deletion via Soft Delete: add is_active flag to users table.
-- Users with is_active = false are treated as deactivated but all
-- foreign key references (orders, reviews, bids) remain intact.
--
-- Run with: psql $DATABASE_URL -f src/db/add_is_active_column.sql
-- or paste into Supabase SQL editor / pgAdmin.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Also add bio column if missing (used in public profile)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Index for fast filtering of active users in list queries
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Optional: prevent inactive users from appearing in public directories
-- (you can also handle this at the application layer in queries)
COMMENT ON COLUMN users.is_active IS
  'Soft-delete flag. FALSE = account deactivated. All historical data (orders, reviews, bids) is preserved.';
