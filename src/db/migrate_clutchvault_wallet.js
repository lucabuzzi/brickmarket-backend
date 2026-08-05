/**
 * Migration: Persist ClutchVault wallet/credits/contests to real PostgreSQL.
 *
 * Root cause fixed: src/db/clutchvault-db.js falls back to an in-memory mock
 * database whenever it can't find these tables in Postgres. That mock lives
 * only in the Node process's RAM, so every restart (nodemon reload, crash,
 * deploy) silently wiped every user's wallet balance and transaction history
 * back to zero. This migration creates the missing tables so the pool
 * connects to real, durable Postgres storage instead.
 *
 * Tables reference public.users(id) (the real marketplace accounts table),
 * not public.profiles like the standalone clutchvault/ app's schema.sql —
 * this merged integration authenticates against the main `users` table
 * (see src/routes/contest.js authenticateToken), so wallets must key off it.
 *
 * Idempotent: safe to run more than once.
 * Run with: node src/db/migrate_clutchvault_wallet.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running ClutchVault wallet persistence migration...');

  await query(`
    CREATE TABLE IF NOT EXISTS public.user_wallets (
      user_id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
      balance_credits NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance_credits >= 0.00),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);

  // Immutable ledger: rows are only ever inserted, never updated/deleted by app code.
  await query(`
    CREATE TABLE IF NOT EXISTS public.credit_transactions (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      amount        NUMERIC(12, 2) NOT NULL,
      type          VARCHAR(50) NOT NULL CHECK (type IN ('deposit', 'contest_entry', 'contest_refund', 'payout', 'shop_purchase')),
      reference_id  VARCHAR(255),
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS public.products (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title         VARCHAR(255) NOT NULL,
      description   TEXT,
      image_url     TEXT NOT NULL,
      category      VARCHAR(50) NOT NULL CHECK (category IN ('lego', 'pokemon')),
      market_value  NUMERIC(12, 2) NOT NULL CHECK (market_value >= 0.00),
      condition     VARCHAR(100) NOT NULL,
      grading_info  TEXT,
      stock         INTEGER NOT NULL DEFAULT 1 CHECK (stock >= 0),
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS public.auctions (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      current_bid       NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (current_bid >= 0.00),
      highest_bidder_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
      buy_now_price     NUMERIC(12, 2) NOT NULL CHECK (buy_now_price >= 0.00),
      ends_at           TIMESTAMP WITH TIME ZONE NOT NULL,
      status            VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
      created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
      CONSTRAINT check_buy_now_price CHECK (buy_now_price >= current_bid)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS public.contests (
      id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
      total_slots       INTEGER NOT NULL CHECK (total_slots > 0),
      filled_slots      INTEGER NOT NULL DEFAULT 0 CHECK (filled_slots <= total_slots),
      slot_cost_credits NUMERIC(12, 2) NOT NULL CHECK (slot_cost_credits >= 0.00),
      status            VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'completed', 'cancelled')),
      winner_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
      created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS public.contest_participants (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contest_id    UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
      user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      username      VARCHAR(255),
      started_at    TIMESTAMP WITH TIME ZONE,
      ended_at      TIMESTAMP WITH TIME ZONE,
      total_time_ms INTEGER,
      status        VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cheated')),
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);

  // Indices for the admin ledger view and per-user lookups
  await query(`CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_contest_participants_contest_id ON public.contest_participants(contest_id);`);

  // Atomic, race-condition-safe contest slot purchase (row-locks wallet + contest before touching either)
  await query(`
    CREATE OR REPLACE FUNCTION public.buy_contest_slot(
        target_user_id UUID,
        target_contest_id UUID,
        slot_cost NUMERIC,
        target_username VARCHAR DEFAULT NULL
    )
    RETURNS JSON AS $$
    DECLARE
        current_wallet_credits NUMERIC;
        contest_status VARCHAR;
        current_filled_slots INTEGER;
        max_slots INTEGER;
    BEGIN
        SELECT balance_credits INTO current_wallet_credits
        FROM public.user_wallets
        WHERE user_id = target_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Wallet not found for user.');
        END IF;

        SELECT status, filled_slots, total_slots INTO contest_status, current_filled_slots, max_slots
        FROM public.contests
        WHERE id = target_contest_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'message', 'Contest not found.');
        END IF;

        IF contest_status != 'open' THEN
            RETURN json_build_object('success', false, 'message', 'Contest is no longer open.');
        END IF;

        IF current_filled_slots >= max_slots THEN
            RETURN json_build_object('success', false, 'message', 'Contest slots are full.');
        END IF;

        IF current_wallet_credits < slot_cost THEN
            RETURN json_build_object('success', false, 'message', 'Insufficient wallet balance.');
        END IF;

        UPDATE public.user_wallets
        SET balance_credits = balance_credits - slot_cost,
            updated_at = now()
        WHERE user_id = target_user_id;

        INSERT INTO public.credit_transactions (user_id, amount, type, reference_id)
        VALUES (target_user_id, -slot_cost, 'contest_entry', target_contest_id::varchar);

        INSERT INTO public.contest_participants (contest_id, user_id, username, status)
        VALUES (target_contest_id, target_user_id, target_username, 'pending');

        UPDATE public.contests
        SET filled_slots = filled_slots + 1
        WHERE id = target_contest_id
        RETURNING filled_slots INTO current_filled_slots;

        IF current_filled_slots >= max_slots THEN
            UPDATE public.contests SET status = 'active' WHERE id = target_contest_id;
            contest_status := 'active';
        END IF;

        RETURN json_build_object(
            'success', true,
            'message', 'Successfully bought contest slot.',
            'new_balance', current_wallet_credits - slot_cost,
            'filled_slots', current_filled_slots,
            'contest_status', contest_status
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Backfill: give every existing registered user a wallet row if they don't have one yet,
  // so nobody's balance silently reads as "not found" the first time this ships.
  const backfilled = await query(`
    INSERT INTO public.user_wallets (user_id, balance_credits)
    SELECT id, 100.00 FROM public.users
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id;
  `);
  console.log(`   Backfilled wallets for ${backfilled.rows.length} existing user(s) with no wallet yet.`);

  console.log('✅  ClutchVault wallet tables are now live in PostgreSQL — balances and transaction history will survive restarts.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
