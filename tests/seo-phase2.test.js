// Tests for the AEO/SEO additions: Product + BreadcrumbList JSON-LD, llms.txt, IndexNow, sitemap images.
// The database module is mocked, so nothing here can reach a real DB (see tests/guard-against-production.test.js).
jest.mock('../src/db', () => ({ query: jest.fn() }));

const http = require('http');
const express = require('express');
const { query } = require('../src/db');
const { buildProductJsonLd, breadcrumbForListing, brandFor, conditionUrl } = require('../src/services/seoJsonLd');
const { buildLlmsTxt, buildLlmsFullTxt } = require('../src/services/llmsTxt');
const indexnow = require('../src/services/indexnow');

const BASE = 'https://cardbrix.com';

const listing = (over = {}) => ({
  id: 'abc-123', title: 'LEGO Icons Fiori', type: 'used', status: 'active', condition: 'new', product_type: 'lego',
  game: null, set_number: '10280', price: '45.5', current_bid: null, auction_start: null, auction_end: null, images: ['/uploads/a.webp'], ...over,
});

async function withServer(router, fn) {
  const app = express();
  app.use(router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

describe('seoJsonLd', () => {
  test('LEGO fixed-price listing: brand, sku/mpn from set number, condition, seller', () => {
    const p = buildProductJsonLd({ listing: listing(), canonical: `${BASE}/product/abc-123`, images: [`${BASE}/uploads/a.webp`], description: 'd', effectivePrice: '45.5' });
    expect(p['@type']).toBe('Product');
    expect(p.brand).toEqual({ '@type': 'Brand', name: 'LEGO' });
    expect(p.sku).toBe('10280');
    expect(p.mpn).toBe('10280');
    expect(p.image).toBe(`${BASE}/uploads/a.webp`); // single image stays a string
    expect(p.offers).toMatchObject({ price: '45.50', priceCurrency: 'EUR', availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition', seller: { name: 'CardBrix' } });
    expect(p.offers.priceValidUntil).toBeUndefined();
  });

  test('falls back to a stable sku, lists several images, marks sold listings', () => {
    const p = buildProductJsonLd({ listing: listing({ set_number: null, status: 'sold' }), canonical: 'c', images: ['a', 'b'], description: 'd', effectivePrice: 1 });
    expect(p.sku).toBe('cardbrix-abc-123');
    expect(p.mpn).toBeUndefined();
    expect(p.image).toEqual(['a', 'b']);
    expect(p.offers.availability).toBe('https://schema.org/SoldOut');
  });

  test('active auction: price is the current bid and the offer expires when the auction ends', () => {
    const p = buildProductJsonLd({ listing: listing({ type: 'auction', auction_end: '2026-10-01T18:00:00Z' }), canonical: 'c', images: ['a'], description: 'd', effectivePrice: 12 });
    expect(p.offers.price).toBe('12.00');
    expect(p.offers.priceValidUntil).toBe('2026-10-01');
    const ended = buildProductJsonLd({ listing: listing({ type: 'auction', status: 'ended', auction_end: '2026-10-01T18:00:00Z' }), canonical: 'c', images: ['a'], description: 'd', effectivePrice: 12 });
    expect(ended.offers.priceValidUntil).toBeUndefined();
  });

  test('brand and condition mapping', () => {
    expect(brandFor({ product_type: 'funko' })).toBe('Funko');
    expect(brandFor({ product_type: 'tcg', game: 'pokemon' })).toBe('Pokémon');
    expect(brandFor({ product_type: 'tcg', game: 'boh' })).toBeNull();
    expect(brandFor({ product_type: 'other' })).toBeNull();
    expect([conditionUrl('new'), conditionUrl('Like New'), conditionUrl('used'), conditionUrl('damaged'), conditionUrl(null)]).toEqual([
      'https://schema.org/NewCondition', 'https://schema.org/UsedCondition', 'https://schema.org/UsedCondition', 'https://schema.org/DamagedCondition', null,
    ]);
    const missing = buildProductJsonLd({ listing: listing({ condition: null, product_type: 'x' }), canonical: 'c', images: ['a'], description: 'd', effectivePrice: 1 });
    expect(JSON.parse(JSON.stringify(missing)).brand).toBeUndefined(); // undefined fields never reach the page
    expect(JSON.parse(JSON.stringify(missing)).offers.itemCondition).toBeUndefined();
  });

  test('breadcrumbs follow the real client routes; the last crumb has no link', () => {
    const b = breadcrumbForListing(listing({ product_type: 'tcg', game: 'magic', title: 'Black Lotus' }), BASE);
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement.map((i) => i.name)).toEqual(['CardBrix', 'Annunci', 'Carte collezionabili', 'Magic: The Gathering', 'Black Lotus']);
    expect(b.itemListElement[3].item).toBe(`${BASE}/annunci/carte-collezionabili/magic`);
    expect(b.itemListElement[4].item).toBeUndefined();
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2, 3, 4, 5]);
    const auction = breadcrumbForListing(listing({ type: 'auction' }), BASE);
    expect(auction.itemListElement[1]).toMatchObject({ name: 'Aste', item: `${BASE}/aste` });
    expect(auction.itemListElement[2].item).toBe(`${BASE}/aste/lego`);
  });
});

describe('llms.txt', () => {
  test('follows the llms.txt format: H1, summary blockquote, sections with absolute links', () => {
    const t = buildLlmsTxt({ baseUrl: BASE });
    expect(t.startsWith('# CardBrix\n\n> ')).toBe(true);
    expect(t).toMatch(/\n## Sezioni principali\n- \[Annunci\]\(https:\/\/cardbrix\.com\/annunci\)/);
    expect(t).toContain(`(${BASE}/annunci/carte-collezionabili/pokemon)`);
    expect(t).toContain(`(${BASE}/sitemap.xml)`);
    expect(t).not.toMatch(/href=|<[a-z]/i); // markdown only
  });

  test('says nothing about credits, money conversion or legal promises', () => {
    const t = buildLlmsFullTxt({ baseUrl: BASE, listings: [{ id: 1, title: 'x', type: 'used', price: 1 }] }).toLowerCase();
    for (const banned of ['credit', 'crediti', 'rimbors', 'garanz', 'gratis']) expect(t).not.toContain(banned);
  });

  test('full version lists recent listings with formatted prices and no self-link', () => {
    const t = buildLlmsFullTxt({ baseUrl: BASE, listings: [
      { id: 'a', title: 'Set A', type: 'used', price: '12.5' },
      { id: 'b', title: 'Asta B', type: 'auction', current_bid: '30', auction_start: '10' },
      { id: 'c', title: 'Senza prezzo', type: 'auction', current_bid: null, auction_start: null },
    ] });
    expect(t).toContain(`- [Set A](${BASE}/product/a): annuncio, 12,50 €`);
    expect(t).toContain(`- [Asta B](${BASE}/product/b): asta, 30,00 €`);
    expect(t).toContain(`- [Senza prezzo](${BASE}/product/c): asta\n`);
    expect(t).not.toContain('llms-full.txt');
    expect(buildLlmsFullTxt({ baseUrl: BASE })).not.toContain('## Annunci recenti');
  });
});

describe('indexnow service', () => {
  const KEY = 'abcdef1234567890';

  test('getKey accepts only valid keys', () => {
    expect(indexnow.getKey({ INDEXNOW_KEY: KEY })).toBe(KEY);
    for (const bad of [undefined, '', 'short', 'has space in it!', 'x'.repeat(129)]) expect(indexnow.getKey({ INDEXNOW_KEY: bad })).toBeNull();
  });

  test('is inert without a key: no request is made', async () => {
    const fetchImpl = jest.fn();
    expect(await indexnow.submitUrls([`${BASE}/product/1`], { env: {}, fetchImpl })).toEqual({ submitted: 0, skipped: 'no-key' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('posts the documented IndexNow payload, dedupes, and drops off-site URLs', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ status: 200 });
    const r = await indexnow.submitUrls([`${BASE}/product/1`, `${BASE}/product/1`, 'https://evil.example/x', 'not a url'], { env: { INDEXNOW_KEY: KEY }, fetchImpl });
    expect(r).toEqual({ submitted: 1, status: 200 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.indexnow.org/indexnow');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ host: 'cardbrix.com', key: KEY, keyLocation: `${BASE}/${KEY}.txt`, urlList: [`${BASE}/product/1`] });
  });

  test('never throws: network errors and bad statuses are swallowed', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const env = { INDEXNOW_KEY: KEY };
    expect((await indexnow.submitUrls([`${BASE}/a`], { env, fetchImpl: jest.fn().mockRejectedValue(new Error('boom')) })).error).toBe('boom');
    expect((await indexnow.submitUrls([`${BASE}/a`], { env, fetchImpl: jest.fn().mockResolvedValue({ status: 429 }) })).status).toBe(429);
    expect(await indexnow.submitUrls(['https://other.example/a'], { env, fetchImpl: jest.fn() })).toEqual({ submitted: 0, skipped: 'no-urls' });
    warn.mockRestore();
  });

  test('notifyListingChanged is fire-and-forget and targets the listing page', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ status: 202 });
    expect(indexnow.notifyListingChanged('xyz', { env: { INDEXNOW_KEY: KEY }, fetchImpl })).toBeUndefined();
    await new Promise((r) => setImmediate(r));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).urlList).toEqual([`${BASE}/product/xyz`]);
  });
});

describe('seoFiles routes', () => {
  const router = () => { jest.resetModules(); jest.doMock('../src/db', () => ({ query })); return require('../src/routes/seoFiles'); };
  afterEach(() => { delete process.env.INDEXNOW_KEY; query.mockReset(); });

  test('GET /llms.txt is plain text, cacheable, and does not touch the database', async () => {
    await withServer(router(), async (url) => {
      const r = await fetch(`${url}/llms.txt`);
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toMatch(/^text\/plain/);
      expect(r.headers.get('cache-control')).toMatch(/max-age=3600/);
      expect((await r.text()).startsWith('# CardBrix')).toBe(true);
    });
    expect(query).not.toHaveBeenCalled();
  });

  test('GET /llms-full.txt includes active listings, and still answers when the DB fails', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 7, title: 'Pezzo raro', type: 'used', price: '9', current_bid: null, auction_start: null }] });
    await withServer(router(), async (url) => {
      expect(await (await fetch(`${url}/llms-full.txt`)).text()).toContain('[Pezzo raro](https://cardbrix.com/product/7)');
      const err = jest.spyOn(console, 'error').mockImplementation(() => {});
      query.mockRejectedValueOnce(new Error('db down'));
      const r = await fetch(`${url}/llms-full.txt`);
      expect(r.status).toBe(200);
      expect(await r.text()).toContain('# CardBrix');
      err.mockRestore();
    });
    expect(query.mock.calls[0][0]).toMatch(/status = 'active'/);
  });

  test('IndexNow key file: served only when it matches INDEXNOW_KEY, otherwise falls through', async () => {
    process.env.INDEXNOW_KEY = 'abcdef1234567890';
    const r = router();
    const app = express();
    app.use(r);
    app.use((req, res) => res.status(404).send('next'));
    const server = http.createServer(app);
    await new Promise((ok) => server.listen(0, ok));
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
      const good = await fetch(`${url}/abcdef1234567890.txt`);
      expect(good.status).toBe(200);
      expect((await good.text()).trim()).toBe('abcdef1234567890');
      expect((await fetch(`${url}/otherkey12345678.txt`)).status).toBe(404);
      expect((await fetch(`${url}/short.txt`)).status).toBe(404);
      delete process.env.INDEXNOW_KEY;
      expect((await fetch(`${url}/abcdef1234567890.txt`)).status).toBe(404); // no key configured -> inert
    } finally {
      await new Promise((ok) => server.close(ok));
    }
  });
});

describe('seoMeta and sitemap integration', () => {
  const load = () => { jest.resetModules(); jest.doMock('../src/db', () => ({ query })); return { seoMeta: require('../src/services/seoMeta'), sitemap: require('../src/routes/sitemap') }; };
  const template = '<html><head><title>x</title><link rel="canonical" href="https://cardbrix.com/"></head><body></body></html>';
  afterEach(() => query.mockReset());

  test('product page gets Product + BreadcrumbList JSON-LD with all listing images', async () => {
    query.mockResolvedValueOnce({ rows: [listing({ images: ['/uploads/a.webp', 'https://res.cloudinary.com/x/b.jpg'] })] });
    const html = await load().seoMeta.renderIndexHtmlForRequest('/product/abc-123', template);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    expect(blocks.map((b) => b['@type'])).toEqual(['Product', 'BreadcrumbList']);
    expect(blocks[0].image).toEqual(['https://cardbrix.com/uploads/a.webp', 'https://res.cloudinary.com/x/b.jpg']);
    expect(blocks[0].brand.name).toBe('LEGO');
    expect(query.mock.calls[0][0]).toMatch(/condition, product_type, game, set_number/);
  });

  test('unknown listing keeps the generic page without structured data', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const html = await load().seoMeta.renderIndexHtmlForRequest('/product/nope', template);
    expect(html).not.toContain('application/ld+json');
  });

  test('sitemap.xml declares the image namespace and lists up to 3 images per listing', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, updated_at: '2026-09-01', images: ['/uploads/1.webp', '/uploads/2.webp', '/uploads/3.webp', '/uploads/4.webp'] }, { id: 2, updated_at: '2026-09-02', images: null }] });
    await withServer(load().sitemap, async (url) => {
      const xml = await (await fetch(`${url}/sitemap.xml`)).text();
      expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
      const first = xml.match(/<url><loc>https:\/\/cardbrix\.com\/product\/1<\/loc>.*?<\/url>/)[0];
      expect((first.match(/<image:loc>/g) || []).length).toBe(3);
      expect(first).toContain('<image:loc>https://cardbrix.com/uploads/1.webp</image:loc>');
      const second = xml.match(/<url><loc>https:\/\/cardbrix\.com\/product\/2<\/loc>.*?<\/url>/)[0];
      expect(second).not.toContain('image:image');
      expect(xml).toContain('<loc>https://cardbrix.com/annunci</loc></url>'); // static pages: no invented lastmod
    });
  });
});
