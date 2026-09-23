/**
 * Migration: messe in evidenza pagabili solo con carta, prezzi in euro configurabili
 * da admin.
 *
 * Prima i prezzi erano in crediti hardcoded (5/9/18 CR) e la carta addebitava
 * crediti × 100 centesimi — un cambio implicito 1 CR = 1 € vietato da CLAUDE.md
 * ("REGOLE DI PRODOTTO DEFINITIVE SUI CREDITI": i crediti non hanno valore in euro e
 * si usano solo per i puzzle della Skill Zone).
 *
 *  - featured_tariffs: prezzo in centesimi per ogni tariffa (id = giorni, durate fisse),
 *    seminata con gli stessi importi che la carta addebitava già (5 € / 9 € / 18 €).
 *    ON CONFLICT DO NOTHING: rieseguire "up" non sovrascrive un prezzo tarato da admin.
 *  - featured_purchases.amount_cents: quanto è stato davvero addebitato sulla carta.
 *    amount_credits resta per lo storico degli acquisti fatti col wallet in passato.
 *
 * Reversibile:
 *   node scripts/run-db-script.js src/db/migrate_featured_card_only.js --target=production          (up)
 *   node scripts/run-db-script.js src/db/migrate_featured_card_only.js --target=production --down   (down)
 * "--down" e non "down": lo script viene caricato con require() dal wrapper, quindi
 * process.argv è quello del wrapper e argv[2] è il path dello script.
 * Il down elimina featured_tariffs (prezzi tarati da admin inclusi) e amount_cents.
 */
require('dotenv').config();
const { query } = require('./index');
const { DEFAULT_TARIFFS } = require('../services/featuredPricing');

async function up() {
  console.log('Creating featured_tariffs + featured_purchases.amount_cents...');

  await query(`
    CREATE TABLE IF NOT EXISTS public.featured_tariffs (
      id          TEXT PRIMARY KEY,
      days        INTEGER NOT NULL CHECK (days > 0),
      price_cents INTEGER NOT NULL CHECK (price_cents >= 50),
      updated_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
      updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
    );
  `);
  // Stesso trattamento delle altre tabelle solo-backend (migrate_enable_rls.sql):
  // RLS attiva senza policy, il backend si collega con un ruolo che la bypassa.
  await query('ALTER TABLE public.featured_tariffs ENABLE ROW LEVEL SECURITY;');

  for (const [id, { days, priceCents }] of Object.entries(DEFAULT_TARIFFS)) {
    await query(
      `INSERT INTO public.featured_tariffs (id, days, price_cents)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, days, priceCents]
    );
  }

  await query('ALTER TABLE public.featured_purchases ADD COLUMN IF NOT EXISTS amount_cents INTEGER;');

  console.log('✅  featured_tariffs pronta (7/14/30 giorni) e featured_purchases.amount_cents aggiunta.');
}

async function down() {
  console.log('Dropping featured_purchases.amount_cents + featured_tariffs...');
  await query('ALTER TABLE public.featured_purchases DROP COLUMN IF EXISTS amount_cents;');
  await query('DROP TABLE IF EXISTS public.featured_tariffs;');
  console.log('✅  Rollback completato.');
}

const direction = process.argv.includes('--down') ? down : up;

direction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌  Migration failed:', err);
    process.exit(1);
  });
