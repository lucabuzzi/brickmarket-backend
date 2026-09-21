/**
 * Segnali di identità per l'anti-abuso (CLAUDE.md — "nessun bonus se venditore e
 * compratore condividono IP, dispositivo, metodo di pagamento o indirizzo di
 * spedizione"). Log append-only: mai il valore in chiaro, solo il suo hash SHA-256 —
 * basta per un confronto di uguaglianza, non serve né si vuole conservare il dato reale.
 *
 * Vive nel DB principale (FK su users), tramite src/db/index.js.
 */
const crypto = require('crypto');
const { query } = require('../db');

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// Normalizza uno snapshot indirizzo (sia quello di orders.shipping_address sia quello
// del profilo utente) in una stringa stabile: via/numero civico/CAP/paese, minuscolo e
// senza spazi superflui. Città e nome non entrano nel confronto (variano più spesso
// per lo stesso posto fisico, es. abbreviazioni), via+CAP+paese identifica il luogo.
function normalizeAddress({ street, houseNumber, zip, country }) {
  return [street, houseNumber, zip, country]
    .map((v) => String(v || '').trim().toLowerCase())
    .join('|');
}

async function recordSignal(userId, type, rawValue, client) {
  if (!userId || !rawValue) return;
  const db = client || { query };
  await db.query(
    'INSERT INTO public.user_identity_signals (user_id, signal_type, signal_hash) VALUES ($1, $2, $3)',
    [userId, type, hashValue(rawValue)]
  );
}

function recordAddressSignal(userId, address, client) {
  if (!address) return Promise.resolve();
  return recordSignal(userId, 'shipping_address', normalizeAddress(address), client);
}

// True se i due utenti condividono almeno un segnale (stesso tipo, stesso hash) in
// un momento qualsiasi della loro storia — registrazione, login, checkout, pagamento.
function hasSharedSignal(userIdA, userIdB, client) {
  const db = client || { query };
  return db.query(
    `SELECT 1 FROM public.user_identity_signals a
     JOIN public.user_identity_signals b ON a.signal_type = b.signal_type AND a.signal_hash = b.signal_hash
     WHERE a.user_id = $1 AND b.user_id = $2
     LIMIT 1`,
    [userIdA, userIdB]
  ).then((r) => r.rows.length > 0);
}

module.exports = { hashValue, normalizeAddress, recordSignal, recordAddressSignal, hasSharedSignal };
