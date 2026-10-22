/**
 * Settings of the plaza chat moderation, edited by the admin (table game_chat_settings, one JSON value per key).
 * Pure: the defaults (used until the admin changes a value, or when the database cannot be read) and the validation
 * of a new value. A key missing from DEFAULTS is refused, so the admin panel cannot invent settings.
 */

const DEFAULTS = Object.freeze({
  free_text_enabled: false, // typed messages in the plaza; off = only the fixed phrases and emojis, as before
  ai_enabled: true, // layer 2 (aiModerator.js); off = only the fixed rules
  max_length: 140,
  strike_threshold: 3, // blocked messages...
  strike_window_minutes: 10, // ...within this window...
  mute_minutes: 15, // ...mute the player this long
  custom_rules: [], // the admin's own rules for the AI, one sentence each
  log_retention_days: 30, // blocked messages are kept this long for the admin, then deleted
  ai_daily_limit: 5000, // AI checks per day for the whole site; beyond, typed messages wait for the next day
});

const INT_RANGES = {
  max_length: [10, 500],
  strike_threshold: [1, 50],
  strike_window_minutes: [1, 1440],
  mute_minutes: [1, 10080],
  log_retention_days: [1, 365],
  ai_daily_limit: [0, 1000000],
};
const MAX_RULES = 30;
const MAX_RULE_LENGTH = 300;

/** A value for `key` -> the clean value; throws Error (message for the admin) when it is not acceptable. */
function validate(key, value) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) throw new Error(`Impostazione sconosciuta: ${key}`);
  if (typeof DEFAULTS[key] === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(`${key} deve essere vero o falso.`);
    return value;
  }
  if (INT_RANGES[key]) {
    const [min, max] = INT_RANGES[key];
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} deve essere un numero intero tra ${min} e ${max}.`);
    return value;
  }
  if (key === 'custom_rules') {
    if (!Array.isArray(value)) throw new Error('Le regole devono essere un elenco.');
    const rules = value.map((r) => (typeof r === 'string' ? r.trim().replace(/\s+/g, ' ') : '')).filter(Boolean);
    if (rules.length > MAX_RULES) throw new Error(`Al massimo ${MAX_RULES} regole.`);
    if (rules.some((r) => r.length > MAX_RULE_LENGTH)) throw new Error(`Ogni regola al massimo ${MAX_RULE_LENGTH} caratteri.`);
    return rules;
  }
  throw new Error(`Impostazione non modificabile: ${key}`);
}

/** Stored rows ({ key, value }) over the defaults; a stored value that is no longer valid falls back to the default. */
function merge(rows = []) {
  const out = { ...DEFAULTS, custom_rules: [...DEFAULTS.custom_rules] };
  for (const { key, value } of rows) {
    try { out[key] = validate(key, value); } catch { /* unknown or invalid: keep the default */ }
  }
  return out;
}

module.exports = { DEFAULTS, validate, merge, INT_RANGES };
