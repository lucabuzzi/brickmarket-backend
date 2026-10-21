// The "photograph the card" shortcut of the sell wizard (client/src/lib/sell/recognize.js): when it is offered, how a
// recognised print fills the form (from the catalog, never from what the model read), which message each answer gets,
// and when the seller is asked for a better photo. Pure logic: no React, no network. Plus the strings in every locale.
const rec = require('../client/src/lib/sell/recognize.js');
const { INITIAL_FORM } = require('../client/src/lib/sell/form.js');

const F = (over = {}) => ({ ...INITIAL_FORM, productType: 'tcg', game: 'onepiece', ...over });
const PRINT = {
  external_id: 'OP17-061', name: 'Lead Performers', set_code: 'OP-17', set_name: "The World's Strongest Warriors",
  rarity: 'Rare', img_url: 'https://img/OP17-061.jpg', details: { localId: 'OP17-061', variant: null },
};
// what Gemini really read on the user's photo of this card: a name from the effect text and the wrong rarity
const READING = { code: 'OP17-061', name: 'ジャック', rarity: 'SR', language: 'ja' };

describe('when the camera button is offered', () => {
  test('only for a game the server recognises, and only when it is switched on', () => {
    const on = { enabled: true, games: ['onepiece'] };
    expect(rec.canRecognize('onepiece', on)).toBe(true);
    expect(rec.canRecognize('pokemon', on)).toBe(false);
    expect(rec.canRecognize('onepiece', { enabled: false, games: ['onepiece'] })).toBe(false);
    expect(rec.canRecognize('onepiece', null)).toBe(false);
    expect(rec.canRecognize('onepiece', { enabled: true })).toBe(false);
  });
});

describe('print kinds', () => {
  test.each([
    ['OP01-077', { kind: 'base', n: null }],
    ['OP01-077_p1', { kind: 'alt', n: '1' }],
    ['OP05-119_p12', { kind: 'alt', n: '12' }],
    ['ST10-005_r1', { kind: 'reprint', n: '1' }],
    ['', { kind: 'base', n: null }],
  ])('%s', (id, kind) => expect(rec.printKind(id)).toEqual(kind));
});

describe('the form filled by a recognised print', () => {
  test('title, number, rarity and expansion come from the catalog print, not from what was read', () => {
    const patch = rec.recognizedPatch(PRINT, READING, F());
    expect(patch).toMatchObject({
      cardExternalId: 'OP17-061', cardNumber: 'OP17-061', title: 'Lead Performers OP17-061', cardRarity: 'Rare',
      cardSetId: 'OP-17', cardSetName: "The World's Strongest Warriors",
    });
    expect(JSON.stringify(patch)).not.toContain('ジャック');
    expect(patch.cardRarity).not.toBe('SR');
  });

  test('the language printed on the card is used when the seller has not chosen one', () => {
    expect(rec.recognizedPatch(PRINT, READING, F()).cardLanguage).toBe('ja');
    expect(rec.recognizedPatch(PRINT, { ...READING, language: 'en' }, F()).cardLanguage).toBe('en');
  });

  test('a language typed by hand is kept; an unknown or missing one falls back to the catalog default', () => {
    expect(rec.recognizedPatch(PRINT, READING, F({ cardLanguage: 'it' })).cardLanguage).toBeUndefined();
    expect(rec.recognizedPatch(PRINT, { ...READING, language: 'xx' }, F()).cardLanguage).toBe('en');
    expect(rec.recognizedPatch(PRINT, null, F()).cardLanguage).toBe('en');
  });

  test('a rarity typed by hand is kept', () => {
    expect(rec.recognizedPatch(PRINT, READING, F({ cardRarity: 'Secret Rare' })).cardRarity).toBeUndefined();
  });
});

describe('messages', () => {
  const err = (status, code) => Object.assign(new Error('x'), { status, data: code ? { code } : null });

  test.each([
    [{ status: 'matched', prints: [PRINT], nameMatches: true }, 'matched'],
    [{ status: 'matched', prints: [PRINT], nameMatches: null }, 'matched'],
    [{ status: 'matched', prints: [PRINT], nameMatches: false }, 'check_name'],
    [{ status: 'matched', prints: [] }, 'unreadable'],
    [{ status: 'not_found', prints: [] }, 'not_found'],
    [{ status: 'unreadable', prints: [] }, 'unreadable'],
  ])('answer %o -> %s', (answer, key) => expect(rec.outcomeOf(answer, null)).toEqual({ kind: 'result', key }));

  test.each([
    [err(401), 'login'], [err(403), 'login'],
    [err(429, 'user_hourly_limit'), 'limit'], [err(429, 'user_daily_limit'), 'limit'], [err(429, 'site_daily_limit'), 'limit'],
    [err(413, 'too_large'), 'too_large'], [err(undefined, 'too_small'), 'too_small'], [err(400, 'bad_image'), 'bad_image'], [err(400, 'no_image'), 'bad_image'],
    [err(504, 'timeout'), 'generic'], [err(503, 'not_configured'), 'generic'], [new TypeError('Failed to fetch'), 'generic'],
  ])('error -> %#', (error, key) => expect(rec.outcomeOf(null, error)).toEqual({ kind: 'error', key }));
});

describe('asking for a better photo', () => {
  const matched = { status: 'matched', prints: [PRINT] };
  test('small or blurry photos are held back (they were misread into real codes: OP16-030 -> OP10-033, OP16-035 -> OP10-025)', () => {
    expect(rec.photoProblem({ small: true, blurry: true })).toBe('too_small');
    expect(rec.photoProblem({ small: false, blurry: true })).toBe('too_blurry');
    expect(rec.photoProblem({ small: false, blurry: false })).toBeNull();
    expect(rec.photoProblem(null)).toBeNull();
    expect(rec.outcomeOf(null, { data: { code: 'too_blurry' } })).toEqual({ kind: 'error', key: 'too_blurry' });
  });
  test('a blurry photo that matched: compare the image with the card before choosing', () => {
    expect(rec.outcomeOf({ ...matched, nameMatches: null }, null, { small: false, blurry: true })).toEqual({ kind: 'result', key: 'check_photo' });
    expect(rec.outcomeOf({ ...matched, nameMatches: null }, null, { small: false, blurry: false })).toEqual({ kind: 'result', key: 'matched' });
    expect(rec.outcomeOf({ ...matched, nameMatches: false }, null, { small: false, blurry: true })).toEqual({ kind: 'result', key: 'check_name' });
  });
  test('the code could not be read or matched', () => {
    expect(rec.needsBetterPhoto({ status: 'unreadable', prints: [] }, null)).toBe(true);
    expect(rec.needsBetterPhoto({ status: 'not_found', prints: [] }, { small: false, blurry: false })).toBe(true);
  });
  test('recognised, but the photo that goes in the listing is blurry or small', () => {
    expect(rec.needsBetterPhoto(matched, { small: false, blurry: true })).toBe(true);
    expect(rec.needsBetterPhoto(matched, { small: true, blurry: false })).toBe(true);
  });
  test('recognised and a good photo (or quality unknown): no nagging', () => {
    expect(rec.needsBetterPhoto(matched, { small: false, blurry: false })).toBe(false);
    expect(rec.needsBetterPhoto(matched, null)).toBe(false);
  });
});

describe('strings', () => {
  const LANGS = ['it', 'en', 'es', 'fr', 'de'];
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  const it = require('../client/src/locales/it.json').sell.recognize;

  test.each(LANGS)('%s has every sell.recognize key, none empty', (lang) => {
    const r = require(`../client/src/locales/${lang}.json`).sell.recognize;
    expect(keys(r).sort()).toEqual(keys(it).sort());
    for (const k of keys(r)) expect(k.split('.').reduce((o, x) => o[x], r)).toMatch(/\S/);
  });

  test('every message key the helpers can return exists', () => {
    for (const k of ['matched', 'check_name', 'check_photo', 'not_found', 'unreadable']) expect(it.result[k]).toBeTruthy();
    expect(it.try_anyway).toBeTruthy();
    for (const k of ['login', 'limit', 'too_large', 'too_small', 'too_blurry', 'bad_image', 'generic']) expect(it.error[k]).toBeTruthy();
    for (const k of ['base', 'alt', 'reprint']) expect(it.kind[k]).toBeTruthy();
  });

  test.each(LANGS)('%s privacy policy names the card recognition among the Gemini uses', (lang) => {
    const body = require(`../client/src/locales/${lang}.json`).privacy.s7_body;
    const line = body.split('\n').find((l) => l.includes('Gemini'));
    expect(line).toMatch(/(cart|card|Karte)/i);
  });

  test('no credit/money wording slipped in', () => {
    for (const lang of LANGS) {
      const text = JSON.stringify(require(`../client/src/locales/${lang}.json`).sell.recognize);
      expect(text).not.toMatch(/credit|€|euro/i);
    }
  });
});
