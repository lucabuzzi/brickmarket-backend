// Pure helpers for the "photograph the card" shortcut of the sell wizard (One Piece only for now): the photo is sent to
// POST /api/cards/recognize, which answers with every real print of the code printed on the card (see
// src/routes/cardRecognize.js); the seller picks the exact one and the form is filled from the CATALOG print. What the
// model read (name, rarity) is only a hint: it was seen to take a name from the card text, the code is what counts.
import { CARD_LANGUAGES } from './cards.js';
import { pickCardPatch } from './catalog.js';

/** Games the recognition knows (must match `games` of GET /api/cards/recognize/status). */
export const RECOGNIZE_GAMES = ['onepiece'];
export const canRecognize = (game, status) => !!status?.enabled && RECOGNIZE_GAMES.includes(game) && (status.games || []).includes(game);

/** Server limit on the photo (src/routes/cardRecognize.js). */
export const MAX_RECOGNIZE_BYTES = 10 * 1024 * 1024;

/**
 * Kind of a print, from its id: "OP01-077" base, "OP01-077_p2" alternate art n. 2, "OP01-077_r1" reprint n. 1.
 * -> { kind: 'base' | 'alt' | 'reprint', n }
 */
export function printKind(externalId) {
  const m = /_(p|r)(\d+)$/i.exec(String(externalId || ''));
  if (!m) return { kind: 'base', n: null };
  return { kind: m[1].toLowerCase() === 'p' ? 'alt' : 'reprint', n: m[2] };
}

/**
 * The form changes made by choosing a recognised print: the catalog picker's own (title, number, rarity from the
 * catalog, expansion), plus the language printed on the card when the seller has not set one and it is one we list.
 */
export function recognizedPatch(print, reading, form, game = 'onepiece') {
  const patch = pickCardPatch(print, null, form, game);
  const lang = String(reading?.language || '').toLowerCase();
  if (!form.cardLanguage && CARD_LANGUAGES.includes(lang)) patch.cardLanguage = lang;
  return patch;
}

/**
 * Why a photo is not worth sending, by the photo step's soft checks (lib/sell/quality.js): small or blurry photos were
 * misread into codes that exist (OP16-030 -> OP10-033 at 300 px, OP16-035 -> OP10-025 blurred), so the wrong card would
 * have been offered. A small photo is never sent; a blurry one only if the seller insists (the check can be wrong).
 * -> 'too_small' | 'too_blurry' | null
 */
export function photoProblem(quality) {
  if (quality?.small) return 'too_small';
  if (quality?.blurry) return 'too_blurry';
  return null;
}

/**
 * Which message to show for a recognition answer or error. Keys of `sell.recognize.result.*` / `sell.recognize.error.*`.
 * A blurry photo that still matched asks the seller to compare the catalog image with the card in hand.
 * -> { kind: 'result' | 'error', key }
 */
export function outcomeOf(answer, error, quality = null) {
  if (error) {
    const code = error.data?.code;
    if (error.status === 401 || error.status === 403) return { kind: 'error', key: 'login' };
    if (['user_hourly_limit', 'user_daily_limit', 'site_daily_limit'].includes(code)) return { kind: 'error', key: 'limit' };
    if (code === 'too_large') return { kind: 'error', key: 'too_large' };
    if (code === 'too_small' || code === 'too_blurry') return { kind: 'error', key: code };
    if (code === 'bad_image' || code === 'no_image') return { kind: 'error', key: 'bad_image' };
    return { kind: 'error', key: 'generic' };
  }
  if (answer?.status === 'matched' && answer.prints?.length) {
    if (answer.nameMatches === false) return { kind: 'result', key: 'check_name' };
    return { kind: 'result', key: quality?.blurry ? 'check_photo' : 'matched' };
  }
  if (answer?.status === 'not_found') return { kind: 'result', key: 'not_found' };
  return { kind: 'result', key: 'unreadable' };
}

/**
 * Whether to ask the seller for a better photo: the code could not be read, or the photo (which also becomes the
 * listing's first photo) is small or blurry by the same soft checks as the photo step (lib/sell/quality.js).
 * `quality` is analyzePhoto()'s result, null when unknown.
 */
export function needsBetterPhoto(answer, quality) {
  if (!answer || answer.status !== 'matched') return true;
  return !!(quality && (quality.small || quality.blurry));
}
