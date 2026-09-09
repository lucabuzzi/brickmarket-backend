const db = require('../db/clutchvault-db');
const mainDb = require('../db');

function getBalance(userId) {
  return db.query(
    'SELECT balance_credits FROM public.user_wallets WHERE user_id = $1',
    [userId]
  ).then((r) => r.rows[0] || null);
}

function createWallet(userId, initialBalance = 100.00) {
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

function findDepositByReference(referenceId) {
  return db.query(
    "SELECT id FROM public.credit_transactions WHERE reference_id = $1 AND type = 'deposit'",
    [referenceId]
  ).then((r) => r.rows[0] || null);
}

async function creditWallet(userId, amount, { referenceId, type = 'deposit' } = {}) {
  await db.query(
    'UPDATE public.user_wallets SET balance_credits = balance_credits + $1, updated_at = now() WHERE user_id = $2',
    [amount, userId]
  );
  if (referenceId) {
    await db.query(
      'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
      [userId, amount, type, referenceId]
    );
  }
}

function buyProduct(userId, productId) {
  return db.query(
    'SELECT public.buy_product($1, $2) AS result',
    [userId, productId]
  ).then((r) => r.rows[0].result);
}

function getStripeAccountId(userId) {
  return mainDb.query('SELECT stripe_account_id FROM users WHERE id = $1', [userId])
    .then((r) => r.rows[0]?.stripe_account_id || null);
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

module.exports = {
  getBalance,
  createWallet,
  listTransactions,
  findDepositByReference,
  creditWallet,
  buyProduct,
  getStripeAccountId,
  debitWalletIfSufficient,
  recordTransaction,
};
