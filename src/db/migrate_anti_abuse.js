/**
 * Migration: anti-abuso obbligatorio per i bonus vendita/acquisto (CLAUDE.md —
 * "nessun bonus se venditore e compratore condividono IP, dispositivo, metodo di
 * pagamento o indirizzo di spedizione; tetto mensile di bonus per coppia venditore-
 * compratore; tetti giornalieri/mensili per utente").
 *
 * public.user_identity_signals: log append-only di segnali osservati per utente
 * (ip/device alla registrazione e al login, ip/device/indirizzo di spedizione al
 * checkout, impronta della carta al pagamento riuscito — vedi
 * src/repositories/identitySignalRepository.js). Solo l'hash SHA-256 viene salvato,
 * mai il valore in chiaro. Il controllo "venditore e compratore condividono X" è una
 * query EXISTS su questa tabella: due utenti condividono un segnale se hanno la
 * stessa coppia (signal_type, signal_hash).
 *
 * credit_bonus_grants.flagged_for_review: quando un tetto (giornaliero/mensile per
 * utente, o mensile per coppia) verrebbe superato, il grant si crea comunque ma resta
 * bloccato in revisione manuale (mai maturato automaticamente dal cron) finché un
 * admin non lo approva o lo respinge — vedi /admin/credit-bonus-grants/flagged.
 *
 * I tre nuovi valori di credit_config (tetti) sono seminati con ON CONFLICT DO
 * NOTHING, quindi rieseguire la migrazione non sovrascrive un valore già tarato.
 *
 * Idempotente: sicuro da rieseguire.
 *
 * Rollback manuale, se mai servisse:
 *   DROP TABLE public.user_identity_signals;
 *   ALTER TABLE public.credit_bonus_grants DROP COLUMN flagged_for_review, DROP COLUMN flag_reason;
 *   DELETE FROM public.credit_config WHERE key IN ('daily_bonus_cap_per_user', 'monthly_bonus_cap_per_user', 'monthly_bonus_cap_per_pair');
 *
 * Run con: node scripts/run-db-script.js src/db/migrate_anti_abuse.js --target=test|production
 */
require('dotenv').config();
const { query } = require('./index');

const CAP_DEFAULTS = [
  ['daily_bonus_cap_per_user', 20, 'Tetto giornaliero (rolling 24h) di bonus vendita+acquisto per utente, oltre il quale il grant resta in revisione manuale'],
  ['monthly_bonus_cap_per_user', 60, 'Tetto mensile (rolling 30gg) di bonus vendita+acquisto per utente, oltre il quale il grant resta in revisione manuale'],
  ['monthly_bonus_cap_per_pair', 15, 'Tetto mensile (rolling 30gg) di bonus vendita+acquisto tra la stessa coppia venditore-compratore, oltre il quale il grant resta in revisione manuale'],
];

async function migrate() {
  console.log('Running anti-abuse migration...');

  await query(`
    CREATE TABLE IF NOT EXISTS public.user_identity_signals (
      id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      signal_type  VARCHAR(20) NOT NULL CHECK (signal_type IN ('ip', 'device', 'payment_fingerprint', 'shipping_address')),
      signal_hash  VARCHAR(64) NOT NULL,
      created_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_identity_signals_user_id ON public.user_identity_signals(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_identity_signals_lookup ON public.user_identity_signals(signal_type, signal_hash);`);

  await query(`
    ALTER TABLE public.credit_bonus_grants
      ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(100);
  `);

  for (const [key, value, description] of CAP_DEFAULTS) {
    await query(
      `INSERT INTO public.credit_config (key, value, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING`,
      [key, value, description]
    );
  }

  console.log('✅  user_identity_signals pronta, credit_bonus_grants estesa con flagged_for_review, 3 tetti anti-abuso seminati in credit_config.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
