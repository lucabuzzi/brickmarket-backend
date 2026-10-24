// Admin side of the credit system: the full ledger, the configurable values (never hardcoded: CLAUDE.md,
// "REGOLE DI PRODOTTO DEFINITIVE SUI CREDITI"), and the bonus grants held by an anti-abuse cap.
const HttpError = require('../../../http/HttpError');
const repo = require('./credits.repository');
const creditConfigRepository = require('../../../repositories/creditConfigRepository');
const creditBonusGrantRepository = require('../../../repositories/creditBonusGrantRepository');
const { processMaturedGrants, reviewFlaggedGrant } = require('../../../services/creditMaturation');

/** Every credit transaction (optionally one user's), default 100 per page, max 500. */
async function ledger(q) {
  const limit = Math.min(parseInt(q.limit, 10) || 100, 500);
  const offset = parseInt(q.offset, 10) || 0;
  const rows = await repo.findTransactions(q.userId, limit, offset);
  const total = await repo.countTransactions(q.userId);
  return {
    transactions: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      email: r.email,
      amount: parseFloat(r.amount),
      type: r.type,
      referenceId: r.reference_id,
      createdAt: r.created_at,
      currentBalance: r.current_balance !== null ? parseFloat(r.current_balance) : null,
    })),
    total: total || 0,
    limit,
    offset,
  };
}

/** Every configurable value; a key missing from the DB comes back with isDefault:true and its code default. */
async function config() {
  return { config: await creditConfigRepository.getAll() };
}

/** Sets one known key to a number >= 0 (audit on the row itself: updated_by/updated_at). */
async function setConfig(key, rawValue, adminId) {
  const value = parseFloat(rawValue);
  if (!(key in creditConfigRepository.DEFAULTS)) throw new HttpError(404, 'Chiave di configurazione sconosciuta.');
  if (!Number.isFinite(value) || value < 0) {
    throw new HttpError(400, 'Valore non valido: deve essere un numero maggiore o uguale a 0.');
  }
  await creditConfigRepository.set(key, value, adminId);
  return { success: true, key, value };
}

/** Runs the (normally nightly) sale/purchase bonus maturation now. */
function matureNow() {
  return processMaturedGrants();
}

/** Grants held by a daily/monthly cap, waiting for a decision; the maturation job skips them until then. */
async function flaggedGrants() {
  return { grants: await creditBonusGrantRepository.findFlaggedGrants() };
}

/** 'approve' lifts the hold and matures the grant now; 'reject' cancels it without crediting anything. */
async function reviewGrant(id, decision) {
  if (decision !== 'approve' && decision !== 'reject') {
    throw new HttpError(400, "decision deve essere 'approve' o 'reject'.");
  }
  const result = await reviewFlaggedGrant(id, decision);
  if (!result) throw new HttpError(404, 'Grant non trovato o non più in revisione.');
  return { success: true, ...result };
}

module.exports = { ledger, config, setConfig, matureNow, flaggedGrants, reviewGrant };
