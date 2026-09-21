/**
 * Migration: crediti configurabili da admin (mai hardcoded nel codice applicativo —
 * CLAUDE.md, "REGOLE DI PRODOTTO DEFINITIVE SUI CREDITI") + estensione del CHECK di
 * credit_transactions.type per i nuovi tipi di bonus/clawback che le fasi successive
 * (registrazione, referral, vendita/acquisto maturati, anti-abuso) andranno a scrivere.
 *
 * Solo i valori con un numero esplicito nelle regole di prodotto sono seminati qui
 * (bonus fissi, giorni di maturazione, importo minimo ordine). I tetti anti-abuso
 * giornalieri/mensili non hanno ancora un numero deciso: verranno aggiunti come nuove
 * righe in questa stessa tabella quando quella fase viene implementata, senza bisogno
 * di un'altra migrazione di schema (è una tabella chiave/valore).
 *
 * Idempotente: sicuro da rieseguire. I valori di default vengono inseriti solo se la
 * chiave non esiste già (ON CONFLICT DO NOTHING), quindi rieseguire la migrazione non
 * sovrascrive un valore già tarato da un admin.
 *
 * Rollback manuale, se mai servisse (via node scripts/run-db-script.js con uno script
 * ad-hoc, mai eseguendo query a mano contro .env):
 *   ALTER TABLE public.credit_transactions DROP CONSTRAINT credit_transactions_type_check;
 *   ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_type_check
 *     CHECK (type IN ('deposit','contest_entry','contest_refund','payout','shop_purchase'));
 *   DROP TABLE public.credit_config;
 *
 * Run con: node scripts/run-db-script.js src/db/migrate_credit_config.js --target=test|production
 */
require('dotenv').config();
const { query } = require('./index');

const DEFAULTS = [
  ['signup_bonus', 5.00, "Crediti assegnati alla registrazione, dopo la verifica email"],
  ['referral_bonus', 5.00, "Crediti assegnati a chi ha invitato, quando l'invitato completa registrazione e verifica email"],
  ['sale_bonus', 5.00, 'Crediti assegnati al venditore quando un ordine matura (nessuna contestazione/reso entro maturation_days dalla consegna confermata)'],
  ['purchase_bonus', 5.00, 'Crediti assegnati al compratore quando un ordine matura (nessuna contestazione/reso entro maturation_days dalla consegna confermata)'],
  ['maturation_days', 15, 'Giorni di attesa dalla consegna confermata prima che i bonus vendita/acquisto maturino'],
  ['min_order_amount', 5.00, "Importo minimo ordine (in EUR, total_buyer) perché vendita/acquisto maturino un bonus"],
];

async function migrate() {
  console.log('Running credit_config migration...');

  await query(`
    CREATE TABLE IF NOT EXISTS public.credit_config (
      key         VARCHAR(60) PRIMARY KEY,
      value       NUMERIC(12, 2) NOT NULL,
      description TEXT,
      updated_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
      updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `);

  for (const [key, value, description] of DEFAULTS) {
    await query(
      `INSERT INTO public.credit_config (key, value, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO NOTHING`,
      [key, value, description]
    );
  }

  // Estende gli eventi ammessi nel ledger: i tipi storici restano validi (righe già
  // esistenti devono continuare a soddisfare il CHECK), si aggiungono solo i nuovi.
  await query(`ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;`);
  await query(`
    ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_type_check
      CHECK (type IN (
        'deposit', 'contest_entry', 'contest_refund', 'payout', 'shop_purchase',
        'signup_bonus', 'referral_bonus', 'sale_bonus', 'purchase_bonus', 'clawback'
      ));
  `);

  console.log('✅  credit_config pronta (6 valori di default) e credit_transactions.type estesa con i tipi bonus/clawback.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
