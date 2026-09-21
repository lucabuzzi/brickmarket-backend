/**
 * Migration: contestazioni/resi/rimborsi minimali + clawback dei bonus crediti già
 * maturati (CLAUDE.md — "solo se non ci sono contestazioni/resi/rimborsi aperti" e
 * "clawback su rimborso/reso/contestazione").
 *
 * orders.status ha già 'disputed'/'refunded' nel CHECK fin dallo schema originale —
 * semplicemente nessuna route li impostava mai. Qui si aggiungono solo le colonne di
 * audit (motivo, quando) e si estende credit_bonus_grants.status con 'clawed_back'
 * (bonus già accreditato quando è arrivato il rimborso, poi tolto dal wallet — vedi
 * src/services/orderDisputeService.js). Il tipo 'clawback' in credit_transactions.type
 * è già stato aggiunto dalla migrazione della Fase 1, nessuna modifica al CHECK qui.
 *
 * Idempotente: sicuro da rieseguire.
 *
 * Rollback manuale, se mai servisse:
 *   ALTER TABLE orders DROP COLUMN dispute_reason, DROP COLUMN disputed_at, DROP COLUMN refunded_at;
 *   ALTER TABLE public.credit_bonus_grants DROP COLUMN clawed_back_at;
 *   ALTER TABLE public.credit_bonus_grants DROP CONSTRAINT credit_bonus_grants_status_check;
 *   ALTER TABLE public.credit_bonus_grants ADD CONSTRAINT credit_bonus_grants_status_check
 *     CHECK (status IN ('pending', 'matured', 'cancelled'));
 *
 * Run con: node scripts/run-db-script.js src/db/migrate_disputes.js --target=test|production
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running disputes migration...');

  await query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
      ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE;
  `);

  await query(`ALTER TABLE public.credit_bonus_grants ADD COLUMN IF NOT EXISTS clawed_back_at TIMESTAMP WITH TIME ZONE;`);

  await query(`ALTER TABLE public.credit_bonus_grants DROP CONSTRAINT IF EXISTS credit_bonus_grants_status_check;`);
  await query(`
    ALTER TABLE public.credit_bonus_grants ADD CONSTRAINT credit_bonus_grants_status_check
      CHECK (status IN ('pending', 'matured', 'cancelled', 'clawed_back'));
  `);

  console.log('✅  Colonne dispute su orders pronte, credit_bonus_grants.status estesa con clawed_back.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
