/**
 * Migration: sistema di referral (CLAUDE.md, "REGOLE DI PRODOTTO DEFINITIVE SUI
 * CREDITI" — "Referral (link ?ref=CODICE o codice inserito in registrazione): +5 a
 * chi ha invitato, quando l'invitato completa registrazione e verifica email").
 *
 * - users.referral_code: codice univoco per condividere il proprio link di invito.
 *   Backfillato per ogni utente già esistente, così tutti possono iniziare a
 *   invitare da subito, non solo chi si registra da oggi in poi.
 * - public.referrals: una riga per invitato (referred_id è UNIQUE — un utente può
 *   essere stato invitato da una sola persona), stato pending finché l'invitato non
 *   verifica l'email, poi completed quando il bonus al referrer viene accreditato.
 *
 * Il tipo 'referral_bonus' in credit_transactions.type è già stato aggiunto dalla
 * migrazione della Fase 1 (migrate_credit_config.js) — nessuna modifica al CHECK qui.
 *
 * Idempotente: sicuro da rieseguire (ADD COLUMN/CREATE TABLE/INDEX IF NOT EXISTS, il
 * backfill salta chi ha già un codice, il vincolo UNIQUE ignora l'errore se già presente).
 *
 * Rollback manuale, se mai servisse:
 *   DROP TABLE public.referrals;
 *   ALTER TABLE users DROP COLUMN referral_code;
 *
 * Run con: node scripts/run-db-script.js src/db/migrate_referrals.js --target=test|production
 */
require('dotenv').config();
const crypto = require('crypto');
const { query } = require('./index');

// Esclude caratteri ambigui (I/1, O/0) per codici leggibili/digitabili a mano.
const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += REFERRAL_CODE_CHARS[crypto.randomInt(REFERRAL_CODE_CHARS.length)];
  }
  return code;
}

async function migrate() {
  console.log('Running referrals migration...');

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);`);

  await query(`
    CREATE TABLE IF NOT EXISTS public.referrals (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      referrer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referred_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      referral_code  VARCHAR(20) NOT NULL,
      status         VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
      created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
      completed_at   TIMESTAMP WITH TIME ZONE
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);`);

  const { rows: usersWithoutCode } = await query('SELECT id FROM users WHERE referral_code IS NULL');
  console.log(`Backfilling referral codes for ${usersWithoutCode.length} existing user(s)...`);
  for (const { id } of usersWithoutCode) {
    let assigned = false;
    for (let attempt = 0; attempt < 5 && !assigned; attempt++) {
      const candidate = randomCode();
      try {
        await query('UPDATE users SET referral_code = $1 WHERE id = $2', [candidate, id]);
        assigned = true;
      } catch (err) {
        if (err.code !== '23505') throw err; // unique_violation su un altro utente creato nel frattempo: riprova
      }
    }
    if (!assigned) {
      throw new Error(`Could not assign a unique referral code to user ${id} after 5 attempts.`);
    }
  }

  await query(`ALTER TABLE users ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);`).catch((err) => {
    if (err.code !== '42710') throw err; // duplicate_object: vincolo già presente da una run precedente
  });

  console.log('✅  users.referral_code pronto (con backfill), tabella referrals creata.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
