/**
 * cardRecognition.js — recognises a trading card from a photo, in two steps:
 *   1. a vision model reads what is PRINTED on the card (code or collector number, set code, name, language);
 *   2. that is checked against the game's public card database (recognition/<game>.js), which returns the real
 *      prints it matches.
 * Only a card that really exists becomes a result, so a misread or an invented answer never fills a listing; the
 * seller then picks the exact print (base, alternate art, reprint, rarity) among the real ones.
 *
 * The reader is swappable (`reader` option): Gemini today, a dedicated recognition API tomorrow.
 * The photo is never stored or logged: it lives in memory for the duration of the request.
 */

const sharp = require('sharp');
const { namesMatch } = require('./cardNames');
const { adapterFor, GAMES } = require('./recognition');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const TIMEOUT_MS = 15000;
const MAX_SIDE = 1024; // long side sent to the model: the code stays legible, the request stays small

/** What the model is told for one game: the shared rules around the game's own fields (recognition/<game>.js). */
function promptFor(adapter) {
  return [
    `You are reading a photo of a ${adapter.title} card for a marketplace listing.`,
    'Report only what is actually printed and legible on the card. Never guess or complete from memory.',
    ...adapter.prompt,
    '- language: the language the card text is printed in, as an ISO 639-1 code (en, it, ja, zh, ko, fr, de, es, pt, ...).',
    `- isCard: false if the photo does not show a ${adapter.title} card.`,
    'Use null for anything that is not clearly legible.',
  ].join('\n');
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isCard: { type: 'BOOLEAN' },
    code: { type: 'STRING', nullable: true },
    name: { type: 'STRING', nullable: true },
    number: { type: 'STRING', nullable: true },
    setCode: { type: 'STRING', nullable: true },
    rarity: { type: 'STRING', nullable: true },
    language: { type: 'STRING', nullable: true },
  },
  required: ['isCard', 'code', 'name', 'number', 'setCode', 'rarity', 'language'],
};

class RecognitionError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code; // 'not_configured' | 'bad_image' | 'provider_error' | 'rate_limited' | 'timeout' | 'unsupported_game'
  }
}

/** Upright (EXIF), long side <= 1024 px, JPEG, metadata (GPS included) dropped. */
async function prepareImage(buffer) {
  try {
    return await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    throw new RecognitionError('bad_image', 'The file is not a readable image.');
  }
}

const cleanText = (v, max) => {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  return s && !/^(null|unknown|n\/a)$/i.test(s) ? s : null;
};

/** The model's JSON -> { isCard, code, name, number, setCode, rarity, language }; anything malformed is null, never thrown. */
function parseReading(text) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  const language = cleanText(data.language, 8);
  return {
    isCard: data.isCard !== false,
    code: cleanText(data.code, 24),
    name: cleanText(data.name, 80),
    number: cleanText(data.number, 16),
    setCode: cleanText(data.setCode, 8),
    rarity: cleanText(data.rarity, 8),
    language: language && /^[a-z]{2}$/i.test(language) ? language.toLowerCase() : null,
  };
}

/**
 * Gemini reader: (JPEG buffer, { prompt }) -> { reading, usage }. Throws RecognitionError on configuration, network or
 * provider errors; a reply it cannot parse becomes reading = null.
 */
function geminiReader({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_VISION_MODEL || DEFAULT_MODEL, fetchImpl = fetch } = {}) {
  return async function read(jpeg, { prompt = promptFor(adapterFor('onepiece')) } = {}) {
    if (!apiKey) throw new RecognitionError('not_configured', 'GEMINI_API_KEY is not set.');
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
    };
    let res;
    try {
      res = await fetchImpl(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const timeout = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new RecognitionError(timeout ? 'timeout' : 'provider_error', timeout ? 'The reader took too long.' : 'The reader is unreachable.');
    }
    if (res.status === 429) throw new RecognitionError('rate_limited', 'The reader quota is exhausted.');
    if (!res.ok) throw new RecognitionError('provider_error', `The reader answered HTTP ${res.status}.`);
    const data = await res.json().catch(() => null);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('');
    const usage = data?.usageMetadata
      ? { inputTokens: data.usageMetadata.promptTokenCount ?? null, outputTokens: data.usageMetadata.candidatesTokenCount ?? null }
      : null;
    return { reading: parseReading(text), usage, model };
  };
}

/**
 * (game, photo) -> {
 *   status: 'matched'     the card exists: `prints` holds its real prints (the seller picks one)
 *         | 'not_found'   something was read but no card matches it: search by `reading.name`
 *         | 'unreadable'  no card, or nothing legible on it: retake the photo
 *   reading: what was read (`code` normalised, `rawCode` as read), nameMatches: the name read agrees with the
 *   catalog (null = no name read, or one that cannot be compared: another script or language),
 *   prints: master_cards-shaped rows, usage
 * }
 * The other options reach the game's adapter (fetchImpl, or One Piece's fetchPrints), so tests run offline.
 */
async function recognizeCard(game, buffer, { reader = geminiReader(), ...deps } = {}) {
  const adapter = adapterFor(game);
  if (!adapter) throw new RecognitionError('unsupported_game', `No card recognition for "${game}".`);
  const jpeg = await prepareImage(buffer);
  const { reading, usage } = await reader(jpeg, { prompt: promptFor(adapter) });
  const query = reading ? adapter.identify(reading) : null;
  const read = reading ? { ...reading, code: query?.code ?? null, rawCode: reading.code } : null;
  if (!reading || !reading.isCard || (!query && !reading.name)) {
    return { status: 'unreadable', reading: read, nameMatches: null, prints: [], usage };
  }
  const { prints = [], names = null, language = null } = await adapter.findPrints(reading, query, deps);
  if (language) read.language = language;
  if (!prints.length) return { status: 'not_found', reading: read, nameMatches: null, prints: [], usage };
  // a name in another script (a Japanese card) cannot be compared with a catalog in Latin letters
  const comparable = Boolean(reading.name) && /[a-z]/i.test(reading.name) && Array.isArray(names) && names.length > 0;
  const nameMatches = comparable ? names.some((n) => namesMatch(reading.name, n)) : null;
  return { status: 'matched', reading: read, nameMatches, prints, usage };
}

/** The One Piece recognition the sell page uses today (same result shape). */
const recognizeOnePiece = (buffer, options) => recognizeCard('onepiece', buffer, options);

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);
// opened to sellers only on purpose (CARD_RECOGNITION_ENABLED=1): on Gemini's free tier Google may use the photos
const isEnabled = () => isConfigured() && process.env.CARD_RECOGNITION_ENABLED === '1';

/**
 * The games offered to sellers: every game with an adapter, or only those listed in CARD_RECOGNITION_GAMES
 * ("onepiece,pokemon"), so one game can be switched off on Render without a deploy.
 */
function enabledGames() {
  const listed = String(process.env.CARD_RECOGNITION_GAMES || '').split(',').map((g) => g.trim().toLowerCase()).filter(Boolean);
  return listed.length ? GAMES.filter((g) => listed.includes(g)) : [...GAMES];
}

module.exports = {
  recognizeCard, recognizeOnePiece, promptFor, GAMES, enabledGames,
  geminiReader, prepareImage, parseReading, isConfigured, isEnabled, RecognitionError, DEFAULT_MODEL, MAX_SIDE,
};
