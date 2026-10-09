/**
 * Diagnostica di sola lettura: verifica quanti/quali record collegati esistono
 * per un utente, in entrambi i DB (main + ClutchVault, stesso Postgres fisico),
 * prima di decidere se è sicuro cancellarlo definitivamente oppure se conviene
 * il soft-delete già esistente (account_status='deleted').
 *
 * Run con: node scripts/run-db-script.js scripts/check-user-deletability.js --target=production
 */
require('dotenv').config();
const { query } = require('../src/db');

const EMAIL = 'luca.buzzi@outlook.com';

async function run() {
  const userRes = await query(
    `SELECT id, email, username, role, is_active, account_status, created_at FROM users WHERE email = $1`,
    [EMAIL]
  );

  if (userRes.rows.length === 0) {
    console.log(`Nessun utente trovato con email ${EMAIL}.`);
    process.exit(0);
  }

  const user = userRes.rows[0];
  console.log('Utente:', JSON.stringify(user, null, 2));
  const id = user.id;

  const counts = await query(`
    SELECT
      (SELECT COUNT(*) FROM orders WHERE buyer_id = $1) AS orders_as_buyer,
      (SELECT COUNT(*) FROM orders WHERE seller_id = $1) AS orders_as_seller,
      (SELECT COUNT(*) FROM bids WHERE bidder_id = $1) AS bids,
      (SELECT COUNT(*) FROM listings WHERE seller_id = $1) AS listings,
      (SELECT COUNT(*) FROM reviews WHERE reviewer_id = $1) AS reviews_written,
      (SELECT COUNT(*) FROM reviews WHERE reviewed_id = $1) AS reviews_received,
      (SELECT COUNT(*) FROM shipments WHERE buyer_id = $1 OR seller_id = $1) AS shipments,
      (SELECT COUNT(*) FROM shipping_quotes WHERE buyer_id = $1 OR seller_id = $1) AS shipping_quotes,
      (SELECT COALESCE(balance_credits, 0) FROM public.user_wallets WHERE user_id = $1) AS wallet_balance,
      (SELECT COUNT(*) FROM public.credit_transactions WHERE user_id = $1) AS credit_transactions,
      (SELECT COUNT(*) FROM referrals WHERE referrer_id = $1 OR referred_id = $1) AS referrals,
      (SELECT COUNT(*) FROM user_identity_signals WHERE user_id = $1) AS identity_signals,
      (SELECT COUNT(*) FROM credit_bonus_grants WHERE user_id = $1) AS credit_bonus_grants
  `, [id]);

  console.log('Record collegati:', JSON.stringify(counts.rows[0], null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Query fallita:', err);
  process.exit(1);
});
