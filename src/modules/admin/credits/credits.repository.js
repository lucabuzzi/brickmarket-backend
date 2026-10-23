// SQL behind the admin credits ledger. Config values and bonus grants have their own repositories
// (src/repositories/creditConfigRepository.js, creditBonusGrantRepository.js), shared with the jobs.
const { query } = require('../../../db');

const userFilter = (userId) => (userId
  ? { clause: 'WHERE ct.user_id = $1', params: [userId] }
  : { clause: '', params: [] });

/** One page of the append-only credit ledger, newest first, with each user's current balance. */
async function findTransactions(userId, limit, offset) {
  const { clause, params } = userFilter(userId);
  const result = await query(`
    SELECT ct.id, ct.user_id, u.username, u.email, ct.amount, ct.type, ct.reference_id, ct.created_at,
           w.balance_credits AS current_balance
    FROM public.credit_transactions ct
    JOIN users u ON u.id = ct.user_id
    LEFT JOIN public.user_wallets w ON w.user_id = ct.user_id
    ${clause}
    ORDER BY ct.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);
  return result.rows;
}

/** @returns {Promise<number|undefined>} */
async function countTransactions(userId) {
  const { clause, params } = userFilter(userId);
  const result = await query(`
    SELECT COUNT(*)::int AS total FROM public.credit_transactions ct ${clause}
  `, params);
  return result.rows[0]?.total;
}

module.exports = { findTransactions, countTransactions };
