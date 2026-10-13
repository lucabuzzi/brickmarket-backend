// Frontend twin of src/utils/country.js — keep the matching rules identical (same JSON file, and
// tests/country-normalize.test.js asserts both answer the same). Convention: users.address_country is an
// ISO alpha-2 code, UPPERCASE; flags (`fi fi-xx`) want it lowercase.
import data from '../config/countries.json';

export const SUPPORTED_COUNTRY_CODES = data.codes;
const NAME_LANGS = ['it', 'en', 'de', 'fr', 'es'];

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
export function normalizeCountry(raw) {
  if (raw === null || raw === undefined) return null;
  return LOOKUP.get(fold(raw)) || null;
}

/** Localized country name for an ISO code (falls back to the code itself). */
export function countryName(code, lang = 'it') {
  if (!code) return '';
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

/** [{ code, name }] for <select> options, sorted by localized name. */
export function countryOptions(lang = 'it') {
  return SUPPORTED_COUNTRY_CODES
    .map((code) => ({ code, name: countryName(code, lang) }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

/** CSS class for the flag-icons sprite, or '' if there is no valid country. */
export function flagClass(code) {
  const c = normalizeCountry(code);
  return c ? `fi fi-${c.toLowerCase()}` : '';
}
