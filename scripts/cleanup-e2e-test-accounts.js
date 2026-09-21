/**
 * One-off cleanup: removes the two throwaway accounts created while manually
 * verifying the credit system end-to-end (registration -> email verification ->
 * signup bonus -> referral bonus) against production on 2026-09-21.
 *
 * Deletes by exact email only (hardcoded list below, never a pattern/wildcard) —
 * this is a deliberately narrow, one-time script, not a general "delete test users"
 * tool. Safe to re-run: does nothing if the accounts are already gone.
 *
 * Refuses to touch either account if it has any real orders or listings attached
 * (users.orders/listings don't cascade-delete — see CLAUDE.md), so it can never
 * silently take marketplace data down with it. In this case neither account has
 * either: no purchase flow was exercised, only registration/verification/referral.
 *
 * Run con: node scripts/run-db-script.js scripts/cleanup-e2e-test-accounts.js --target=production
 */
require('dotenv').config();
const { query } = require('../src/db');

const EMAILS_TO_DELETE = [
  'e2e-verify-test-1@example.com',
  'e2e-verify-test-2@example.com',
];

async function run() {
  console.log('Looking up accounts:', EMAILS_TO_DELETE.join(', '));

  const users = await query(
    'SELECT id, username, email, created_at FROM users WHERE email = ANY($1)',
    [EMAILS_TO_DELETE]
  );

  if (users.rows.length === 0) {
    console.log('Nothing to do: none of these accounts exist (already cleaned up?).');
    process.exit(0);
  }

  console.log(`Found ${users.rows.length} account(s):`);
  for (const u of users.rows) {
    console.log(`  - ${u.username} <${u.email}> (id=${u.id}, created_at=${u.created_at})`);
  }

  const userIds = users.rows.map((u) => u.id);

  const orders = await query(
    'SELECT id FROM orders WHERE buyer_id = ANY($1) OR seller_id = ANY($1)',
    [userIds]
  );
  const listings = await query('SELECT id FROM listings WHERE seller_id = ANY($1)', [userIds]);

  if (orders.rows.length > 0 || listings.rows.length > 0) {
    console.error(
      `❌ Refusing to delete: found ${orders.rows.length} order(s) and ${listings.rows.length} listing(s) ` +
      'attached to these accounts. These do not cascade-delete with the user and would need manual review first.'
    );
    process.exit(1);
  }

  const result = await query('DELETE FROM users WHERE id = ANY($1) RETURNING username, email', [userIds]);
  console.log(`✅  Deleted ${result.rows.length} account(s) (and their wallet/transactions/referral rows via cascade):`);
  for (const u of result.rows) {
    console.log(`  - ${u.username} <${u.email}>`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('❌  Cleanup failed:', err);
  process.exit(1);
});
