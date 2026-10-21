/**
 * cardRecognition.js — recognises a One Piece Card Game card from a photo, in two steps:
 *   1. a vision model reads what is PRINTED on the card (code at the bottom right, name, rarity, language);
 *   2. the code is checked against the public card database (onepiecePrints.js), which returns every print of it.
 * Only a code that really exists becomes a result, so a misread or an invented answer never fills a listing; the
 * seller then picks the exact print (base, alternate art, reprint) among the real ones.
 *
 * The reader is swappable (`reader` option): Gemini today, a dedicated recognition API tomorrow.
 * The photo is never stored or logged: it lives in memory for the duration of the request.
 */

const sharp = require('sharp');
const { normalizeCode, namesMatch } = require('./onepieceCode');
const { fetchPrintsByCode } = require('./onepiecePrints');
const { mapOnePieceCard } = require('./onepieceCards');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const TIMEOUT_MS = 15000;
const MAX_SIDE = 1024; // long side sent to the model: the code stays legible, the request stays small

const PROMPT = [
  'You are reading a photo of a One Piece Card Game trading card for a marketplace listing.',
  'Report only what is actually printed and legible on the card. Never guess or complete from memory.',
  '- code: the card number printed at the bottom right, e.g. "OP01-077", "ST10-005", "EB01-012", "PRB01-001", "P-034".',
  '- name: the character or card name as printed.',
  '- rarity: the rarity mark printed next to the code (C, UC, R, SR, SEC, L, SP, P, TR), if legible.',
  '- language: the language the card text is printed in, as an ISO 639-1 code (en, ja, zh, ko, fr, ...).',
  '- isCard: false if the photo does not show a One Piece Card Game card.',
  'Use null for anything that is not clearly legible.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isCard: { type: 'BOOLEAN' },
    code: { type: 'STRING', nullable: true },
    name: { type: 'STRING', nullable: true },
    rarity: { type: 'STRING', nullable: true },
    language: { type: 'STRING', nullable: true },
  },
  required: ['isCard', 'code', 'name', 'rarity', 'language'],
};

class RecognitionError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code; // 'not_configured' | 'bad_image' | 'provider_error' | 'rate_limited' | 'timeout'
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

/** The model's JSON -> { isCard, code, name, rarity, language }; anything malformed becomes null, never thrown. */
function parseReading(text) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  const language = cleanText(data.language, 8);
  return {
    isCard: data.isCard !== false,
    code: cleanText(data.code, 24),
    name: cleanText(data.name, 80),
    rarity: cleanText(data.rarity, 8),
    language: language && /^[a-z]{2}$/i.test(language) ? language.toLowerCase() : null,
  };
}

/**
 * Gemini reader: JPEG buffer -> { reading, usage }. Throws RecognitionError on configuration, network or provider
 * errors; a reply it cannot parse becomes reading = null.
 */
function geminiReader({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_VISION_MODEL || DEFAULT_MODEL, fetchImpl = fetch } = {}) {
  return async function read(jpeg) {
    if (!apiKey) throw new RecognitionError('not_configured', 'GEMINI_API_KEY is not set.');
    const body = {
      contents: [{ role: 'user', parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } }] }],
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
 * Photo -> {
 *   status: 'matched'     the code exists: `prints` holds every print of it (the seller picks one)
 *         | 'not_found'   a code or a name was read but no card has that code: search by `reading.name`
 *         | 'unreadable'  no card, or nothing legible on it: retake the photo
 *   reading: what was read (code normalised), nameMatches: the name read agrees with the catalog (null = no name read),
 *   prints: master_cards-shaped rows (onepieceCards.mapOnePieceCard), usage
 * }
 */
async function recognizeOnePiece(buffer, { reader = geminiReader(), fetchPrints = fetchPrintsByCode } = {}) {
  const jpeg = await prepareImage(buffer);
  const { reading, usage } = await reader(jpeg);
  const code = reading ? normalizeCode(reading.code) : null;
  const read = reading ? { ...reading, code, rawCode: reading.code } : null;
  if (!reading || !reading.isCard || (!code && !reading.name)) {
    return { status: 'unreadable', reading: read, nameMatches: null, prints: [], usage };
  }
  const rows = code ? await fetchPrints(code) : [];
  if (!rows.length) return { status: 'not_found', reading: read, nameMatches: null, prints: [], usage };
  const prints = rows.map(mapOnePieceCard);
  const nameMatches = reading.name ? prints.some((p) => namesMatch(reading.name, p.name)) : null;
  return { status: 'matched', reading: read, nameMatches, prints, usage };
}

const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

module.exports = {
  recognizeOnePiece, geminiReader, prepareImage, parseReading, isConfigured, RecognitionError, DEFAULT_MODEL, MAX_SIDE,
};
