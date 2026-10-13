// Single convention for users.address_country: ISO 3166-1 alpha-2, UPPERCASE ('IT'), limited to the
// countries in client/src/config/countries.json. Before this, the column was free text, so the same
// country was stored as 'it', 'IT', 'Italia', 'ITALIA'... and anything grouping/filtering by it split.
//
// Keep in sync with client/src/lib/country.js (same JSON, same matching rules; tests/country-normalize.test.js
// checks both give identical answers).
const data = require('../../client/src/config/countries.json');

const SUPPORTED_COUNTRY_CODES = data.codes;
const NAME_LANGS = ['it', 'en', 'de', 'fr', 'es'];

// "Österreich" / "österreich " / "OSTERREICH" -> "osterreich"; "U.K." -> "u k"
function fold(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const LOOKUP = new Map();
function register(key, code) {
  const k = fold(key);
  if (k && !LOOKUP.has(k)) LOOKUP.set(k, code);
}
for (const code of SUPPORTED_COUNTRY_CODES) {
  register(code, code);
  for (const lang of NAME_LANGS) {
    const name = new Intl.DisplayNames([lang], { type: 'region' }).of(code);
    if (name) register(name, code);
  }
  for (const alias of data.aliases[code] || []) register(alias, code);
}

/** 'it' | 'IT' | 'Italia' | ' ITALY ' -> 'IT'. null for empty/unknown/unsupported input. */
function normalizeCountry(raw) {
  if (raw === null || raw === undefined) return null;
  return LOOKUP.get(fold(raw)) || null;
}

/**
 * Given [{ id, address_country }], split into what a data migration should change and what it must leave
 * alone. `changes` only has rows whose stored value differs from the canonical code (so it is idempotent:
 * a second pass over already-migrated data yields none). `unrecognized` are non-empty values we could not
 * map — never guessed, reported for a human to decide.
 */
function planCountryNormalization(rows) {
  const changes = [];
  const unrecognized = [];
  for (const { id, address_country: old } of rows) {
    if (old === null || old === undefined || String(old).trim() === '') continue;
    const code = normalizeCountry(old);
    if (!code) unrecognized.push({ id, old });
    else if (code !== old) changes.push({ id, old, code });
  }
  return { changes, unrecognized };
}

module.exports = { SUPPORTED_COUNTRY_CODES, normalizeCountry, planCountryNormalization, fold };
