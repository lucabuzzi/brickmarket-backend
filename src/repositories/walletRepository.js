const db = require('../db/clutchvault-db');

function getBalance(userId) {
  return db.query(
    'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1',
    [userId]
  ).then((r) => r.rows[0] || null);
}

// Crediti si guadagnano solo tramite gli eventi definiti (registrazione, referral,
// vendita, acquisto — vedi CLAUDE.md), mai da un saldo di partenza: default 0.
function createWallet(userId, initialBalance = 0.00) {
  return db.query(
    'INSERT INTO public.user_wallets (user_id, balance_credits) VALUES ($1, $2)',
    [userId, initialBalance]
  );
}

function listTransactions(userId) {
  return db.query(
    'SELECT id, amount, type, reference_id, created_at FROM public.credit_transactions WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  ).then((r) => r.rows);
}

// Upsert, non un semplice UPDATE: un utente appena registrato non ha ancora una riga
// in user_wallets (viene creata lazy alla prima GET /api/wallet/balance), quindi un
// UPDATE puro colpirebbe 0 righe e il credito andrebbe perso in silenzio pur restando
// il movimento nel ledger. L'INSERT ... ON CONFLICT copre sia il caso "wallet non
// ancora esistente" (parte già dall'importo accreditato) sia quello normale.
async function creditWallet(userId, amount, { referenceId, type = 'deposit' } = {}) {
  await db.query(
    `INSERT INTO public.user_wallets (user_id, balance_credits, updated_at)
     VALUES ($2, $1, now())
     ON CONFLICT (user_id) DO UPDATE
       SET balance_credits = public.user_wallets.balance_credits + EXCLUDED.balance_credits,
           updated_at = now()`,
    [amount, userId]
  );
  if (referenceId) {
    await db.query(
      'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
      [userId, amount, type, referenceId]
    );
  }
}

// Usato per rendere idempotenti i bonus "one-shot" per utente (es. signup_bonus):
// se esiste già una riga con questo tipo/riferimento, non va accreditato di nuovo.
function findTransactionByTypeAndReference(userId, type, referenceId) {
  return db.query(
    'SELECT id FROM public.credit_transactions WHERE user_id = $1 AND type = $2 AND reference_id = $3 LIMIT 1',
    [userId, type, String(referenceId)]
  ).then((r) => r.rows[0] || null);
}

function buyProduct(userId, productId) {
  return db.query(
    'SELECT public.buy_product($1, $2) AS result',
    [userId, productId]
  ).then((r) => r.rows[0].result);
}

// Debits only if the balance actually covers it (row-level condition, not a
// separate read-then-write) so two concurrent conversions can't both succeed
// off the same starting balance. Returns the new balance row, or null if the
// balance was insufficient.
function debitWalletIfSufficient(userId, credits) {
  return db.query(
    `UPDATE public.user_wallets
     SET balance_credits = balance_credits - $1, updated_at = now()
     WHERE user_id = $2 AND balance_credits >= $1
     RETURNING balance_credits`,
    [credits, userId]
  ).then((r) => r.rows[0] || null);
}

function recordTransaction(userId, amount, type, referenceId) {
  return db.query(
    'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
    [userId, amount, type, referenceId]
  );
}

// Toglie fino a `amount`, ma MAI sotto zero (balance_credits ha un CHECK >= 0): se il
// bonus è già stato speso, si toglie solo quel che resta. Registra comunque una riga
// 'clawback' col segno negativo dell'importo EFFETTIVAMENTE tolto (può essere meno
// del richiesto), mai una riga se non c'era nulla da togliere. Ritorna quell'importo.
async function clawback(userId, amount, { referenceId, type = 'clawback' } = {}) {
  const result = await db.query(
    `WITH before AS (
       SELECT balance_credits AS before_balance FROM public.user_wallets WHERE user_id = $2 FOR UPDATE
     )
     UPDATE public.user_wallets w
     SET balance_credits = w.balance_credits - LEAST($1::numeric, before.before_balance), updated_at = now()
     FROM before
     WHERE w.user_id = $2
     RETURNING w.balance_credits AS new_balance, before.before_balance AS before_balance`,
    [amount, userId]
  );
  const row = result.rows[0];
  if (!row) return 0; // nessun wallet per questo utente: niente da togliere

  const actualDebited = parseFloat(row.before_balance) - parseFloat(row.new_balance);
  if (actualDebited > 0) {
    await db.query(
      'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
      [userId, -actualDebited, type, referenceId]
    );
  }
  return actualDebited;
}

module.exports = {
  getBalance,
  createWallet,
  listTransactions,
  creditWallet,
  findTransactionByTypeAndReference,
  buyProduct,
  debitWalletIfSufficient,
  recordTransaction,
  clawback,
};
