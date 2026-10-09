// Pure helpers for the Pokémon catalog picker of the sell wizard (expansion -> card). No React, no browser globals.
// Data shapes are the ones of GET /api/catalog/pokemon/sets and /sets/:id (see services/tcgdex.js).

/** Italian UI -> Italian names; every other language -> English names (the catalog has both), falling back to the other. */
export function setDisplayName(set, language = 'it') {
  const it = String(language || '').toLowerCase().startsWith('it');
  return (it ? set.name || set.name_en : set.name_en || set.name) || set.id;
}

export function seriesDisplayName(series, language = 'it') {
  const it = String(language || '').toLowerCase().startsWith('it');
  return (it ? series.name || series.name_en : series.name_en || series.name) || '';
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Keeps the expansions whose name (either language) or id contains the query; drops series left empty.
 * An empty query returns everything unchanged.
 */
export function filterSeries(series, query) {
  const q = norm(query);
  if (!q) return series;
  return series
    .map((s) => ({ ...s, sets: s.sets.filter((x) => [x.name, x.name_en, x.id, s.name, s.name_en].some((v) => norm(v).includes(q))) }))
    .filter((s) => s.sets.length > 0);
}

/** "029" -> "29": the collector number without padding zeros ("TG05" and the like stay as they are). */
export const trimNumber = (localId) => (/^\d+$/.test(String(localId ?? '')) ? String(parseInt(localId, 10)) : String(localId ?? ''));

/** Collector number as printed on the card: "29/128" (or just "TG05" when the set has no official total). */
export function cardNumberLabel(localId, officialCount) {
  const n = trimNumber(localId);
  if (!n) return '';
  return /^\d+$/.test(n) && officialCount ? `${n}/${officialCount}` : n;
}

/**
 * Cards of the chosen expansion matching the query by name or number. Capped, so a 200-card list stays light.
 * -> { cards, total } where total counts every match (so the UI can say "refine the search").
 */
export function filterCards(cards, query, limit = 40) {
  const q = norm(query);
  const matches = !q ? cards : cards.filter((c) => norm(c.name).includes(q) || norm(c.details?.localId).includes(q) || trimNumber(c.details?.localId) === q.replace(/^0+/, ''));
  return { cards: matches.slice(0, limit), total: matches.length };
}

/**
 * The form changes made by choosing a card in the picker. The title is always set (the seller just picked it);
 * rarity and language only fill what is still empty, so a value typed by hand is never overwritten.
 * `card` is the full card (with rarity) when known, else the list row.
 */
export function pickCardPatch(card, set, form) {
  const number = cardNumberLabel(card.details?.localId, set?.card_count_official);
  return {
    cardSetId: set?.id || card.set_code || '',
    cardSetName: set ? setDisplayName(set, 'it') : card.set_name || '',
    cardExternalId: card.external_id,
    cardNumber: number,
    title: `${card.name}${number ? ` ${number}` : ''}`,
    ...(form.cardRarity || !card.rarity ? {} : { cardRarity: card.rarity }),
    ...(form.cardLanguage ? {} : { cardLanguage: 'it' }),
  };
}

/** What choosing another expansion (or none) clears: the card chosen in the previous one. */
export const clearCardPatch = () => ({ cardExternalId: '', cardNumber: '' });
