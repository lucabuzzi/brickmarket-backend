/**
 * Migration: server-verified, incremental proof of puzzle progress for
 * Puzzle Arena (ClutchVault contests).
 *
 * Problem fixed: completeAttemptHandler previously trusted the client
 * entirely for "the puzzle was solved" — it only checked the anti-cheat JWT
 * signature/expiry and two timing thresholds (>5s elapsed, <15s of tab
 * blur). Nothing verified the actual 30-piece board state, so a valid
 * "win" could be produced with two API calls (start, then complete after a
 * 5-second wait) and no gameplay at all — a real problem for a contest
 * whose prize is a physical item.
 *
 * Fix: the server now decides + stores the puzzle's grid dimensions at
 * /start (grid_rows/grid_cols below), and requires one verified call per
 * piece as it's locked during play (contest_piece_locks) — each checked
 * against the server's own recomputed target position
 * (src/services/puzzleGeometry.js), not anything the client claims.
 * /complete now requires exactly gridRows*gridCols distinct verified locks
 * before it will mark an attempt 'completed'.
 *
 * Uses the main pool (require('./index')), same as
 * migrate_clutchvault_wallet.js which created these ClutchVault tables in
 * the first place — DATABASE_URL is the same physical Postgres database
 * either way (see src/db/clutchvault-db.js's isMock fallback vs this one).
 *
 * Idempotent: safe to run more than once.
 * Run with: node src/db/migrate_contest_piece_locks.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running contest piece-locks migration...');

  await query(`
    ALTER TABLE public.contest_participants
      ADD COLUMN IF NOT EXISTS grid_rows INTEGER,
      ADD COLUMN IF NOT EXISTS grid_cols INTEGER
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS public.contest_piece_locks (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      participant_id UUID NOT NULL REFERENCES public.contest_participants(id) ON DELETE CASCADE,
      piece_id       INTEGER NOT NULL CHECK (piece_id >= 0),
      locked_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
      UNIQUE (participant_id, piece_id)
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_contest_piece_locks_participant ON public.contest_piece_locks(participant_id)`);

  console.log('Done.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
