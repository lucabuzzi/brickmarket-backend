// Unknown URLs and missing listings must answer HTTP 404 (not 200), without ever turning a real page into a 404.
// The database module is mocked, so nothing here can reach a real DB.
jest.mock('../src/db', () => ({ query: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');
const { query } = require('../src/db');
const { KNOWN_ROUTES, isKnownRoute } = require('../src/services/knownRoutes');
const { renderPage, renderIndexHtmlForRequest } = require('../src/services/seoMeta');
const { createSpaFallback } = require('../src/routes/spaFallback');
const { STATIC_PATHS } = require('../src/routes/sitemap');

const APP_JSX = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'App.jsx'), 'utf8');
const TEMPLATE = '<!doctype html><html lang="it"><head><title>x</title><link rel="canonical" href="https://cardbrix.com/"><meta name="description" content="d"></head><body><div id="root"></div></body></html>';
const LISTING = { id: 'abc', title: 'Il mio set', description: 'Bello', price: '10', type: 'used', status: 'active', images: [], condition: 'new', product_type: 'lego' };

// what the client declares, without the catch-all
const clientPaths = [...new Set([...APP_JSX.matchAll(/path="([^"]*)"/g)].map((m) => m[1]))].filter((p) => p !== '*');

describe('knownRoutes stays in sync with client/src/App.jsx', () => {
  test('the client has a catch-all route that renders the not-found page', () => {
    expect(APP_JSX).toMatch(/<Route path="\*" element=\{<NotFound \/>\} \/>/);
  });

  test('every route the client declares is known to the server (else a real page would 404)', () => {
    const missing = clientPaths.filter((p) => !isKnownRoute(`/${p.replace(/:[^/]+/g, 'x')}`));
    expect(missing).toEqual([]);
  });

  test('every route the server lists still exists in the client (else it would keep hiding 404s)', () => {
    const stale = KNOWN_ROUTES.filter((r) => r !== '' && !clientPaths.includes(r));
    expect(stale).toEqual([]);
  });

  test('every page listed in the sitemap is a known route', () => {
    expect(STATIC_PATHS.filter((p) => !isKnownRoute(p))).toEqual([]);
  });
});

describe('isKnownRoute', () => {
  test('real pages, with params, nesting, case and trailing slash', () => {
    for (const p of ['/', '', '/annunci', '/Annunci/', '/aste/carte-collezionabili/pokemon', '/aste/carte-collezionabili/qualunque', '/catalog/lego/75192-UCS',
      '/catalog/pokemon/xy1-1', '/catalog/funko/search', '/product/6d877847-dbaa-47c9-a046-2806c7fdff7b', '/user/mario_rossi', '/admin/users/42', '/crediti/acquista']) {
      expect([p, isKnownRoute(p)]).toEqual([p, true]);
    }
  });

  test('invented URLs, bot probes, files and wrong nesting', () => {
    for (const p of ['/pagina-che-non-esiste', '/wp-login.php', '/.env', '/favicon.ico', '/annunci/inventato', '/annunci/carte-collezionabili/x/y', '/product', '/product/a/b',
      '/admin/inventato', '/aste/lego/extra', '/catalog/pokemon/a/b', '/skill-zone/x', '/login/x']) {
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

  test('known routes: 200 and indexable', async () => {
    for (const p of ['/', '/annunci', '/skill-zone', '/catalog/lego/10280-1']) {
      const r = await renderPage(p, TEMPLATE);
      expect([p, r.status]).toEqual([p, 200]);
      expect(r.html).not.toContain('noindex');
    }
  });

  test('listing that exists: 200 with its data', async () => {
    query.mockResolvedValueOnce({ rows: [LISTING] });
    const r = await renderPage('/product/abc', TEMPLATE);
    expect(r.status).toBe(200);
    expect(r.html).toContain('<title>Il mio set | CardBrix</title>');
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
    expect(typeof (await renderIndexHtmlForRequest('/faq', TEMPLATE))).toBe('string');
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
    const ok = await get('/annunci/lego');
    expect(ok.status).toBe(200);
    expect(ok.type).toMatch(/^text\/html/);
    expect(ok.body).toContain('<div id="root">');

    const nf = await get('/pagina-che-non-esiste');
    expect(nf.status).toBe(404);
    expect(nf.type).toMatch(/^text\/html/);
    expect(nf.body).toContain('<div id="root">'); // the client still boots and shows its own not-found page
  }));

  test('HEAD requests get the same status (crawlers use them)', () => withApp(createSpaFallback(dist), async (get) => {
    expect((await get('/faq', 'HEAD')).status).toBe(200);
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
