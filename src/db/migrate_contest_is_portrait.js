/**
 * Migration: store the puzzle board's orientation explicitly per attempt.
 *
 * Follow-up to migrate_contest_piece_locks.js: the grid moved from an
 * asymmetric 5x6/6x5 split (piece count varied... no, wait — count was
 * always 30, only which dimension was rows vs cols varied) to a fixed 4x4
 * square grid (16 pieces, see puzzleGeometry.js). A square grid can't
 * self-encode orientation the way the old asymmetric one could (grid_rows
 * and grid_cols are now always both 4), but the board/canvas pixel layout
 * still depends on it — so it needs its own column now instead of being
 * inferred from grid_rows/grid_cols.
 *
 * Idempotent: safe to run more than once.
 * Run with: node src/db/migrate_contest_is_portrait.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running contest is_portrait migration...');

  await query(`
    ALTER TABLE public.contest_participants
      ADD COLUMN IF NOT EXISTS is_portrait BOOLEAN NOT NULL DEFAULT FALSE
  `);

  console.log('Done.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
