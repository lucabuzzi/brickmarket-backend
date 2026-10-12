// Resolves between the canonical (Italian) path every page/component/link in the app already uses and
// the locale-prefixed URL a visitor actually sees (/it/... or /en/...). Only the structural/marketing
// pages listed in client/src/config/localizedRoutes.json get a translated URL; everything else (product
// pages, account, admin, ...) is simply not in that map and is left untouched by every function here.
import RAW_MAP from '../config/localizedRoutes.json';

export const URL_LOCALES = ['it', 'en'];
export const DEFAULT_URL_LOCALE = 'it';

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

/**
 * Fills `:param` segments of a path template with real values. A param with no value in `params` is left
 * as the literal ":name" placeholder instead of becoming an empty segment — that's what lets this same
 * function build both a real navigation target (params given) and a static route pattern for <Route path>
 * (no params given, e.g. when App.jsx generates the /it and /en route tables from this file).
 */
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

/**
 * Matches a concrete canonical path (e.g. "/annunci/carte-collezionabili/pokemon/sv-01", param already
 * filled in) against the IT route templates, returning the template plus the extracted params - so a
 * caller with a real value in hand (not a ":espansione" placeholder) can still resolve it.
 */
function matchConcretePath(canonicalPath) {
  for (const { pattern, re, keys } of IT_MATCHERS) {
    const m = canonicalPath.match(re);
    if (!m) continue;
    return { template: pattern, params: Object.fromEntries(keys.map((k, i) => [k, m[i + 1]])) };
  }
  return null;
}

/**
 * The canonical (Italian) path -> its URL for `locale` ('it' keeps the Italian words, 'en' translates
 * them), with a leading /it or /en. Returns null when `canonicalPath` is not a structural page (the
 * caller should use the canonical path itself, unprefixed, as today). `canonicalPath` may be a literal
 * template (with ":param" placeholders, filled from `params`) or a concrete path with real values
 * already in it (e.g. built from `${base}/${slug}`) - both resolve the same way.
 */
export function resolveLocalizedPath(canonicalPath, locale, params = {}) {
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

/**
 * A full pathname (e.g. "/en/listings/lego") -> { locale, canonicalPath, params }, or null when it is
 * not under /it/ or /en/, or matches no structural page. `canonicalPath` is always the Italian path the
 * rest of the app (knownRoutes, pageMeta, the <Route> elements themselves) already matches on.
 */
export function matchLocalizedRoute(pathname) {
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

/** For the language switcher: where to send the visitor when they pick `targetLocale` from `currentPathname`. */
export function buildLocaleHref(targetLocale, currentPathname) {
  const match = matchLocalizedRoute(currentPathname);
  if (!match) return null; // not on a structural page: caller falls back to an in-place language change
  return resolveLocalizedPath(match.canonicalPath, targetLocale, match.params);
}

export const isStructuralPath = (canonicalPath) => canonicalPath in IT_TO_EN;
