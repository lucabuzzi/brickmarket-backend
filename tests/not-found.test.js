// Unknown URLs and missing listings must answer HTTP 404 (not 200), without ever turning a real page into a 404.
// The database module is mocked, so nothing here can reach a real DB.
jest.mock('../src/db', () => ({ query: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');
const { query } = require('../src/db');
const { KNOWN_ROUTES, isKnownRoute, UNPUBLISHED } = require('../src/services/knownRoutes');
const { renderPage, renderIndexHtmlForRequest } = require('../src/services/seoMeta');
const { createSpaFallback } = require('../src/routes/spaFallback');
const { STATIC_PATHS } = require('../src/routes/sitemap');
const LOCALIZED_ROUTES = require('../client/src/config/localizedRoutes.json');

const APP_JSX = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'App.jsx'), 'utf8');
const TEMPLATE = '<!doctype html><html lang="it"><head><title>x</title><link rel="canonical" href="https://cardbrix.com/"><meta name="description" content="d"><meta property="og:locale" content="it_IT"></head><body><div id="root"></div></body></html>';
const LISTING = { id: 'abc', title: 'Il mio set', description: 'Bello', price: '10', type: 'used', status: 'active', images: [], condition: 'new', product_type: 'lego' };

// what the client declares as a literal path="..." string, without the catch-all
const clientPaths = [...new Set([...APP_JSX.matchAll(/path="([^"]*)"/g)].map((m) => m[1]))].filter((p) => p !== '*');

// Structural/marketing pages (home, annunci/aste hubs, catalog hub, info/legal pages) are generated in
// App.jsx from STRUCTURAL_ROUTES.map(...), not written as literal path="..." JSX strings, so they never
// show up in `clientPaths` above. Derive their /it and /en paths from the same registry App.jsx reads
// (client/src/config/localizedRoutes.json) instead.
const structuralEntries = Object.entries(LOCALIZED_ROUTES).filter(([k]) => k !== '_comment' && k !== '/');
const structuralClientPaths = ['it', 'en', ...structuralEntries.flatMap(([itPath, enPath]) => [`it${itPath}`, `en${enPath}`])];
const allClientPaths = [...new Set([...clientPaths, ...structuralClientPaths])];

// the { it: '...' } keys of App.jsx's own STRUCTURAL_ROUTES array
const appStructuralItPaths = [...APP_JSX.matchAll(/\{ it: '([^']+)'/g)].map((m) => m[1]);
const registryItPaths = structuralEntries.map(([itPath]) => itPath.slice(1));

describe('knownRoutes stays in sync with client/src/App.jsx', () => {
  test('the client has a catch-all route that renders the not-found page', () => {
    expect(APP_JSX).toMatch(/<Route path="\*" element=\{<NotFound \/>\} \/>/);
  });

  test('every structural page App.jsx wires up matches an entry in localizedRoutes.json', () => {
    expect(appStructuralItPaths.filter((p) => !registryItPaths.includes(p))).toEqual([]);
  });

  test('every structural page in localizedRoutes.json is wired into App.jsx', () => {
    expect(registryItPaths.filter((p) => !appStructuralItPaths.includes(p))).toEqual([]);
  });

  test('every route the client declares is known to the server (else a real page would 404)', () => {
    // pages whose flag is still off (legalPages.json) stay listed but answer 404 on purpose, so check the list itself for them
    const missing = allClientPaths.filter((p) => !(UNPUBLISHED.has(p) ? KNOWN_ROUTES.includes(p) : isKnownRoute(`/${p.replace(/:[^/]+/g, 'x')}`)));
    expect(missing).toEqual([]);
  });

  test('every route the server lists still exists in the client (else it would keep hiding 404s)', () => {
    const stale = KNOWN_ROUTES.filter((r) => r !== '' && !allClientPaths.includes(r));
    expect(stale).toEqual([]);
  });

  test('every page listed in the sitemap is a known route', () => {
    expect(STATIC_PATHS.filter((p) => !isKnownRoute(p))).toEqual([]);
  });
});

describe('isKnownRoute', () => {
  test('real pages, with params, nesting, case and trailing slash', () => {
    for (const p of ['/', '', '/it/annunci', '/en/listings', '/It/Annunci/', '/it/aste/carte-collezionabili/pokemon', '/it/aste/carte-collezionabili/qualunque',
      '/catalog/lego/75192-UCS', '/catalog/pokemon/xy1-1', '/it/catalog/funko/search', '/en/catalog/funko/search',
      '/product/6d877847-dbaa-47c9-a046-2806c7fdff7b', '/user/mario_rossi', '/admin/users/42', '/crediti/acquista']) {
      expect([p, isKnownRoute(p)]).toEqual([p, true]);
    }
  });

  test('invented URLs, bot probes, files, wrong nesting and bare (unprefixed) structural pages', () => {
    for (const p of ['/pagina-che-non-esiste', '/wp-login.php', '/.env', '/favicon.ico',
      // structural pages moved under /it and /en: the old bare URL is no longer known (a redirect middleware handles it)
      '/annunci', '/aste', '/skill-zone', '/fr/annunci',
      '/it/annunci/inventato', '/it/annunci/carte-collezionabili/x/y', '/product', '/product/a/b',
      '/admin/inventato', '/it/aste/lego/extra', '/catalog/pokemon/a/b', '/it/skill-zone/x', '/login/x']) {
      expect([p, isKnownRoute(p)]).toEqual([p, false]);
    }
  });

  test('regex metacharacters in the path are inert', () => {
    expect(isKnownRoute('/a.b')).toBe(false);
    expect(isKnownRoute('/faq(.*)')).toBe(false);
    expect(isKnownRoute('/(?:x)')).toBe(false);
  });
});

describe('renderPage', () => {
  afterEach(() => query.mockReset());

  test('unknown route: 404, noindex, its own title, no DB access', async () => {
    const r = await renderPage('/una/pagina/inventata', TEMPLATE);
    expect(r.status).toBe(404);
    expect(r.html).toContain('<title>Pagina non trovata | CardBrix</title>');
    expect(r.html).toContain('<meta name="robots" content="noindex">');
    expect(query).not.toHaveBeenCalled();
  });

  test('unknown /en/ route: 404 with English text', async () => {
    const r = await renderPage('/en/una-pagina-inventata', TEMPLATE);
    expect(r.status).toBe(404);
    expect(r.html).toContain('<title>Page Not Found | CardBrix</title>');
    expect(r.html).toContain('<html lang="en">');
  });

  test('known routes: 200 and indexable, in both locales', async () => {
    for (const p of ['/', '/it/annunci', '/en/listings', '/it/skill-zone', '/catalog/lego/10280-1']) {
      const r = await renderPage(p, TEMPLATE);
      expect([p, r.status]).toEqual([p, 200]);
      expect(r.html).not.toContain('noindex');
    }
  });

  test('listing that exists: 200 with its data', async () => {
    query.mockResolvedValueOnce({ rows: [LISTING] });
    const r = await renderPage('/product/abc', TEMPLATE);
    expect(r.status).toBe(200);
    expect(r.html).toContain('<title>Il mio set – LEGO in vendita | CardBrix</title>');
  });

  test('listing that does not exist: 404', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const r = await renderPage('/product/00000000-0000-0000-0000-000000000000', TEMPLATE);
    expect(r.status).toBe(404);
    expect(r.html).toContain('noindex');
  });

  test('listing id that is not a valid uuid (Postgres 22P02): 404, not an error page', async () => {
    query.mockRejectedValueOnce(Object.assign(new Error('invalid input syntax for type uuid'), { code: '22P02' }));
    const r = await renderPage('/product/not-a-uuid', TEMPLATE);
    expect(r.status).toBe(404);
  });

  test('database failure says nothing about the listing: keep 200 with the default shell', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    query.mockRejectedValueOnce(Object.assign(new Error('connection terminated'), { code: 'ECONNRESET' }));
    const r = await renderPage('/product/abc', TEMPLATE);
    expect(r.status).toBe(200);
    expect(r.html).not.toContain('noindex');
    err.mockRestore();
  });

  test('renderIndexHtmlForRequest still returns just the HTML', async () => {
    expect(typeof (await renderIndexHtmlForRequest('/it/faq', TEMPLATE))).toBe('string');
  });
});

describe('locale-prefixed structural pages', () => {
  afterEach(() => query.mockReset());

  test('an /it/ page declares Italian lang/locale and alternates to its /en/ twin', async () => {
    const r = await renderPage('/it/annunci', TEMPLATE);
    expect(r.html).toContain('<html lang="it">');
    expect(r.html).toContain('<meta property="og:locale" content="it_IT">');
    expect(r.html).toContain('<link rel="alternate" hreflang="it" href="https://cardbrix.com/it/annunci">');
    expect(r.html).toContain('<link rel="alternate" hreflang="en" href="https://cardbrix.com/en/listings">');
    expect(r.html).toContain('<link rel="alternate" hreflang="x-default" href="https://cardbrix.com/it/annunci">');
  });

  test('its /en/ twin declares English lang/locale and alternates back to /it/', async () => {
    const r = await renderPage('/en/listings', TEMPLATE);
    expect(r.html).toContain('<html lang="en">');
    expect(r.html).toContain('<meta property="og:locale" content="en_US">');
    expect(r.html).toContain('<link rel="alternate" hreflang="it" href="https://cardbrix.com/it/annunci">');
    expect(r.html).toContain('<link rel="alternate" hreflang="en" href="https://cardbrix.com/en/listings">');
  });

  test('a non-structural route (product/:id) gets no hreflang alternates', async () => {
    query.mockResolvedValueOnce({ rows: [LISTING] });
    const r = await renderPage('/product/abc', TEMPLATE);
    expect(r.html).not.toContain('rel="alternate"');
  });
});

describe('spa fallback over HTTP', () => {
  let dist;
  beforeAll(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), 'cardbrix-dist-'));
    fs.writeFileSync(path.join(dist, 'index.html'), TEMPLATE);
  });
  afterAll(() => fs.rmSync(dist, { recursive: true, force: true }));
  afterEach(() => query.mockReset());

  // One server per test, any number of requests, closed once at the end (opening/closing several servers
  // in a row inside one test trips a libuv assertion on Windows when fetch keeps sockets alive).
  async function withApp(handler, fn) {
    const app = express();
    app.get(/^\/(?!api\/|uploads\/).*/, handler);
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    const get = async (urlPath, method = 'GET') => {
      const res = await fetch(`http://127.0.0.1:${server.address().port}${urlPath}`, { method });
      return { status: res.status, type: res.headers.get('content-type'), body: await res.text() };
    };
    try {
      await fn(get);
    } finally {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  }

  test('real page 200, invented URL 404, both HTML', () => withApp(createSpaFallback(dist), async (get) => {
    const ok = await get('/it/annunci/lego');
    expect(ok.status).toBe(200);
    expect(ok.type).toMatch(/^text\/html/);
    expect(ok.body).toContain('<div id="root">');

    const nf = await get('/pagina-che-non-esiste');
    expect(nf.status).toBe(404);
    expect(nf.type).toMatch(/^text\/html/);
    expect(nf.body).toContain('<div id="root">'); // the client still boots and shows its own not-found page
  }));

  test('HEAD requests get the same status (crawlers use them)', () => withApp(createSpaFallback(dist), async (get) => {
    expect((await get('/it/faq', 'HEAD')).status).toBe(200);
    expect((await get('/inventata', 'HEAD')).status).toBe(404);
  }));

  test('missing product 404 through the full handler', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await withApp(createSpaFallback(dist), async (get) => {
      expect((await get('/product/nope')).status).toBe(404);
    });
  });

  test('no frontend build: explicit 404 message instead of a crash', async () => {
    await withApp(createSpaFallback(path.join(dist, 'missing')), async (get) => {
      const r = await get('/');
      expect(r.status).toBe(404);
      expect(r.body).toMatch(/Frontend build not found/);
    });
  });
});
