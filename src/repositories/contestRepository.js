const db = require('../db/clutchvault-db');

function listOpenContests() {
  return db.query(
    `SELECT c.*, p.title, p.image_url, p.category, p.market_value, p.condition, p.grading_info
     FROM public.contests c
     JOIN public.products p ON c.product_id = p.id
     WHERE c.status != 'cancelled'
     ORDER BY c.created_at DESC`
  ).then((r) => r.rows);
}

function getSlotCost(contestId) {
  return db.query('SELECT slot_cost_credits FROM public.contests WHERE id = $1', [contestId])
    .then((r) => r.rows[0] || null);
}

function buySlot(userId, contestId, slotCost, username) {
  return db.query(
    'SELECT public.buy_contest_slot($1, $2, $3, $4) AS result',
    [userId, contestId, slotCost, username]
  ).then((r) => r.rows[0].result);
}

function getLeaderboard(contestId) {
  return db.query(
    `SELECT cp.*
     FROM public.contest_participants cp
     WHERE cp.contest_id = $1
     ORDER BY
       CASE WHEN cp.status = 'completed' THEN 0 ELSE 1 END,
       cp.total_time_ms ASC,
       cp.created_at ASC`,
    [contestId]
  ).then((r) => r.rows);
}

// A user can hold multiple paid entries in the same contest — this finds the
// most recently bought one that hasn't been started yet (buy-slot always
// calls /start right after).
function findUnstartedParticipant(contestId, userId) {
  return db.query(
    `SELECT id, status FROM public.contest_participants
     WHERE contest_id = $1 AND user_id = $2 AND started_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [contestId, userId]
  ).then((r) => r.rows[0] || null);
}

function markParticipantStarted(participantId, startedAt) {
  return db.query(
    'UPDATE public.contest_participants SET started_at = $1 WHERE id = $2',
    [startedAt, participantId]
  );
}

// Only voids the currently in-flight attempt (started but not yet completed) —
// a user can hold other pending/completed entries in the same contest.
function voidInFlightAttempt(contestId, userId) {
  return db.query(
    "UPDATE public.contest_participants SET status = 'cheated' WHERE contest_id = $1 AND user_id = $2 AND started_at IS NOT NULL AND ended_at IS NULL",
    [contestId, userId]
  );
}

function completeParticipant(participantId, endedAtIso, timeMs, status) {
  return db.query(
    `UPDATE public.contest_participants
     SET ended_at = $1, total_time_ms = $2, status = $3
     WHERE id = $4`,
    [endedAtIso, timeMs, status, participantId]
  );
}

function getContestSlots(contestId) {
  return db.query(
    'SELECT status, total_slots, filled_slots FROM public.contests WHERE id = $1',
    [contestId]
  ).then((r) => r.rows[0] || null);
}

function countFinishedParticipants(contestId) {
  return db.query(
    `SELECT COUNT(*) as count
     FROM public.contest_participants
     WHERE contest_id = $1 AND status != 'pending'`,
    [contestId]
  ).then((r) => parseInt(r.rows[0].count, 10));
}

function getFastestCompletedParticipant(contestId) {
  return db.query(
    `SELECT cp.user_id, cp.total_time_ms, cp.username
     FROM public.contest_participants cp
     WHERE cp.contest_id = $1 AND cp.status = 'completed'
     ORDER BY cp.total_time_ms ASC
     LIMIT 1`,
    [contestId]
  ).then((r) => r.rows[0] || null);
}

function finalizeContestWinner(contestId, winnerId) {
  return db.query(
    "UPDATE public.contests SET status = 'completed', winner_id = $1 WHERE id = $2",
    [winnerId, contestId]
  );
}

function cancelContest(contestId) {
  return db.query("UPDATE public.contests SET status = 'cancelled' WHERE id = $1", [contestId]);
}

function getContestForRefund(contestId) {
  return db.query(
    'SELECT status, slot_cost_credits FROM public.contests WHERE id = $1',
    [contestId]
  ).then((r) => r.rows[0] || null);
}

function getContestParticipantUserIds(contestId) {
  return db.query(
    'SELECT user_id FROM public.contest_participants WHERE contest_id = $1',
    [contestId]
  ).then((r) => r.rows);
}

async function refundParticipant(userId, amount, contestId) {
  await db.query(
    'UPDATE public.user_wallets SET balance_credits = balance_credits + $1 WHERE user_id = $2',
    [amount, userId]
  );
  await db.query(
    'INSERT INTO public.credit_transactions (user_id, amount, type, reference_id) VALUES ($1, $2, $3, $4)',
    [userId, amount, 'contest_refund', contestId]
  );
}

// Handles both the mock in-memory DB (used when Postgres is unreachable) and
// real Postgres — see isMock in src/db/clutchvault-db.js.
async function createContestProduct({
  contestId, productId, title, description, imageUrl, category,
  marketValue, condition, gradingInfo, totalSlots, slotCostCredits,
}) {
  if (db.isMock) {
    const mockDb = db.getMockDbState();
    mockDb.products.push({
      id: productId,
      title,
      description: description || '',
      image_url: imageUrl,
      category,
      market_value: parseFloat(marketValue),
      condition: condition || 'New',
      grading_info: gradingInfo || 'Ungraded',
      stock: 1,
    });
    mockDb.contests.push({
      id: contestId,
      product_id: productId,
      total_slots: parseInt(totalSlots, 10),
      filled_slots: 0,
      slot_cost_credits: parseFloat(slotCostCredits),
      status: 'open',
      winner_id: null,
    });
    return;
  }

  await db.query(`
    INSERT INTO public.products (id, title, description, image_url, category, market_value, condition, grading_info, stock)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
  `, [productId, title, description || '', imageUrl, category, parseFloat(marketValue), condition || 'New', gradingInfo || 'Ungraded']);

  await db.query(`
    INSERT INTO public.contests (id, product_id, total_slots, filled_slots, slot_cost_credits, status)
    VALUES ($1, $2, $3, 0, $4, 'open')
  `, [contestId, productId, parseInt(totalSlots, 10), parseFloat(slotCostCredits)]);
}

module.exports = {
  listOpenContests,
  getSlotCost,
  buySlot,
  getLeaderboard,
  findUnstartedParticipant,
  markParticipantStarted,
  voidInFlightAttempt,
  completeParticipant,
  getContestSlots,
  countFinishedParticipants,
  getFastestCompletedParticipant,
  finalizeContestWinner,
  cancelContest,
  getContestForRefund,
  getContestParticipantUserIds,
  refundParticipant,
  createContestProduct,
};
