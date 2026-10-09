// Trading-card details on listings (language, rarity, grading): pure rules + the create/update routes.
// The database and the auth middleware are mocked, so nothing here can reach a real DB.
jest.mock('../src/db', () => ({ query: jest.fn() }));
jest.mock('../src/middleware/auth', () => (req, res, next) => { req.user = { userId: 'seller-1', role: 'user' }; next(); });

const http = require('http');
const express = require('express');
const { query } = require('../src/db');
const {
  CARD_LANGUAGES, GRADING_COMPANIES, checkCardDetails, cardDetailsForDb,
} = require('../src/services/cardDetails');

describe('checkCardDetails', () => {
  test('graded needs company AND grade, raw needs neither', () => {
    expect(checkCardDetails({ cardGradingCompany: 'psa', cardGrade: '10' })).toBeNull();
    expect(checkCardDetails({ cardGradingCompany: '', cardGrade: '' })).toBeNull();
    expect(checkCardDetails({ cardGradingCompany: null, cardGrade: null })).toBeNull();
    expect(checkCardDetails({ cardGradingCompany: 'psa', cardGrade: '' })).toMatch(/società/i);
    expect(checkCardDetails({ cardGradingCompany: '', cardGrade: '9.5' })).toMatch(/società/i);
    expect(checkCardDetails({ cardGradingCompany: 'psa' })).toMatch(/società/i);
  });

  test('a request that sends neither is not checked (partial update of something else)', () => {
    expect(checkCardDetails({ title: 'x' })).toBeNull();
  });

  test('the allowed lists contain what the wizard offers', () => {
    expect(CARD_LANGUAGES).toEqual(['it', 'en', 'ja', 'de', 'fr', 'es', 'pt', 'ko', 'zh']);
    expect(GRADING_COMPANIES).toEqual(['psa', 'cgc', 'bgs', 'sgc', 'other']);
  });
});

describe('cardDetailsForDb', () => {
  const full = { cardLanguage: ' it ', cardRarity: ' Holo Rare ', cardGradingCompany: 'psa', cardGrade: '9.5' };

  const NO_SET = { cardSetId: null, cardNumber: null, cardExternalId: null };
  const ALL_NULL = { cardLanguage: null, cardRarity: null, cardGradingCompany: null, cardGrade: null, ...NO_SET };

  test('create: trims, turns blanks into null, always returns every key', () => {
    expect(cardDetailsForDb(full, 'tcg')).toEqual({ cardLanguage: 'it', cardRarity: 'Holo Rare', cardGradingCompany: 'psa', cardGrade: '9.5', ...NO_SET });
    expect(cardDetailsForDb({ cardLanguage: '', cardRarity: '  ' }, 'tcg')).toEqual(ALL_NULL);
  });

  test('the catalog link (expansion, number, card) is kept for the games that have a catalog and dropped for any other', () => {
    const link = { cardSetId: ' 30th ', cardNumber: '029', cardExternalId: '30th-029' };
    expect(cardDetailsForDb({ ...link, game: 'pokemon' }, 'tcg')).toMatchObject({ cardSetId: '30th', cardNumber: '029', cardExternalId: '30th-029' });
    expect(cardDetailsForDb({ ...link, game: 'dragonball' }, 'tcg')).toMatchObject(NO_SET);
    expect(cardDetailsForDb({ ...link, cardLanguage: 'it', game: 'dragonball' }, 'tcg').cardLanguage).toBe('it'); // only the link goes
    expect(cardDetailsForDb({ ...link, game: 'dragonball' }, 'tcg', { partial: true })).toEqual(NO_SET);
    expect(cardDetailsForDb({ cardSetId: 'me05' }, undefined, { partial: true })).toEqual({ cardSetId: 'me05' }); // game not mentioned: untouched
  });

  test('anything that is not a card is cleared', () => {
    for (const type of ['lego', 'funko']) {
      expect(cardDetailsForDb(full, type)).toEqual(ALL_NULL);
      expect(cardDetailsForDb({}, type, { partial: true })).toEqual(ALL_NULL);
    }
  });

  test('update: only what was sent; sending blank clears that field', () => {
    expect(cardDetailsForDb({ title: 'x' }, undefined, { partial: true })).toEqual({});
    expect(cardDetailsForDb({ cardGradingCompany: '', cardGrade: '' }, 'tcg', { partial: true })).toEqual({ cardGradingCompany: null, cardGrade: null });
    expect(cardDetailsForDb({ cardLanguage: 'ja' }, undefined, { partial: true })).toEqual({ cardLanguage: 'ja' });
  });
});

describe('listing routes', () => {
  let server;
  let base;

  beforeAll(async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const app = express();
    app.use(express.json());
    app.use('/api/listings', require('../src/routes/listings'));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/api/listings`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: [{ id: 'new-1', status: 'draft' }] });
  });

  const create = (fields) => {
    const fd = new FormData();
    Object.entries({ title: 'Charizard 4/102', status: 'draft', productType: 'tcg', game: 'pokemon', category: 'sets', ...fields })
      .forEach(([k, v]) => fd.append(k, v));
    return fetch(base, { method: 'POST', body: fd });
  };
  const insertParams = () => query.mock.calls.find(([sql]) => /INSERT INTO listings/.test(sql))[1];

  test('create stores language, rarity and grading for a card', async () => {
    const res = await create({ cardLanguage: 'it', cardRarity: 'Holo Rare', cardGradingCompany: 'psa', cardGrade: '10' });
    expect(res.status).toBe(201);
    expect(insertParams().slice(-7, -3)).toEqual(['it', 'Holo Rare', 'psa', '10']);
  });

  test('create without any card detail stores nulls', async () => {
    expect((await create({})).status).toBe(201);
    expect(insertParams().slice(-7)).toEqual([null, null, null, null, null, null, null]);
  });

  test('create rejects a grading company without a grade, and unknown values', async () => {
    expect((await create({ cardGradingCompany: 'psa' })).status).toBe(400);
    expect((await create({ cardGrade: '10' })).status).toBe(400);
    expect((await create({ cardLanguage: 'xx' })).status).toBe(400);
    expect((await create({ cardGradingCompany: 'zzz', cardGrade: '9' })).status).toBe(400);
    expect((await create({ cardRarity: 'x'.repeat(61) })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  test('card details on a non-card listing are dropped, not stored', async () => {
    const res = await create({ productType: 'lego', game: '', cardLanguage: 'it', cardGradingCompany: 'psa', cardGrade: '10' });
    expect(res.status).toBe(201);
    expect(insertParams().slice(-7)).toEqual([null, null, null, null, null, null, null]);
  });

  test('create stores the catalog link for a Pokémon card, and not for other games', async () => {
    const link = { cardSetId: '30th', cardNumber: '029', cardExternalId: '30th-029' };
    expect((await create(link)).status).toBe(201);
    expect(insertParams().slice(-3)).toEqual(['30th', '029', '30th-029']);
    query.mockClear();
    expect((await create({ ...link, game: 'dragonball' })).status).toBe(201);
    expect(insertParams().slice(-3)).toEqual([null, null, null]);
  });

  test('create stores the catalog link for Magic and One Piece too', async () => {
    for (const [game, link] of [
      ['magic', { cardSetId: 'blb', cardNumber: '1', cardExternalId: '25a06f82-ebdb-4dd6-bfe8-958018ce557c' }],
      ['onepiece', { cardSetId: 'OP-01', cardNumber: 'OP01-077', cardExternalId: 'OP01-077_p1' }],
    ]) {
      query.mockClear();
      expect((await create({ ...link, game })).status).toBe(201);
      expect(insertParams().slice(-3)).toEqual([link.cardSetId, link.cardNumber, link.cardExternalId]);
    }
  });

  test('create rejects a malformed catalog id', async () => {
    expect((await create({ cardSetId: 'a b/c' })).status).toBe(400);
    expect((await create({ cardExternalId: '<x>' })).status).toBe(400);
    expect((await create({ cardNumber: 'x'.repeat(21) })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  const patch = (body) => fetch(`${base}/abc`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const updateCall = () => query.mock.calls.find(([sql]) => /UPDATE listings/.test(sql));

  test('update writes only the card columns it was given', async () => {
    const res = await patch({ cardLanguage: 'ja', cardGradingCompany: 'bgs', cardGrade: '9.5' });
    expect(res.status).toBe(200);
    const [sql, params] = updateCall();
    expect(sql).toMatch(/card_language = \$1/);
    expect(sql).toMatch(/card_grading_company = \$2/);
    expect(sql).toMatch(/card_grade = \$3/);
    expect(sql).not.toMatch(/card_rarity/);
    expect(params.slice(0, 3)).toEqual(['ja', 'bgs', '9.5']);
  });

  test('update can clear grading by sending both blank', async () => {
    expect((await patch({ cardGradingCompany: '', cardGrade: '' })).status).toBe(200);
    expect(updateCall()[1].slice(0, 2)).toEqual([null, null]);
  });

  test('update rejects a half-filled grading pair and clears card fields when the type is not a card', async () => {
    expect((await patch({ cardGradingCompany: 'psa' })).status).toBe(400);
    expect(updateCall()).toBeUndefined();
    expect((await patch({ productType: 'lego', cardLanguage: 'it' })).status).toBe(200);
    const [sql] = updateCall();
    for (const col of ['card_language', 'card_rarity', 'card_grading_company', 'card_grade']) expect(sql).toContain(`${col} = `);
  });
});
