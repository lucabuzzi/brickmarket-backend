/**
 * Migration: bonus vendita/acquisto con periodo di maturazione (CLAUDE.md, "REGOLE DI
 * PRODOTTO DEFINITIVE SUI CREDITI" — "Bonus vendita/acquisto: maturano dopo un periodo
 * di maturazione di 15 giorni (configurabile) dalla CONSEGNA CONFERMATA, solo se non ci
 * sono contestazioni/resi/rimborsi aperti. Importo minimo d'ordine per maturare crediti:
 * 5 € (configurabile).").
 *
 * public.credit_bonus_grants è lo stato intermedio "in maturazione": una riga per
 * bonus (una per venditore, una per acquirente) creata alla consegna confermata, con
 * status pending fino a quando il cron di maturazione (src/services/creditMaturation.js)
 * non la matura (credita il wallet) o la annulla (se nel frattempo l'ordine collegato è
 * disputed/refunded/cancelled). Il credito vero e proprio non tocca mai il wallet prima
 * della maturazione — vedi src/repositories/paymentsRepository.js#completeDeliveryConfirmation
 * per dove le righe pending vengono create.
 *
 * Vive nel DB principale (stesso pool di orders/users, tramite src/db/index.js) perché
 * ha una FK su orders — non nel pool ClutchVault (src/db/clutchvault-db.js), che è per
 * user_wallets/credit_transactions.
 *
 * Idempotente: sicuro da rieseguire (CREATE TABLE/INDEX IF NOT EXISTS).
 *
 * Rollback manuale, se mai servisse:
 *   DROP TABLE public.credit_bonus_grants;
 *
 * Run con: node scripts/run-db-script.js src/db/migrate_credit_bonus_grants.js --target=test|production
 */
require('dotenv').config();
const { query } = require('./index');

async function migrate() {
  console.log('Running credit_bonus_grants migration...');

  await query(`
    CREATE TABLE IF NOT EXISTS public.credit_bonus_grants (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type           VARCHAR(20) NOT NULL CHECK (type IN ('sale_bonus', 'purchase_bonus')),
      amount         NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      matures_at     TIMESTAMP WITH TIME ZONE NOT NULL,
      status         VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matured', 'cancelled')),
      cancel_reason  VARCHAR(100),
      created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
      matured_at     TIMESTAMP WITH TIME ZONE,
      UNIQUE (order_id, type)
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_credit_bonus_grants_matures_at ON public.credit_bonus_grants(matures_at) WHERE status = 'pending';`);
  await query(`CREATE INDEX IF NOT EXISTS idx_credit_bonus_grants_user_id ON public.credit_bonus_grants(user_id);`);

  console.log('✅  credit_bonus_grants pronta.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
