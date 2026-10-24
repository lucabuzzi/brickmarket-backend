// LEGO sets from a photo of the box (src/services/legoRecognition.js) and their way through /api/cards/recognize with
// game "lego": only a number the catalog knows becomes a set, "sealed" is just a condition hint, the photo never
// leaves the request. Reader, catalog, database and auth are fakes, so this runs offline.
jest.mock('../src/db', () => ({ query: jest.fn() }));
jest.mock('../src/middleware/auth', () => (req, res, next) => {
  const id = req.header('x-test-user');
  if (!id) return res.status(401).json({ error: 'no token' });
  req.user = { userId: id };
  return next();
});

const http = require('http');
const express = require('express');
const sharp = require('sharp');
const { recognizeLegoSet, parseLegoReading, suggestedCondition, SCHEMA } = require('../src/services/legoRecognition');
const { createCardRecognizeRouter } = require('../src/routes/cardRecognize');
const { RecognitionError } = require('../src/services/cardRecognition');

const jpeg = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#c33' } }).jpeg().toBuffer();
const FALCON = { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, num_parts: 7541, img_url: 'https://img/75192.jpg', theme_id: 171 };

describe('reading a LEGO box', () => {
  test('replies are cleaned: a set number is digits (with an optional variant), broken JSON is null', () => {
    expect(parseLegoReading('{"isLego":true,"setNumber":"75 192","name":"Millennium Falcon","sealed":true}'))
      .toEqual({ isLego: true, setNumber: '75192', name: 'Millennium Falcon', sealed: true });
    expect(parseLegoReading('{"isLego":true,"setNumber":"10281-1","name":"null","sealed":"yes"}'))
      .toEqual({ isLego: true, setNumber: '10281-1', name: null, sealed: null });
    expect(parseLegoReading('{"isLego":true,"setNumber":"Falcon","name":null,"sealed":null}').setNumber).toBeNull();
    expect(parseLegoReading('{"isLego":true,"setNumber":"12","name":null,"sealed":null}').setNumber).toBeNull();
    expect(parseLegoReading('not json')).toBeNull();
    expect(SCHEMA.required).toEqual(['isLego', 'setNumber', 'name', 'sealed']);
  });

  test('a sealed box suggests "new", an opened one "used", an unknown one nothing', () => {
    expect(suggestedCondition({ sealed: true })).toBe('new');
    expect(suggestedCondition({ sealed: false })).toBe('used');
    expect(suggestedCondition({ sealed: null })).toBeNull();
    expect(suggestedCondition(null)).toBeNull();
  });

  test('a number the catalog knows: the catalog set, its value estimate and the condition hint', async () => {
    const reader = jest.fn(async () => ({ reading: { isLego: true, setNumber: '75192', name: 'Falcon', sealed: true }, usage: { inputTokens: 900, outputTokens: 30 } }));
    const lookup = jest.fn(async () => FALCON);
    const r = await recognizeLegoSet(await jpeg(), { reader, lookup });
    expect(lookup).toHaveBeenCalledWith('75192-1');
    // the reader gets the LEGO prompt and schema, not the card ones
    expect(reader.mock.calls[0][1].schema).toBe(SCHEMA);
    expect(reader.mock.calls[0][1].prompt).toMatch(/LEGO set box/);
    expect(r.status).toBe('matched');
    expect(r.set).toEqual({ set_num: '75192-1', name: 'Millennium Falcon', year: 2017, num_parts: 7541, img_url: 'https://img/75192.jpg' });
    expect(r.reading).toEqual({ setNumber: '75192', name: 'Falcon', sealed: true, condition: 'new' });
    expect(r.pricing).toEqual(expect.objectContaining({ marketValue: expect.anything() }));
  });

  test('a number nobody has is not_found; no packaging or no number is unreadable (the catalog is not even asked)', async () => {
    const lookup = jest.fn(async () => null);
    const read = (reading) => async () => ({ reading, usage: null });
    expect((await recognizeLegoSet(await jpeg(), { reader: read({ isLego: true, setNumber: '99999', name: null, sealed: null }), lookup })).status).toBe('not_found');
    lookup.mockClear();
    expect((await recognizeLegoSet(await jpeg(), { reader: read({ isLego: false, setNumber: '75192', name: null, sealed: null }), lookup })).status).toBe('unreadable');
    expect((await recognizeLegoSet(await jpeg(), { reader: read({ isLego: true, setNumber: null, name: 'Falcon', sealed: null }), lookup })).status).toBe('unreadable');
    expect((await recognizeLegoSet(await jpeg(), { reader: read(null), lookup })).status).toBe('unreadable');
    expect(lookup).not.toHaveBeenCalled();
  });

  test('a file that is not an image is refused before any call to the reader', async () => {
    const reader = jest.fn();
    await expect(recognizeLegoSet(Buffer.from('nope'), { reader })).rejects.toMatchObject({ code: 'bad_image' });
    expect(reader).not.toHaveBeenCalled();
  });
});

describe('POST /api/cards/recognize with game "lego"', () => {
  let server;
  let base;
  const recognize = jest.fn();
  const recognizeLego = jest.fn();
  const cachePrints = jest.fn();

  beforeAll(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const app = express();
    app.use('/api/cards', createCardRecognizeRouter({
      recognize, recognizeLego, cachePrints, isEnabled: () => true, enabledGames: () => ['pokemon', 'lego'], limits: { hourly: 100, daily: 100, siteDaily: 100 },
    }));
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}/api/cards`;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    jest.restoreAllMocks();
  });
  beforeEach(() => { recognize.mockReset(); recognizeLego.mockReset(); console.log.mockClear(); });

  const send = (game, user = 'seller-1') => {
    const form = new FormData();
    form.append('game', game);
    form.append('image', new Blob([Buffer.alloc(2048, 7)], { type: 'image/jpeg' }), 'box.jpg');
    return fetch(`${base}/recognize`, { method: 'POST', headers: user ? { 'x-test-user': user } : {}, body: form });
  };

  test('the set found, without usage numbers; the card recognition and its cache are not involved', async () => {
    recognizeLego.mockResolvedValue({
      status: 'matched', reading: { setNumber: '75192', name: 'Falcon', sealed: true, condition: 'new' },
      set: { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, num_parts: 7541, img_url: null }, pricing: { marketValue: 800 }, usage: { inputTokens: 1, outputTokens: 1 },
    });
    const res = await send('lego');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      game: 'lego', status: 'matched', reading: { setNumber: '75192', name: 'Falcon', sealed: true, condition: 'new' },
      set: { set_num: '75192-1', name: 'Millennium Falcon', year: 2017, num_parts: 7541, img_url: null }, pricing: { marketValue: 800 },
    });
    expect(Buffer.isBuffer(recognizeLego.mock.calls[0][0])).toBe(true);
    expect(recognize).not.toHaveBeenCalled();
    expect(cachePrints).not.toHaveBeenCalled();
    const line = console.log.mock.calls.map((c) => c.join(' ')).find((l) => l.includes('game=lego'));
    expect(line).toMatch(/user=seller-1 game=lego status=matched read=75192/);
  });

  test('logged-in only; reader errors keep their status', async () => {
    expect((await send('lego', null)).status).toBe(401);
    recognizeLego.mockRejectedValue(new RecognitionError('timeout'));
    const res = await send('lego');
    expect(res.status).toBe(504);
    expect((await res.json()).code).toBe('timeout');
  });
});
