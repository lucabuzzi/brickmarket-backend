/**
 * Migration: moderazione della chat scritta della piazza di CardBrix the game (/game).
 *
 * - game_chat_settings      impostazioni modificabili dall'admin (chiave -> valore JSON). Vuota = valori di default
 *                           di src/services/chatModeration/settings.js (chat scritta SPENTA).
 * - game_chat_banned_terms  parole vietate (lista modificabile dall'admin), seminata con
 *                           src/config/gameChatBannedTerms.json.
 * - game_chat_moderation_log  messaggi BLOCCATI (testo, motivo, chi), per la revisione dell'admin; cancellati dopo
 *                           log_retention_days (30). I messaggi accettati NON vengono salvati.
 * - game_chat_mutes         giocatori silenziati fino a una data (automatico dopo troppi blocchi, o dall'admin).
 *
 * Tutte con RLS attiva e nessuna policy, come le altre tabelle (il backend si collega come owner con BYPASSRLS):
 * nessuno le legge con la anon key di Supabase.
 *
 * Idempotente (IF NOT EXISTS, seed ON CONFLICT DO NOTHING: rieseguirla non tocca le parole già modificate).
 * Reversibile:
 *   node scripts/run-db-script.js src/db/migrate_game_chat_moderation.js --target=<t>           (up)
 *   node scripts/run-db-script.js src/db/migrate_game_chat_moderation.js --target=<t> --down    (down: elimina le 4 tabelle)
 */
require('dotenv').config();
const { query } = require('./index');
const { terms: SEED_TERMS } = require('../config/gameChatBannedTerms.json');

const TABLES = ['game_chat_settings', 'game_chat_banned_terms', 'game_chat_moderation_log', 'game_chat_mutes'];

async function up() {
  await query(`
    CREATE TABLE IF NOT EXISTS public.game_chat_settings (
      key        VARCHAR(60) PRIMARY KEY,
      value      JSONB NOT NULL,
      updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS public.game_chat_banned_terms (
      id         SERIAL PRIMARY KEY,
      term       VARCHAR(80) NOT NULL UNIQUE,
      added_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS public.game_chat_moderation_log (
      id         BIGSERIAL PRIMARY KEY,
      user_id    UUID REFERENCES public.users(id) ON DELETE CASCADE,
      username   VARCHAR(100),
      message    VARCHAR(600) NOT NULL,
      category   VARCHAR(30) NOT NULL,
      source     VARCHAR(10) NOT NULL CHECK (source IN ('rule', 'ai')),
      detail     VARCHAR(200),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS game_chat_moderation_log_created_idx ON public.game_chat_moderation_log (created_at DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS game_chat_moderation_log_user_idx ON public.game_chat_moderation_log (user_id, created_at DESC);`);
  await query(`
    CREATE TABLE IF NOT EXISTS public.game_chat_mutes (
      user_id    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
      muted_until TIMESTAMPTZ NOT NULL,
      reason     VARCHAR(30) NOT NULL,
      muted_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  for (const t of TABLES) await query(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);

  let added = 0;
  for (const term of SEED_TERMS) {
    const r = await query(`INSERT INTO public.game_chat_banned_terms (term) VALUES ($1) ON CONFLICT (term) DO NOTHING`, [term]);
    added += r.rowCount || 0;
  }

  const rls = await query(`SELECT relname FROM pg_class WHERE relname = ANY($1) AND relrowsecurity`, [TABLES]);
  if (rls.rows.length !== TABLES.length) throw new Error(`RLS non attiva su tutte le tabelle: ${rls.rows.map((r) => r.relname).join(', ')}`);
  console.log(`game chat moderation ready: ${TABLES.length} tables (RLS on), ${added} banned terms added.`);
}

async function down() {
  for (const t of [...TABLES].reverse()) await query(`DROP TABLE IF EXISTS public.${t};`);
  console.log('game chat moderation tables dropped.');
}

// The wrapper require()s this file, so detect the flag in argv instead of argv[2].
(process.argv.includes('--down') ? down() : up())
  .then(() => process.exit(0))
  .catch((err) => { console.error('Migration failed:', err.message); process.exit(1); });
