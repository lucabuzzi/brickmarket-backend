// /api/cards/recognize (src/routes/cardRecognize.js): only logged-in sellers, only when switched on, one photo at a
// time, with per-seller and site-wide allowances; the recognised prints are cached, and the photo never leaves the
// request. Plus the One Piece catalog fixes that came with it (src/integrations/catalogs/onepieceApi.js).
// The database, the auth middleware and the recognition itself are fakes, so this runs offline.
jest.mock('../src/db', () => ({ query: jest.fn() }));
jest.mock('../src/middleware/auth', () => (req, res, next) => {
  const id = req.header('x-test-user');
  if (!id) return res.status(401).json({ error: 'no token' });
  req.user = { userId: id };
  return next();
});

const http = require('http');
const express = require('express');
const { query } = require('../src/db');
const { createCardRecognizeRouter } = require('../src/routes/cardRecognize');
const { RecognitionError } = require('../src/services/cardRecognition');

const PRINT = { external_id: 'OP01-077', name: 'Perona', set_code: 'OP-01', set_name: 'Romance Dawn', rarity: 'Uncommon', img_url: 'https://img/1.jpg', details: { localId: 'OP01-077', variant: null } };
const MATCHED = {
  status: 'matched',
  reading: { isCard: true, code: 'OP01-077', rawCode: 'OPO1-O77', name: 'Perona', rarity: 'UC', language: 'en' },
  nameMatches: true,
  prints: [PRINT, { ...PRINT, external_id: 'OP01-077_p1', details: { localId: 'OP01-077', variant: '1' } }],
  usage: { inputTokens: 1300, outputTokens: 50 },
};

async function startApp(options) {
  const app = express();
  app.use('/api/cards', createCardRecognizeRouter(options));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}/api/cards` };
}

const photo = (bytes = 2048, type = 'image/jpeg', name = 'card.jpg', game = null) => {
  const form = new FormData();
  if (game) form.append('game', game);
  form.append('image', new Blob([Buffer.alloc(bytes, 7)], { type }), name);
  return form;
};
const post = (base, { user = 'seller-1', body = photo() } = {}) => fetch(`${base}/recognize`, {
  method: 'POST', headers: user ? { 'x-test-user': user } : {}, body,
});

describe('POST /api/cards/recognize', () => {
  let app;
  const recognize = jest.fn();
  const cachePrints = jest.fn(async () => {});
  let enabled = true;
  let games = ['onepiece', 'magic', 'pokemon', 'yugioh', 'lorcana'];

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    app = await startApp({ recognize, cachePrints, isEnabled: () => enabled, enabledGames: () => games, limits: { hourly: 100, daily: 100, siteDaily: 100 } });
  });
  afterAll(async () => {
    await new Promise((resolve) => app.server.close(resolve));
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    enabled = true;
    games = ['onepiece', 'magic', 'pokemon', 'yugioh', 'lorcana'];
    recognize.mockReset();
    cachePrints.mockClear();
    console.log.mockClear();
  });

  test('status says whether the camera button can be shown', async () => {
    expect(await (await fetch(`${app.base}/recognize/status`)).json()).toEqual({ enabled: true, games });
    enabled = false;
    expect((await (await fetch(`${app.base}/recognize/status`)).json()).enabled).toBe(false);
  });

  test('a recognised card: what was read and every print, cached; no token usage or raw code sent back', async () => {
    recognize.mockResolvedValue(MATCHED);
    const res = await post(app.base);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      game: 'onepiece',
      status: 'matched',
      reading: { code: 'OP01-077', name: 'Perona', number: null, setCode: null, rarity: 'UC', language: 'en' },
      nameMatches: true,
      prints: MATCHED.prints,
    });
    expect(recognize.mock.calls[0][0]).toBe('onepiece'); // no game sent: the One Piece client of before
    expect(Buffer.isBuffer(recognize.mock.calls[0][1])).toBe(true);
    expect(recognize.mock.calls[0][1].length).toBe(2048);
    expect(cachePrints).toHaveBeenCalledWith('onepiece', MATCHED.prints);
  });

  test('the game sent is the one read and cached', async () => {
    const prints = [{ external_id: 'sv01-063', name: 'Pikachu' }];
    recognize.mockResolvedValue({ ...MATCHED, reading: { isCard: true, code: null, name: 'Pikachu', number: '063/198', setCode: 'SVI', language: 'it' }, prints });
    const body = await (await post(app.base, { body: photo(2048, 'image/jpeg', 'card.jpg', 'pokemon') })).json();
    expect(body).toMatchObject({ game: 'pokemon', reading: { number: '063/198', setCode: 'SVI' } });
    expect(recognize.mock.calls[0][0]).toBe('pokemon');
    expect(cachePrints).toHaveBeenCalledWith('pokemon', prints);
  });

  test('a game that is not recognised (or switched off) is refused before the reader', async () => {
    games = ['onepiece', 'magic'];
    for (const game of ['dragonball', 'pokemon']) {
      const res = await post(app.base, { body: photo(2048, 'image/jpeg', 'card.jpg', game) });
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe('unsupported_game');
    }
    expect(recognize).not.toHaveBeenCalled();
  });

  test('the log line says who and what was read, never the photo', async () => {
    recognize.mockResolvedValue(MATCHED);
    await post(app.base);
    const lines = console.log.mock.calls.map((c) => c.join(' '));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/user=seller-1 game=onepiece status=matched read=OP01-077 prints=2/);
    expect(lines[0].length).toBeLessThan(200);
  });

  test('nothing recognised: answered, nothing cached', async () => {
    recognize.mockResolvedValue({ status: 'unreadable', reading: null, nameMatches: null, prints: [], usage: null });
    const body = await (await post(app.base)).json();
    expect(body).toMatchObject({ status: 'unreadable', reading: null, prints: [] });
    expect(cachePrints).not.toHaveBeenCalled();
  });

  test('logged out: 401 before anything else', async () => {
    expect((await post(app.base, { user: null })).status).toBe(401);
    expect(recognize).not.toHaveBeenCalled();
  });

  test('switched off: 503 not_configured, the reader is never called', async () => {
    enabled = false;
    const res = await post(app.base);
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('not_configured');
    expect(recognize).not.toHaveBeenCalled();
  });

  test.each([
    ['no file', () => new FormData(), 400, 'no_image'],
    ['a file that is not an image', () => photo(100, 'text/plain', 'a.txt'), 400, 'no_image'],
    ['a photo over 10 MB', () => photo(10 * 1024 * 1024 + 1), 413, 'too_large'],
  ])('%s is refused before the reader', async (_, body, status, code) => {
    const res = await post(app.base, { body: body() });
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
    expect(recognize).not.toHaveBeenCalled();
  });

  test.each([
    ['bad_image', 400], ['timeout', 504], ['rate_limited', 503], ['provider_error', 502], ['not_configured', 503],
  ])('reader error %s -> HTTP %i with its code', async (code, status) => {
    recognize.mockRejectedValue(new RecognitionError(code));
    const res = await post(app.base);
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
  });

  test('an unexpected error is a 500 without details', async () => {
    recognize.mockRejectedValue(new Error('secret stack detail'));
    const res = await post(app.base);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('internal');
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});

describe('allowances', () => {
  const recognize = jest.fn(async () => MATCHED);
  let apps = [];
  beforeAll(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterAll(async () => {
    await Promise.all(apps.map((a) => new Promise((resolve) => a.server.close(resolve))));
    jest.restoreAllMocks();
  });
  const start = async (limits) => {
    const a = await startApp({ recognize, cachePrints: async () => {}, isEnabled: () => true, enabledGames: () => ['onepiece'], limits });
    apps.push(a);
    return a.base;
  };

  test('each seller has their own hourly allowance', async () => {
    const base = await start({ hourly: 2, daily: 100, siteDaily: 100 });
    expect((await post(base, { user: 'a' })).status).toBe(200);
    expect((await post(base, { user: 'a' })).status).toBe(200);
    const third = await post(base, { user: 'a' });
    expect(third.status).toBe(429);
    expect((await third.json()).code).toBe('user_hourly_limit');
    expect((await post(base, { user: 'b' })).status).toBe(200);
  });

  test('the daily allowance applies on top of the hourly one', async () => {
    const base = await start({ hourly: 100, daily: 1, siteDaily: 100 });
    expect((await post(base, { user: 'a' })).status).toBe(200);
    expect((await (await post(base, { user: 'a' })).json()).code).toBe('user_daily_limit');
  });

  test('the whole site stops at its daily allowance', async () => {
    const base = await start({ hourly: 100, daily: 100, siteDaily: 2 });
    await post(base, { user: 'a' });
    await post(base, { user: 'b' });
    const res = await post(base, { user: 'c' });
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('site_daily_limit');
  });
});

describe('isEnabled', () => {
  const { isEnabled } = require('../src/services/cardRecognition');
  const saved = { key: process.env.GEMINI_API_KEY, flag: process.env.CARD_RECOGNITION_ENABLED };
  afterEach(() => {
    process.env.GEMINI_API_KEY = saved.key ?? '';
    process.env.CARD_RECOGNITION_ENABLED = saved.flag ?? '';
  });

  test('needs both the key and the explicit switch', () => {
    process.env.GEMINI_API_KEY = 'k';
    process.env.CARD_RECOGNITION_ENABLED = '';
    expect(isEnabled()).toBe(false);
    process.env.CARD_RECOGNITION_ENABLED = '1';
    expect(isEnabled()).toBe(true);
    process.env.GEMINI_API_KEY = '';
    expect(isEnabled()).toBe(false);
  });
});

describe('enabledGames', () => {
  const { enabledGames } = require('../src/services/cardRecognition');
  const saved = process.env.CARD_RECOGNITION_GAMES;
  afterEach(() => { process.env.CARD_RECOGNITION_GAMES = saved ?? ''; });

  test('every game with an adapter, unless CARD_RECOGNITION_GAMES lists some', () => {
    process.env.CARD_RECOGNITION_GAMES = '';
    expect(enabledGames()).toEqual(['onepiece', 'magic', 'pokemon', 'yugioh', 'lorcana']);
    process.env.CARD_RECOGNITION_GAMES = ' Pokemon, onepiece ,dragonball';
    expect(enabledGames()).toEqual(['onepiece', 'pokemon']);
  });
});

describe('One Piece catalog (onepieceApi)', () => {
  const onepieceApi = require('../src/integrations/catalogs/onepieceApi');
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; query.mockReset(); });

  const optcg = (byPath) => jest.fn(async (url) => {
    const hit = Object.entries(byPath).find(([p]) => String(url).endsWith(p));
    return { ok: !!hit, json: async () => (hit ? hit[1] : []) };
  });
  const raw = (id) => ({ card_image_id: id, card_set_id: id.replace(/_.*/, ''), card_name: 'Uta', rarity: 'SR', set_id: 'ST-11', set_name: 'Uta' });

  test('a starter-deck card is found in the deck list (the booster list does not have its base print)', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // cache miss
    query.mockImplementation(async (sql, params) => ({ rows: [{ external_id: params[1], name: params[2] }] }));
    global.fetch = optcg({ 'decks/card/ST11-001/': [raw('ST11-001')], 'sets/card/ST11-001/': [raw('ST11-001_p1')] });
    const card = await onepieceApi.lookupCard('ST11-001');
    expect(card.external_id).toBe('ST11-001');
  });

  test('a reprint id ("_r1") is looked up by its base code', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    query.mockImplementation(async (sql, params) => ({ rows: [{ external_id: params[1] }] }));
    global.fetch = optcg({ 'sets/card/OP01-077/': [raw('OP01-077'), raw('OP01-077_r1')] });
    expect((await onepieceApi.lookupCard('OP01-077_r1')).external_id).toBe('OP01-077_r1');
  });

  test('cachePrints stores every print and never throws', async () => {
    query.mockResolvedValue({ rows: [{}] });
    await onepieceApi.cachePrints([PRINT, { ...PRINT, external_id: 'OP01-077_p1' }]);
    expect(query.mock.calls.map(([, p]) => p[1])).toEqual(['OP01-077', 'OP01-077_p1']);
    query.mockRejectedValue(new Error('db down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(onepieceApi.cachePrints([PRINT])).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
