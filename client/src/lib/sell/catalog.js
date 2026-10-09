// Pure helpers for the Pokémon catalog picker of the sell wizard (expansion -> card). No React, no browser globals.
// Data shapes are the ones of GET /api/catalog/<game>/sets and /sets/:id (see services/cardSets.js).

/** Games that have an expansion catalog (must match SET_GAMES in src/services/cardDetails.js). */
export const CATALOG_GAMES = ['pokemon', 'magic', 'onepiece', 'yugioh', 'lorcana'];
export const hasCatalog = (game) => CATALOG_GAMES.includes(game);

/** Language a card picked from a game's catalog is printed in (TCGdex is read in Italian, the others in English). */
const CATALOG_LANGUAGE = { pokemon: 'it', magic: 'en', onepiece: 'en', yugioh: 'en', lorcana: 'en' };

/**
 * Yu-Gi-Oh! (YGOPRODeck) asks not to link its images directly, so its card list shows no thumbnails (the one reference
 * picture after choosing a card stays). Every other catalog shows them.
 */
export const showThumbnails = (game) => game !== 'yugioh';

/** Games where one card has several prints that differ by code and rarity: the rarity is shown in the list. */
export const isPrintGame = (game) => game === 'yugioh';

/** An example expansion for the search box of each game. */
export const SET_EXAMPLE = { pokemon: '30° Anniversario', magic: 'Bloomburrow', onepiece: 'Romance Dawn', yugioh: 'Legend of Blue Eyes', lorcana: 'The First Chapter' };

/**
 * Logo URL of an expansion. TCGdex gives it without a file extension (the image is `<url>.webp`); the other sources
 * give a complete URL.
 */
export function setLogoSrc(logo) {
  if (!logo) return '';
  return /assets\.tcgdex\.net/.test(logo) && !/\.[a-z0-9]{3,4}$/i.test(logo) ? `${logo}.webp` : logo;
}

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

/** The expansion with this id (case-insensitive) out of the grouped series, or null. */
export function findSet(series, id) {
  const wanted = String(id || '').toLowerCase();
  for (const s of series || []) for (const x of s.sets) if (String(x.id).toLowerCase() === wanted) return x;
  return null;
}

/** "029" -> "29": the collector number without padding zeros ("TG05" and the like stay as they are). */
export const trimNumber = (localId) => (/^\d+$/.test(String(localId ?? '')) ? String(parseInt(localId, 10)) : String(localId ?? ''));

/**
 * Collector number as printed on the card. Pokémon: "29/128" (or just "TG05" when the set has no official total).
 * Magic and One Piece carry no printed total in their catalogs, so the number alone: "1", "OP01-077".
 */
export function cardNumberLabel(localId, officialCount, game = 'pokemon') {
  const n = trimNumber(localId);
  if (!n) return '';
  if (game !== 'pokemon') return n;
  return /^\d+$/.test(n) && officialCount ? `${n}/${officialCount}` : n;
}

/** The number as it reads in a title: "29/128", "#1" (a bare Magic number), "OP01-077". */
export const titleNumber = (number, game = 'pokemon') => (game === 'magic' && /^\d+$/.test(number) ? `#${number}` : number);

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
export function pickCardPatch(card, set, form, game = 'pokemon') {
  const number = cardNumberLabel(card.details?.localId, set?.card_count_official, game);
  const inTitle = titleNumber(number, game);
  return {
    cardSetId: set?.id || card.set_code || '',
    cardSetName: set ? setDisplayName(set, 'it') : card.set_name || '',
    cardExternalId: card.external_id,
    cardNumber: number,
    title: `${card.name}${inTitle ? ` ${inTitle}` : ''}`,
    ...(form.cardRarity || !card.rarity ? {} : { cardRarity: card.rarity }),
    // a print carries its own language (Yu-Gi-Oh! reads it from the print code), else the game's default
    ...(form.cardLanguage ? {} : { cardLanguage: card.details?.language || CATALOG_LANGUAGE[game] || 'it' }),
  };
}

/** What choosing another expansion (or none) clears: the card chosen in the previous one. */
export const clearCardPatch = () => ({ cardExternalId: '', cardNumber: '' });
