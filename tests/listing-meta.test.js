// <title> / meta description for listing pages (src/services/listingMeta.js).
// The database module is mocked, so nothing here can reach a real DB.
jest.mock('../src/db', () => ({ query: jest.fn() }));

const { query } = require('../src/db');
const { buildListingTitle: title, buildListingDescription: desc, TITLE_MIN, TITLE_MAX, DESC_MIN, DESC_MAX } = require('../src/services/listingMeta');
const { descriptorFor, conditionLabel, eur } = require('../src/services/listingText');
const { renderPage } = require('../src/services/seoMeta');
const { parseHtml } = require('../scripts/seo-audit/lib/htmlParse');
const { checkPage } = require('../scripts/seo-audit/lib/pageChecks');

const BASE = 'https://cardbrix.com';
const L = (over = {}) => ({ id: 'abc', title: 'Froakie', type: 'used', status: 'active', price: '3', current_bid: null, auction_start: null, condition: 'near_mint', product_type: 'tcg', game: 'pokemon', description: 'ok', images: [], ...over });
const TEMPLATE = '<!doctype html><html lang="it"><head><title>x</title><link rel="canonical" href="https://cardbrix.com/"><meta name="description" content="d"><meta property="og:title" content="d"><meta name="twitter:title" content="d"></head><body><div id="root"></div></body></html>';

beforeEach(() => { query.mockReset(); jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => jest.restoreAllMocks());

describe('shared listing text', () => {
  test('descriptor, condition labels and money formatting', () => {
    expect(descriptorFor({ product_type: 'lego' })).toBe('LEGO');
    expect(descriptorFor({ product_type: 'funko' })).toBe('Funko');
    expect(descriptorFor({ product_type: 'tcg', game: 'onepiece' })).toBe('carta One Piece');
    expect(descriptorFor({ product_type: 'tcg', game: 'boh' })).toBe('carta collezionabile');
    expect(descriptorFor({ product_type: 'other' })).toBeNull();
    expect(conditionLabel('Like New')).toBe('Come nuovo');
    expect(conditionLabel('boh')).toBeNull();
    expect(eur('12.5').replace(/\s/g, ' ')).toBe('12,50 €');
    expect(eur(null)).toBeNull();
  });
});

describe('buildListingTitle', () => {
  test('a title that is already long enough is used as written', () => {
    expect(title(L({ title: 'MOC nave spaziale custom', product_type: 'lego' }))).toBe('MOC nave spaziale custom | CardBrix');
  });

  test('short titles are completed step by step until they reach the minimum', () => {
    expect(title(L({ title: 'Froakie' }))).toBe('Froakie – carta Pokémon | CardBrix');
    expect(title(L({ title: 'Pikachu EX 179/131' }))).toBe('Pikachu EX 179/131 – carta Pokémon | CardBrix');
    // "Bonsai Tree – LEGO | CardBrix" is 29 chars: one more step
    expect(title(L({ title: 'Bonsai Tree', product_type: 'lego', game: null }))).toBe('Bonsai Tree – LEGO in vendita | CardBrix');
    expect(title(L({ title: 'Charizard', type: 'auction' }))).toBe('Charizard – carta Pokémon | CardBrix');
  });

  test('never repeats what the title already says', () => {
    expect(title(L({ title: 'LEGO Icons Fiori', product_type: 'lego', game: null }))).toBe('LEGO Icons Fiori in vendita | CardBrix');
    expect(title(L({ title: 'Pokémon Pikachu', product_type: 'tcg' }))).not.toMatch(/Pokémon.*Pokémon/);
  });

  test('unknown category still gets a sale-type suffix; auctions say so', () => {
    expect(title(L({ title: 'Oggetto in regalo', product_type: 'other', game: null }))).toBe('Oggetto in regalo in vendita | CardBrix');
    expect(title(L({ title: 'Oggetto in regalo', product_type: 'other', game: null, type: 'auction' }))).toBe("Oggetto in regalo all'asta | CardBrix");
    // one word, unknown category: "Oggetto in vendita | CardBrix" would be 29 chars, so the last-resort wording applies
    expect(title(L({ title: 'Oggetto', product_type: 'other', game: null }))).toBe('Oggetto – annuncio in vendita online | CardBrix');
  });

  test('long titles are cut on a word boundary so the whole title stays within 65 chars', () => {
    const t = title(L({ title: 'Set LEGO Star Wars Millennium Falcon Ultimate Collector Series edizione limitata 2024', product_type: 'lego' }));
    expect(t.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(t.endsWith('… | CardBrix')).toBe(true);
    expect(t).not.toMatch(/\s…/);
    expect(t.startsWith('Set LEGO Star Wars Millennium Falcon')).toBe(true);
  });

  test('missing or blank title falls back instead of producing " | CardBrix"', () => {
    expect(title(L({ title: '   ' }))).toMatch(/^Annuncio/);
    expect(title(L({ title: null }))).toMatch(/^Annuncio/);
  });

  test('every generated title is within 30-65 chars for a spread of inputs', () => {
    const names = ['A', 'Ab', 'Froakie', 'Bonsai Tree', 'LEGO Icons Fiori', 'MOC nave spaziale custom', 'x'.repeat(200), 'Titolo lunghissimo '.repeat(10)];
    for (const type of ['used', 'auction']) for (const product_type of ['lego', 'funko', 'tcg', 'other']) for (const name of names) {
      const t = title(L({ title: name, type, product_type }));
      expect([name.slice(0, 12), type, product_type, t.length >= TITLE_MIN && t.length <= TITLE_MAX]).toEqual([name.slice(0, 12), type, product_type, true]);
    }
  });
});

describe('buildListingDescription', () => {
  test('a description the seller wrote well is kept (only truncated when very long)', () => {
    const own = 'Set completo con tutte le istruzioni e la scatola originale in ottime condizioni, mai aperto.';
    expect(desc(L({ description: own }))).toBe(own);
    const long = desc(L({ description: 'parola '.repeat(80) }));
    expect(long.length).toBeLessThanOrEqual(DESC_MAX);
    expect(long.endsWith('…')).toBe(true);
  });

  test('a very short description is completed with what the page states: kind, sale type, price, condition', () => {
    const d = desc(L());
    expect(d.replace(/\s/g, ' ')).toBe('Froakie: carta Pokémon in vendita su CardBrix a 3,00 €, condizione: near mint.');
  });

  test('a few characters of seller text ("ok") are not appended; a real note is', () => {
    expect(desc(L({ description: 'ok' }))).not.toContain(' ok.'); // ("ok" alone would also match "Pokémon")
    const d = desc(L({ title: 'MOC nave', product_type: 'lego', game: null, condition: 'used', price: '120', description: 'MOC originale, pezzi misti.' }));
    expect(d).toContain('MOC originale, pezzi misti.');
    // appended after a full stop, so it starts with a capital letter
    expect(desc(L({ title: 'Bonsai Tree', product_type: 'lego', game: null, price: '133', condition: 'new', description: 'nuovo sigillato mai aperto' })))
      .toMatch(/condizione: nuovo\. Nuovo sigillato mai aperto\.$/);
  });

  test('auctions talk about the current bid or the starting price, never "a X €"', () => {
    const bid = desc(L({ type: 'auction', current_bid: '77', description: null })).replace(/\s/g, ' ');
    expect(bid).toBe("Froakie: carta Pokémon all'asta su CardBrix, offerta attuale 77,00 €, condizione: near mint.");
    const start = desc(L({ type: 'auction', current_bid: null, auction_start: '5', description: null })).replace(/\s/g, ' ');
    expect(start).toContain("base d'asta 5,00 €");
    expect(start).not.toMatch(/ a 5,00/);
  });

  test('no price, no condition, no category: still a sentence of the right length, with no "undefined"', () => {
    const d = desc(L({ title: 'Oggetto', price: null, condition: null, product_type: 'other', game: null, description: null }));
    expect(d).toMatch(/^Oggetto: in vendita su CardBrix\./);
    expect(d.length).toBeGreaterThanOrEqual(DESC_MIN);
    expect(d).not.toMatch(/undefined|null|NaN/);
  });

  test('every generated description is within 70-160 chars, whatever the input', () => {
    const notes = [null, '', 'ok', 'una nota breve!', 'x'.repeat(300), 'Parola '.repeat(50)];
    for (const type of ['used', 'auction']) for (const description of notes) for (const price of [null, '3', '1234.5']) for (const product_type of ['lego', 'tcg', 'other']) {
      const d = desc(L({ type, description, price, product_type, current_bid: null, auction_start: price }));
      expect([type, description && description.slice(0, 8), price, product_type, d.length >= DESC_MIN && d.length <= DESC_MAX]).toEqual([type, description && description.slice(0, 8), price, product_type, true]);
    }
  });
});

describe('on the rendered listing page', () => {
  const page = async (listing) => {
    query.mockResolvedValueOnce({ rows: [listing] }).mockResolvedValue({ rows: [] });
    const r = await renderPage('/product/abc', TEMPLATE);
    expect(r.status).toBe(200);
    return { html: r.html, parsed: parseHtml(r.html) };
  };
  const auditIds = (parsed) => checkPage({ url: `${BASE}/product/abc`, finalUrl: `${BASE}/product/abc`, status: 200, chain: [], headers: { 'content-encoding': 'br' }, bytes: 1000, ttfbMs: 100, error: null }, parsed, { baseUrl: BASE }).map((i) => i.id);

  test('a bare "Froakie" listing gets a full title, description, og:title and JSON-LD description', async () => {
    const { html, parsed } = await page(L());
    expect(parsed.title).toBe('Froakie – carta Pokémon | CardBrix');
    expect(parsed.description.replace(/\s/g, ' ')).toBe('Froakie: carta Pokémon in vendita su CardBrix a 3,00 €, condizione: near mint.');
    expect(parsed.og.title).toBe(parsed.title);
    expect(html).toContain('<meta name="twitter:title" content="Froakie – carta Pokémon | CardBrix">');
    const product = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((b) => b['@type'] === 'Product');
    expect(product.description).toBe(parsed.description);
  });

  test('the SEO audit no longer reports title-length or desc-length for these listings', async () => {
    for (const l of [L(), L({ title: 'Bonsai Tree', product_type: 'lego', game: null, description: null }), L({ title: 'Pikachu EX 179/131', description: 'Rarità: Secret rare' }), L({ type: 'auction', current_bid: '9', description: '5 car' })]) {
      const { parsed } = await page(l);
      const ids = auditIds(parsed);
      expect([l.title, ids.includes('title-length'), ids.includes('desc-length')]).toEqual([l.title, false, false]);
    }
  });

  test('user text is escaped in the tags (a hostile title cannot break out of the attribute)', async () => {
    const { html } = await page(L({ title: 'Bello" onload="alert(1)', description: '<script>x</script>' }));
    expect(html).not.toContain('onload="alert(1)');
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&quot; onload=&quot;alert(1)');
  });
});
