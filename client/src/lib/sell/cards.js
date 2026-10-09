// Pure helpers for the trading-card side of the sell wizard (language, rarity, grading, guided photos).
// No React, no browser globals: imported by the Jest suite too.

/** Must match CARD_LANGUAGES / GRADING_COMPANIES in src/services/cardDetails.js (the server validates them). */
export const CARD_LANGUAGES = ['it', 'en', 'ja', 'de', 'fr', 'es', 'pt', 'ko', 'zh'];
export const GRADING_COMPANIES = ['psa', 'cgc', 'bgs', 'sgc', 'other'];
export const CARD_RARITY_MAX = 60;
export const CARD_GRADE_MAX = 10;

/** Front, back and corners are mandatory for a card listing made with the guided flow; the other two are optional. */
export const CARD_REQUIRED_SHOTS = 3;

const GENERIC_RARITIES = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Secret Rare', 'Promo'];
const RARITIES = {
  pokemon: ['Common', 'Uncommon', 'Rare', 'Holo Rare', 'Reverse Holo', 'Double Rare', 'Ultra Rare', 'Illustration Rare', 'Special Illustration Rare', 'Hyper Rare', 'Secret Rare', 'Promo'],
  magic: ['Common', 'Uncommon', 'Rare', 'Mythic Rare', 'Special', 'Promo'],
  yugioh: ['Common', 'Rare', 'Super Rare', 'Ultra Rare', 'Secret Rare', 'Ultimate Rare', 'Ghost Rare', 'Starlight Rare', "Collector's Rare", 'Prismatic Secret Rare'],
  lorcana: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Enchanted', 'Promo'],
  onepiece: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Secret Rare', 'Leader', 'Special', 'Promo'],
  dragonball: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Secret Rare', 'Special Rare', 'Promo'],
};

/** Rarity names worth suggesting for a game (free text is still allowed: sets use many more). */
export const raritySuggestions = (gameSlug) => RARITIES[gameSlug] || GENERIC_RARITIES;

const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "it" + "it-IT" -> "Italiano". Falls back to the upper-cased code when Intl cannot name it. */
export function languageName(code, locale = 'it') {
  try {
    const name = new Intl.DisplayNames([locale || 'it'], { type: 'language' }).of(code);
    return capitalise(name && name !== code ? name : String(code).toUpperCase());
  } catch {
    return String(code).toUpperCase();
  }
}

/** "psa" -> "PSA"; 'other' uses the translated label. */
export const gradingCompanyLabel = (id, otherLabel) => (id === 'other' ? otherLabel : String(id || '').toUpperCase());

/**
 * One-line facts for the review step: ["Italiano", "Holo Rare", "PSA 10"]. Blank parts are left out.
 * `labels` = { language: (code) => string, otherCompany: string }.
 */
export function cardSummaryParts(form, labels) {
  const parts = [];
  if (form.cardLanguage) parts.push(labels.language(form.cardLanguage));
  if (String(form.cardRarity || '').trim()) parts.push(String(form.cardRarity).trim());
  if (form.gradingCompany && String(form.cardGrade || '').trim()) {
    parts.push(`${gradingCompanyLabel(form.gradingCompany, labels.otherCompany)} ${String(form.cardGrade).trim()}`);
  }
  return parts;
}

/**
 * Which shot the guided flow asks for next, given how many photos there are.
 * -> { index, required, done } ; `done` once every position (up to `total`) has a photo.
 */
export function nextShot(photoCount, total) {
  const index = Math.min(Math.max(photoCount, 0), total - 1);
  return { index, required: photoCount < CARD_REQUIRED_SHOTS, done: photoCount >= total };
}

/** Grading company and grade go together (the server enforces the same). Returns an error code or null. */
export function gradingError(form) {
  const hasCompany = !!form.gradingCompany;
  const hasGrade = String(form.cardGrade || '').trim() !== '';
  if (hasCompany === hasGrade) return null;
  return hasCompany ? { field: 'cardGrade', code: 'grading_incomplete' } : { field: 'gradingCompany', code: 'grading_incomplete' };
}
