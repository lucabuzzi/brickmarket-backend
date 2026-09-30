// Privacy + cookie policy pages, footer legal links and the accessible-name strings added with them.
// The database module is mocked, so nothing here can reach a real DB.
jest.mock('../src/db', () => ({ query: jest.fn() }));

const fs = require('fs');
const path = require('path');
const { pageFor } = require('../src/services/seoContent/pages');
const { footerNav } = require('../src/services/seoContent/layout');
const { getRouteMeta } = require('../src/services/pageMeta');
const { isKnownRoute } = require('../src/services/knownRoutes');
const { STATIC_PATHS } = require('../src/routes/sitemap');

const legalPages = require('../client/src/config/legalPages.json');

const ROOT = path.join(__dirname, '..');
const LOCALES = ['it', 'en', 'de', 'es', 'fr'];
const locale = (lang) => JSON.parse(fs.readFileSync(path.join(ROOT, 'client/src/locales', `${lang}.json`), 'utf8'));
const strip = (html) => html.replace(/<[^>]+>/g, ' ');

describe('policy pages in the server-rendered shell', () => {
  test.each([['/privacy', 13], ['/cookie-policy', 6]])('%s renders every section of the locale text', (p, sections) => {
    const d = pageFor(p);
    expect(d.h1).toBeTruthy();
    expect(d.lead).toBeTruthy();
    expect((d.body.match(/<h2>/g) || []).length).toBe(sections);
  });

  test('routes are known and have their own meta', () => {
    for (const p of ['/privacy', '/cookie-policy']) {
      expect(isKnownRoute(p)).toBe(true);
      expect(getRouteMeta(p)).toBeTruthy();
    }
  });

  test('sitemap and server footer list the pages only when legalPages.published is true', () => {
    const { published } = legalPages;
    for (const p of ['/privacy', '/cookie-policy']) {
      expect(STATIC_PATHS.includes(p)).toBe(published);
      expect(footerNav().map(([href]) => href).includes(p)).toBe(published);
    }
  });

  test('the client footer and cookie banner follow the same flag', () => {
    const layout = fs.readFileSync(path.join(ROOT, 'client/src/components/Layout.jsx'), 'utf8');
    const banner = fs.readFileSync(path.join(ROOT, 'client/src/components/CookieConsent.jsx'), 'utf8');
    expect(layout).toMatch(/legalPages\.published \? \[\['\/privacy'/);
    expect(banner).toMatch(/legalPages\.published \? '\/cookie-policy' : '\/norme-legali'/);
  });

  test('flag stays off while placeholders remain in the texts', () => {
    const it = locale('it');
    const text = JSON.stringify([it.privacy, it.cookie_policy]);
    if (/\[DA (COMPILARE|VERIFICARE)|\[DATA\]|\[EMAIL PRIVACY\]/.test(text)) expect(legalPages.published).toBe(false);
  });

  test('credit rule holds in the policy text: credits are never described as purchasable or convertible', () => {
    const forbidden = /acquist\w*\s+(?:i\s+)?crediti|compr\w*\s+(?:i\s+)?crediti|1\s*credito\s*=|credito\s*=\s*\d|crediti?\s*=\s*[\d.,]+\s*(?:€|euro)/i;
    for (const p of ['/privacy', '/cookie-policy']) {
      const d = pageFor(p);
      expect(forbidden.test(strip(`${d.h1} ${d.lead} ${d.body}`))).toBe(false);
    }
    expect(strip(pageFor('/privacy').body)).toMatch(/non sono acquistabili con denaro/);
  });

  test('every storage name the cookie policy lists is really used by the code (drift guard)', () => {
    const text = strip(pageFor('/cookie-policy').body);
    const analytics = fs.readFileSync(path.join(ROOT, 'client/src/analytics.js'), 'utf8');
    const track = fs.readFileSync(path.join(ROOT, 'src/routes/analyticsTrack.js'), 'utf8');
    const auth = fs.readFileSync(path.join(ROOT, 'client/src/api.js'), 'utf8');
    const consent = analytics.match(/CONSENT_COOKIE = '([^']+)'/)[1];
    const session = analytics.match(/SESSION_STORAGE_KEY = '([^']+)'/)[1];
    const visitor = track.match(/VISITOR_COOKIE = '([^']+)'/)[1];
    const token = auth.match(/TOKEN_STORAGE_KEY = '([^']+)'/)[1];
    for (const name of [consent, session, visitor, token]) expect(text).toContain(name);
  });
});

describe('accessible names and footer strings exist in every locale', () => {
  const A11Y = ['cart', 'cart_count', 'open_menu', 'close_menu', 'close', 'gallery_photo', 'search'];
  const FOOTER = ['nav_label', 'privacy', 'cookie_policy', 'legal_rules', 'faq', 'help', 'how_it_works', 'credits', 'manage_cookies'];

  test.each(LOCALES)('%s has all a11y.* and footer.* keys', (lang) => {
    const data = locale(lang);
    for (const k of A11Y) expect([lang, k, typeof data.a11y?.[k]]).toEqual([lang, k, 'string']);
    for (const k of FOOTER) expect([lang, k, typeof data.footer?.[k]]).toEqual([lang, k, 'string']);
  });

  test('interpolation placeholders are preserved in every translation', () => {
    for (const lang of LOCALES) {
      const { a11y } = locale(lang);
      expect(a11y.cart_count).toContain('{{count}}');
      for (const v of ['title', 'index', 'total']) expect(a11y.gallery_photo).toContain(`{{${v}}}`);
    }
  });
});
