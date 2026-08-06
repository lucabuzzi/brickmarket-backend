/**
 * Migration: Widen products.category CHECK constraint to every catalog game.
 *
 * Root cause fixed: the constraint (from migrate_clutchvault_wallet.js) only
 * allowed 'lego'/'pokemon', matching the old 2-option Skill Zone puzzle form.
 * The Skill Zone admin form now offers every category from
 * client/src/config/catalogGames.js (CATALOG_GAMES) — the DB must accept the
 * same slugs or contest creation fails with a constraint violation.
 *
 * Idempotent: safe to run more than once.
 * Run with: node src/db/migrate_products_category_all_games.js
 */
require('dotenv').config();
const { query } = require('./index');

// Keep in sync with client/src/config/catalogGames.js CATALOG_GAMES slugs.
const ALLOWED_CATEGORIES = ['lego', 'magic', 'yugioh', 'lorcana', 'pokemon', 'onepiece', 'dragonball', 'funko'];

async function migrate() {
  console.log('Widening products.category CHECK constraint to all catalog games...');

  await query('ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check');

  const inList = ALLOWED_CATEGORIES.map((c) => `'${c}'`).join(', ');
  await query(`ALTER TABLE public.products ADD CONSTRAINT products_category_check CHECK (category IN (${inList}))`);

  console.log('Done. Allowed categories:', ALLOWED_CATEGORIES.join(', '));
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
