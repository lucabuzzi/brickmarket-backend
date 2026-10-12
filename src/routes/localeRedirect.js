// 301-redirects the legacy, unprefixed URL of a structural page (old bookmarks and links, e.g. "/annunci/lego",
// or bare "/") to its real /it/... or /en/... URL (see client/src/config/localizedRoutes.json), chosen from
// the request's Accept-Language. Without this, the same page would answer at two URLs - the old bare one and
// the new prefixed one - which is duplicate content for a crawler instead of one canonical page per language.
// Anything that is not a structural page (dynamic pages, /api, /uploads, an already-prefixed URL, a static
// asset) resolves to null and passes straight through to the next handler (express.static, the SPA fallback).
const { resolveLocalizedPath, DEFAULT_URL_LOCALE } = require('../services/localizedRoutes');

/** 'en' only when the browser's first real language preference is English; everything else stays the default (it). */
function preferredLocale(acceptLanguage) {
  const first = String(acceptLanguage || '').split(',')[0].trim().slice(0, 2).toLowerCase();
  return first === 'en' ? 'en' : DEFAULT_URL_LOCALE;
}

function localeRedirect(req, res, next) {
  const locale = preferredLocale(req.headers['accept-language']);
  const target = resolveLocalizedPath(req.path, locale);
  if (!target) return next();
  const qs = req.url.slice(req.path.length); // keep ?query/#hash-less search string, the path lookup above ignores it
  return res.redirect(301, `${target}${qs}`);
}

module.exports = { localeRedirect, preferredLocale };
