// Server-side mirror of client/src/routing/localizedPaths.js. Same logic, same source JSON - duplicated
// instead of shared because the client file is an ES module (import/export) and this is CommonJS; the
// project already uses this "read the same JSON twice" pattern for client/src/config/legalPages.json.
const RAW_MAP = require('../../client/src/config/localizedRoutes.json');

const URL_LOCALES = ['it', 'en'];
const DEFAULT_URL_LOCALE = 'it';

const IT_TO_EN = Object.fromEntries(Object.entries(RAW_MAP).filter(([k]) => k !== '_comment'));
const EN_TO_IT = Object.fromEntries(Object.entries(IT_TO_EN).map(([it, en]) => [en, it]));

function compile(pattern) {
  const keys = [];
  const re = new RegExp(
    `^${pattern
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/')}$`
  );
  return { re, keys };
}

const IT_MATCHERS = Object.keys(IT_TO_EN).map((pattern) => ({ pattern, ...compile(pattern) }));

function fillParams(template, params) {
  return template
    .split('/')
    .map((seg) => {
      if (!seg.startsWith(':')) return seg;
      const value = params?.[seg.slice(1)];
      return value != null ? encodeURIComponent(value) : seg;
    })
    .join('/') || '/';
}

function matchConcretePath(canonicalPath) {
  for (const { pattern, re, keys } of IT_MATCHERS) {
    const m = canonicalPath.match(re);
    if (!m) continue;
    return { template: pattern, params: Object.fromEntries(keys.map((k, i) => [k, m[i + 1]])) };
  }
  return null;
}

/** Canonical (Italian) path -> its /it or /en URL, or null when it's not a structural page. */
function resolveLocalizedPath(canonicalPath, locale, params = {}) {
  let template = canonicalPath in IT_TO_EN ? canonicalPath : null;
  let effectiveParams = params;
  if (template == null) {
    const match = matchConcretePath(canonicalPath);
    if (match) {
      template = match.template;
      effectiveParams = { ...match.params, ...params };
    }
  }
  if (template == null) return null;
  const resolvedTemplate = locale === 'en' ? IT_TO_EN[template] : template;
  const filled = fillParams(resolvedTemplate, effectiveParams);
  return `/${locale}${filled === '/' ? '' : filled}`;
}

/** Fills a matched route's canonical template (e.g. ".../pokemon/:espansione") with its real params. */
function fillCanonicalPath(canonicalTemplate, params) {
  return fillParams(canonicalTemplate, params);
}

/** A full pathname ("/en/listings/lego") -> { locale, canonicalPath, params }, or null. */
function matchLocalizedRoute(pathname) {
  const clean = String(pathname || '/').replace(/\/+$/, '') || '/';
  const [, locale, ...rest] = clean.split('/');
  if (!URL_LOCALES.includes(locale)) return null;
  const remainder = `/${rest.join('/')}`.replace(/\/$/, '') || '/';

  const candidates = locale === 'en' ? Object.keys(EN_TO_IT).map((p) => ({ pattern: p, ...compile(p) })) : IT_MATCHERS;
  for (const { pattern, re, keys } of candidates) {
    const m = remainder.match(re);
    if (!m) continue;
    const params = Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const canonicalPath = locale === 'en' ? EN_TO_IT[pattern] : pattern;
    return { locale, canonicalPath, params };
  }
  return null;
}

const isStructuralPath = (canonicalPath) => canonicalPath in IT_TO_EN;

module.exports = { URL_LOCALES, DEFAULT_URL_LOCALE, resolveLocalizedPath, matchLocalizedRoute, fillCanonicalPath, isStructuralPath };
