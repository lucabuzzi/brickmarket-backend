/**
 * Migration: idempotency guard for contest-refund credit_transactions rows.
 *
 * Root cause fixed: contestController.refundContestHandler / contestRepository
 * .refundParticipant credited a participant's wallet with no idempotency check —
 * a retried request (client retry, double-click, two admins hitting refund at
 * once) could credit the same user for the same contest more than once.
 *
 * This adds a PARTIAL unique index on credit_transactions(user_id, reference_id)
 * restricted to type = 'contest_refund' (other transaction types keep using
 * reference_id for unrelated things — a Stripe PaymentIntent id, a contest_entry
 * contest id, etc. — so the index must not apply to them). The application then
 * inserts with `ON CONFLICT (user_id, reference_id) WHERE type = 'contest_refund'
 * DO NOTHING`, so only the first refund attempt for a given (user, contest) pair
 * ever credits the wallet — everything after that is a safe, idempotent no-op,
 * even under concurrent/parallel requests (Postgres enforces this at the index
 * level, not in application code).
 *
 * Reversible: node src/db/migrate_contest_refund_idempotency.js         (up)
 *             node src/db/migrate_contest_refund_idempotency.js down    (down)
 * Idempotent: safe to run "up" more than once (IF NOT EXISTS).
 */
require('dotenv').config();
const { query } = require('./index');

const INDEX_NAME = 'idx_credit_transactions_contest_refund_unique';

async function up() {
  console.log(`Creating partial unique index ${INDEX_NAME}...`);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX_NAME}
    ON public.credit_transactions (user_id, reference_id)
    WHERE type = 'contest_refund';
  `);
  console.log(`✅  ${INDEX_NAME} created. Contest refunds are now idempotent per (user, contest).`);
}

async function down() {
  console.log(`Dropping index ${INDEX_NAME}...`);
  await query(`DROP INDEX IF EXISTS public.${INDEX_NAME};`);
  console.log(`✅  ${INDEX_NAME} dropped.`);
}

const direction = process.argv[2] === 'down' ? down : up;

direction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌  Migration failed:', err);
    process.exit(1);
  });

module.exports = { up, down };
