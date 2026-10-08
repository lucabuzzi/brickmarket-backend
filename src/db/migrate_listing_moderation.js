/**
 * Migration: admin listing/auction moderation ("Gestione Annunci & Aste").
 *
 * Adds a 'hidden' status to listings — distinct from the seller-initiated
 * 'removed' (self-delete, see DELETE /api/listings/:id) — plus audit columns
 * (who hid it, when, why) so the admin UI can show the reason and the seller
 * can be notified. Also adds notifications.reason (nullable, freeform) so an
 * in-app notification can carry the admin's motivation text, interpolated
 * into the existing i18next message_key mechanism.
 *
 * Idempotente: sicuro da rieseguire.
 *
 * Rollback manuale, se mai servisse:
 *   ALTER TABLE listings DROP COLUMN hidden_reason, DROP COLUMN hidden_by, DROP COLUMN hidden_at;
 *   ALTER TABLE listings DROP CONSTRAINT listings_status_check;
 *   ALTER TABLE listings ADD CONSTRAINT listings_status_check
 *     CHECK (status IN ('draft','active','sold','expired','removed'));
 *   ALTER TABLE notifications DROP COLUMN reason;
 *
 * Run con: node scripts/run-db-script.js src/db/migrate_listing_moderation.js --target=test|production
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Adding listings moderation columns...');
  await query(`
    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS hidden_reason TEXT,
      ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP WITH TIME ZONE;
  `);

  console.log('Widening listings.status CHECK constraint to include "hidden"...');
  await query(`ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;`);
  await query(`
    ALTER TABLE listings ADD CONSTRAINT listings_status_check
      CHECK (status IN ('draft','active','sold','expired','removed','hidden'));
  `);

  console.log('Adding notifications.reason...');
  await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reason TEXT;`);

  console.log('✅  Moderazione annunci pronta: listings.status accetta "hidden", colonne di audit e notifications.reason create.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
