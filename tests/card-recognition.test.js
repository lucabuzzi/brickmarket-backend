// One Piece card recognition (src/services/cardRecognition.js + onepieceCode.js + onepiecePrints.js): what the vision
// model reads is cleaned, checked against the public card database, and only a real code becomes a result.
// Everything is offline: the reader and the database are fakes.
const sharp = require('sharp');
const { normalizeCode, codeKind, namesMatch } = require('../src/services/onepieceCode');
const { fetchPrintsByCode } = require('../src/services/onepiecePrints');
const { recognizeOnePiece, geminiReader, parseReading, prepareImage, MAX_SIDE } = require('../src/services/cardRecognition');

const jpeg = (w = 300, h = 420) => sharp({ create: { width: w, height: h, channels: 3, background: '#777' } }).jpeg().toBuffer();
const row = (id, name = 'Perona', rarity = 'UC') => ({ card_image_id: id, card_set_id: id.replace(/_.*/, ''), card_name: name, rarity, set_id: 'OP-01', set_name: 'Romance Dawn', card_image: `https://img/${id}.jpg` });
const reader = (reading) => async () => ({ reading, usage: { inputTokens: 1000, outputTokens: 40 } });

describe('card code', () => {
  test.each([
    ['OP01-077', 'OP01-077'], ['op01-077', 'OP01-077'], ['OP01 - 077', 'OP01-077'], ['OP01–077', 'OP01-077'], ['OP01077', 'OP01-077'],
    ['OPO1-O77', 'OP01-077'], ['0P01-077', 'OP01-077'], ['ST1O-005', 'ST10-005'], ['EB01-0I2', 'EB01-012'], ['PRB01-001', 'PRB01-001'],
    ['P-034', 'P-034'], ['P034', 'P-034'], ['OP05-119 SEC', 'OP05-119'], ['code: OP09-004', 'OP09-004'],
  ])('%s -> %s', (raw, code) => expect(normalizeCode(raw)).toBe(code));

  test.each([null, undefined, '', 'Perona', 'OP1-77', '12000', 'ST-10'])('%p is not a code', (raw) => expect(normalizeCode(raw)).toBeNull());

  test('kinds', () => {
    expect(codeKind('OP01-077')).toBe('set');
    expect(codeKind('EB01-012')).toBe('set');
    expect(codeKind('PRB01-001')).toBe('set');
    expect(codeKind('ST10-005')).toBe('starter');
    expect(codeKind('P-034')).toBe('promo');
    expect(codeKind('XX01-001')).toBeNull();
  });

  test('names: tags, punctuation, short names and small misreads agree; different names do not', () => {
    expect(namesMatch('Perona', 'Perona (Box Topper)')).toBe(true);
    expect(namesMatch('Monkey D. Luffy', 'Monkey.D.Luffy')).toBe(true);
    expect(namesMatch('Luffy', 'Monkey.D.Luffy (Alternate Art)')).toBe(true);
    expect(namesMatch('Katakurl', 'Charlotte Katakuri')).toBe(true);
    expect(namesMatch('Shanks', 'Perona')).toBe(false);
    expect(namesMatch('', 'Perona')).toBe(false);
  });
});

describe('prints of a code (optcgapi)', () => {
  const fake = (byPath) => jest.fn(async (url) => {
    const hit = Object.entries(byPath).find(([p]) => url.endsWith(p));
    return { ok: !!hit, json: async () => (hit ? hit[1] : { error: 'Card not found.' }) };
  });

  test('set card: base first, then variants', async () => {
    const f = fake({ 'sets/card/OP01-077/': [row('OP01-077_p1'), row('OP01-077')] });
    const rows = await fetchPrintsByCode('OP01-077', { fetchImpl: f });
    expect(rows.map((r) => r.card_image_id)).toEqual(['OP01-077', 'OP01-077_p1']);
  });

  test('starter deck: deck list and booster reprints merged without duplicates', async () => {
    const f = fake({ 'decks/card/ST10-005/': [row('ST10-005')], 'sets/card/ST10-005/': [row('ST10-005'), row('ST10-005_r1')] });
    const rows = await fetchPrintsByCode('ST10-005', { fetchImpl: f });
    expect(rows.map((r) => r.card_image_id)).toEqual(['ST10-005', 'ST10-005_r1']);
    expect(f).toHaveBeenCalledTimes(2);
  });

  test('promo list; unknown code, bad code and network errors give []', async () => {
    expect(await fetchPrintsByCode('P-034', { fetchImpl: fake({ 'promos/card/P-034/': [row('P-034', 'Sanji', 'PR')] }) })).toHaveLength(1);
    expect(await fetchPrintsByCode('OP99-999', { fetchImpl: fake({}) })).toEqual([]);
    const f = jest.fn();
    expect(await fetchPrintsByCode('nope', { fetchImpl: f })).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await fetchPrintsByCode('OP01-077', { fetchImpl: async () => { throw new Error('down'); } })).toEqual([]);
    spy.mockRestore();
  });

  test('a row of another code is never offered', async () => {
    const rows = await fetchPrintsByCode('OP01-077', { fetchImpl: fake({ 'sets/card/OP01-077/': [row('OP01-077'), row('OP01-078')] }) });
    expect(rows.map((r) => r.card_set_id)).toEqual(['OP01-077']);
  });
});

describe('recognition', () => {
  const prints = async (code) => (code === 'OP01-077' ? [row('OP01-077'), row('OP01-077_p1', 'Perona (Box Topper)')] : []);

  test('a real code: every print offered, name agreement reported', async () => {
    const r = await recognizeOnePiece(await jpeg(), { reader: reader({ isCard: true, code: 'OPO1-O77', name: 'Perona', rarity: 'UC', language: 'en' }), fetchPrints: prints });
    expect(r.status).toBe('matched');
    expect(r.reading).toMatchObject({ code: 'OP01-077', rawCode: 'OPO1-O77', name: 'Perona' });
    expect(r.prints.map((p) => p.external_id)).toEqual(['OP01-077', 'OP01-077_p1']);
    expect(r.prints[1].details.variant).toBe('1');
    expect(r.nameMatches).toBe(true);
    expect(r.usage).toEqual({ inputTokens: 1000, outputTokens: 40 });
  });

  test('a code that exists but a different name: still offered, flagged for the seller to check', async () => {
    const r = await recognizeOnePiece(await jpeg(), { reader: reader({ isCard: true, code: 'OP01-077', name: 'Shanks' }), fetchPrints: prints });
    expect(r.status).toBe('matched');
    expect(r.nameMatches).toBe(false);
  });

  test('an invented or unknown code never becomes a result', async () => {
    const r = await recognizeOnePiece(await jpeg(), { reader: reader({ isCard: true, code: 'OP99-999', name: 'Perona' }), fetchPrints: prints });
    expect(r).toMatchObject({ status: 'not_found', prints: [] });
    expect(r.reading.name).toBe('Perona');
  });

  test('only a name read: not_found with the name to search', async () => {
    const r = await recognizeOnePiece(await jpeg(), { reader: reader({ isCard: true, code: null, name: 'Perona' }), fetchPrints: prints });
    expect(r.status).toBe('not_found');
  });

  test.each([
    ['not a card', { isCard: false, code: 'OP01-077', name: 'Perona' }],
    ['nothing legible', { isCard: true, code: null, name: null }],
    ['unparsable reply', null],
  ])('%s: unreadable', async (_, reading) => {
    const fetchPrints = jest.fn(prints);
    const r = await recognizeOnePiece(await jpeg(), { reader: reader(reading), fetchPrints });
    expect(r.status).toBe('unreadable');
    expect(fetchPrints).not.toHaveBeenCalled();
  });

  test('a file that is not an image is refused before any call', async () => {
    const read = jest.fn();
    await expect(recognizeOnePiece(Buffer.from('not an image'), { reader: read })).rejects.toMatchObject({ code: 'bad_image' });
    expect(read).not.toHaveBeenCalled();
  });

  test('the photo sent is shrunk to the long side limit, JPEG, without metadata', async () => {
    const big = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: '#777' } })
      .withMetadata({ exif: { IFD0: { Copyright: 'secret' } } }).jpeg().toBuffer();
    const out = await prepareImage(big);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width, meta.height)).toBe(MAX_SIDE);
    expect(meta.exif).toBeUndefined();
  });
});

describe('Gemini reader', () => {
  const reply = (text, status = 200) => jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 50 } }),
  }));

  test('sends the key in the header (never in the URL), the image inline and a JSON schema', async () => {
    const f = reply('{"isCard":true,"code":"OP01-077","name":"Perona","rarity":"UC","language":"EN"}');
    const out = await geminiReader({ apiKey: 'k-123', model: 'm-1', fetchImpl: f })(await jpeg());
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/m-1:generateContent');
    expect(url).not.toContain('k-123');
    expect(init.headers['x-goog-api-key']).toBe('k-123');
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[1].inline_data.mime_type).toBe('image/jpeg');
    expect(body.generationConfig).toMatchObject({ temperature: 0, responseMimeType: 'application/json' });
    expect(out.reading).toEqual({ isCard: true, code: 'OP01-077', name: 'Perona', rarity: 'UC', language: 'en' });
    expect(out.usage).toEqual({ inputTokens: 1200, outputTokens: 50 });
  });

  test('errors become typed errors', async () => {
    const img = await jpeg();
    await expect(geminiReader({ apiKey: '' })(img)).rejects.toMatchObject({ code: 'not_configured' });
    await expect(geminiReader({ apiKey: 'k', fetchImpl: reply('', 429) })(img)).rejects.toMatchObject({ code: 'rate_limited' });
    await expect(geminiReader({ apiKey: 'k', fetchImpl: reply('', 500) })(img)).rejects.toMatchObject({ code: 'provider_error' });
    const timeout = async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; };
    await expect(geminiReader({ apiKey: 'k', fetchImpl: timeout })(img)).rejects.toMatchObject({ code: 'timeout' });
  });

  test('replies are cleaned: broken JSON is null, "null"/"unknown" strings are null, odd languages dropped', () => {
    expect(parseReading('not json')).toBeNull();
    expect(parseReading('{"isCard":true,"code":"unknown","name":" Perona ","rarity":"null","language":"english"}'))
      .toEqual({ isCard: true, code: null, name: 'Perona', rarity: null, language: null });
  });
});
