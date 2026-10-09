/**
 * One-off, single-account deletion: lb.lucabuzzi@gmail.com, the account
 * owner's own never-used test registration, deleted so the same email can
 * be used to register again from scratch.
 *
 * Deletes by exact email only (hardcoded below), never a pattern/wildcard.
 *
 * Refuses to touch the account if it has any orders, bids, reviews, shipments
 * or shipping quotes attached (those tables don't cascade-delete with the
 * user — see CLAUDE.md's "ogni modifica DB reversibile" and the FK layout in
 * src/db/schema.sql), so it can never silently take marketplace data down
 * with it, including data belonging to a counterparty. Wallet balance,
 * credit_transactions, referrals, identity signals and credit_bonus_grants
 * DO cascade and are removed automatically with the user row.
 *
 * Run con: node scripts/run-db-script.js scripts/delete-user-lb-lucabuzzi.js --target=production
 */
require('dotenv').config();
const { query } = require('../src/db');

const EMAIL = 'lb.lucabuzzi@gmail.com';

async function run() {
  const userRes = await query(
    'SELECT id, username, email, created_at FROM users WHERE email = $1',
    [EMAIL]
  );

  if (userRes.rows.length === 0) {
    console.log(`Nothing to do: no account with email ${EMAIL} (already deleted?).`);
    process.exit(0);
  }

  const user = userRes.rows[0];
  console.log(`Found: ${user.username} <${user.email}> (id=${user.id}, created_at=${user.created_at})`);

  const blockers = await query(`
    SELECT
      (SELECT COUNT(*) FROM orders WHERE buyer_id = $1 OR seller_id = $1) AS orders,
      (SELECT COUNT(*) FROM bids WHERE bidder_id = $1) AS bids,
      (SELECT COUNT(*) FROM listings WHERE seller_id = $1) AS listings,
      (SELECT COUNT(*) FROM reviews WHERE reviewer_id = $1 OR reviewed_id = $1) AS reviews,
      (SELECT COUNT(*) FROM shipments WHERE buyer_id = $1 OR seller_id = $1) AS shipments,
      (SELECT COUNT(*) FROM shipping_quotes WHERE buyer_id = $1 OR seller_id = $1) AS shipping_quotes
  `, [user.id]);

  const b = blockers.rows[0];
  const total = Object.values(b).reduce((sum, n) => sum + parseInt(n, 10), 0);

  if (total > 0) {
    console.error('❌ Refusing to delete: found related records that do not cascade-delete:', JSON.stringify(b, null, 2));
    console.error('These would need manual review first — this script only handles a clean, unused account.');
    process.exit(1);
  }

  const result = await query('DELETE FROM users WHERE id = $1 RETURNING username, email', [user.id]);
  console.log(`✅  Deleted account (and wallet/transactions/referral/identity-signal rows via cascade): ${result.rows[0].username} <${result.rows[0].email}>`);
  console.log(`The email ${EMAIL} is now free to register again.`);

  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Deletion failed:', err);
  process.exit(1);
});
