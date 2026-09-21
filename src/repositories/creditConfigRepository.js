const db = require('../db/clutchvault-db');

// Fallback usato solo se la tabella credit_config non è ancora raggiungibile (mock DB
// locale senza Postgres, o migrazione non ancora eseguita in questo ambiente) — non è
// il valore "vero": quello vive nel DB e va tarato dall'admin. Vedi
// src/db/migrate_credit_config.js per la semantica di ogni chiave.
const DEFAULTS = {
  signup_bonus: 5.00,
  referral_bonus: 5.00,
  sale_bonus: 5.00,
  purchase_bonus: 5.00,
  maturation_days: 15,
  min_order_amount: 5.00,
  daily_bonus_cap_per_user: 20.00,
  monthly_bonus_cap_per_user: 60.00,
  monthly_bonus_cap_per_pair: 15.00,
};

async function getAll() {
  let rows = [];
  try {
    const result = await db.query('SELECT key, value, description, updated_at FROM public.credit_config ORDER BY key');
    rows = result.rows || [];
  } catch (err) {
    console.error('creditConfigRepository.getAll: falling back to in-code defaults —', err.message);
  }

  const byKey = new Map(rows.map((r) => [r.key, r]));
  return Object.keys(DEFAULTS).map((key) => {
    const row = byKey.get(key);
    return {
      key,
      value: row ? parseFloat(row.value) : DEFAULTS[key],
      description: row?.description || null,
      updatedAt: row?.updated_at || null,
      isDefault: !row,
    };
  });
}

async function get(key) {
  if (!(key in DEFAULTS)) {
    throw new Error(`Unknown credit_config key: ${key}`);
  }
  try {
    const result = await db.query('SELECT value FROM public.credit_config WHERE key = $1', [key]);
    if (result.rows[0]) return parseFloat(result.rows[0].value);
  } catch (err) {
    console.error(`creditConfigRepository.get(${key}): falling back to in-code default —`, err.message);
  }
  return DEFAULTS[key];
}

async function set(key, value, updatedBy) {
  if (!(key in DEFAULTS)) {
    throw new Error(`Unknown credit_config key: ${key}`);
  }
  await db.query(
    `INSERT INTO public.credit_config (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = now()`,
    [key, value, updatedBy]
  );
}

module.exports = { getAll, get, set, DEFAULTS };
