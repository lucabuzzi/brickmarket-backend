// Italian UI copy for the server-rendered shell, read from the SAME file the React app uses
// (client/src/locales/it.json), so the words a crawler sees are the words a visitor sees and there is
// no second copy to keep in sync. If the file cannot be read (e.g. a deploy without client/src) every
// lookup returns '' and callers degrade to a smaller page instead of failing.
let IT = null;

function load() {
  if (IT) return IT;
  try {
    IT = require('../../../client/src/locales/it.json');
  } catch (err) {
    console.error('seoContent: locale it.json non leggibile:', err.message);
    IT = {};
  }
  return IT;
}

/** t('landing.hero.subtitle') / t('annunci.subtitle', { title: 'LEGO' }); '' when missing. */
function t(key, vars = {}) {
  let node = load();
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return '';
    node = node[part];
  }
  if (typeof node !== 'string') return '';
  return node.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name) => (vars[name] != null ? String(vars[name]) : m));
}

const has = (key) => t(key) !== '';

/** Test hook: replace the locale data (or reset with null). */
function _setLocaleForTests(data) {
  IT = data;
}

module.exports = { t, has, _setLocaleForTests };
