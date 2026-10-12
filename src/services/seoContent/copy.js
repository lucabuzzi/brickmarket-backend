// UI copy for the server-rendered shell, read from the SAME files the React app uses
// (client/src/locales/{it,en}.json), so the words a crawler sees are the words a visitor sees and there
// is no second copy to keep in sync. If a file cannot be read (e.g. a deploy without client/src) every
// lookup returns '' and callers degrade to a smaller page instead of failing.
const CACHE = { it: null, en: null };

function load(locale) {
  const key = locale === 'en' ? 'en' : 'it';
  if (CACHE[key]) return CACHE[key];
  try {
    CACHE[key] = require(`../../../client/src/locales/${key}.json`);
  } catch (err) {
    console.error(`seoContent: locale ${key}.json non leggibile:`, err.message);
    CACHE[key] = {};
  }
  return CACHE[key];
}

/** t('landing.hero.subtitle') / t('annunci.subtitle', { title: 'LEGO' }, 'en'); '' when missing. */
function t(key, vars = {}, locale = 'it') {
  let node = load(locale);
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return '';
    node = node[part];
  }
  if (typeof node !== 'string') return '';
  return node.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) => (vars[name] != null ? String(vars[name]) : m));
}

const has = (key, locale = 'it') => t(key, {}, locale) !== '';

/** Test hook: replace the locale data (or reset with null) for one locale ('it' by default). */
function _setLocaleForTests(data, locale = 'it') {
  CACHE[locale === 'en' ? 'en' : 'it'] = data;
}

module.exports = { t, has, _setLocaleForTests };
