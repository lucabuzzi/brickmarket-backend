/**
 * Migration: make the `addresses` table usable as the buyer's shipping
 * address book (it existed but was never read or written by any route).
 *
 * Adds:
 *  - country: missing entirely today. Store ISO 3166-1 alpha-2 (e.g. 'IT',
 *    'CH') going forward — mirrors users.address_country in spirit, but that
 *    column is free text VARCHAR(100), so this one is too for now rather than
 *    retrofitting a stricter check the existing column doesn't have either.
 *  - address_street / address_house_number: the existing `address` column is
 *    one free-text line. Carrier/label APIs (Step 3) generally want street
 *    and house number split, same shape already used on users. Added
 *    alongside rather than replacing `address`, so nothing existing breaks;
 *    new writes populate both, `address` stays as a display fallback.
 *  - label: optional friendly name ("Casa", "Ufficio") for the address-book
 *    UI — purely cosmetic, nullable.
 *  - updated_at: every other user-facing table has one, addresses didn't.
 *
 * No data migration needed: addresses has 0 rows in production as of this
 * writing (checked directly), so there is nothing to backfill.
 *
 * Idempotent: safe to run more than once.
 * Run with: node src/db/migrate_shipping_addresses.js
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running shipping addresses migration...');

  await query(`
    ALTER TABLE addresses
      ADD COLUMN IF NOT EXISTS label VARCHAR(50),
      ADD COLUMN IF NOT EXISTS address_street VARCHAR(200),
      ADD COLUMN IF NOT EXISTS address_house_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS country VARCHAR(100),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id)`);

  console.log('Done.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
