/**
 * ygoprodeckCards.js — Yu-Gi-Oh! print codes and the mapping of raw YGOPRODeck cards to master_cards rows (one row per
 * print). Pure (no DB, no network), so both the catalog (ygoprodeck.js) and the card recognition (recognition/yugioh.js)
 * can use it.
 */

function slugify(name) {
  return String(name || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** "LOB-EN001" -> en, "LOB-I001" -> it, "LOB-001" -> en (the region letters sit between the dash and the digits). */
const REGION_LANGUAGE = { EN: 'en', E: 'en', AE: 'en', F: 'fr', FR: 'fr', G: 'de', DE: 'de', I: 'it', IT: 'it', S: 'es', SP: 'es', P: 'pt', PT: 'pt', J: 'ja', JP: 'ja', K: 'ko', KR: 'ko' };
function languageOfPrintCode(code) {
  const m = /^[A-Z0-9]+-([A-Z]{1,2})\d+/i.exec(String(code || ''));
  return (m && REGION_LANGUAGE[m[1].toUpperCase()]) || 'en';
}

const sanitizeIdPart = (s) => String(s || '').replace(/[^A-Za-z0-9._-]/g, '');

/**
 * One row per PRINT of a card in this expansion (code + rarity), not per card: a seller sells one specific print.
 * The id is "<card id>_<print code>_<rarity code>", e.g. 89631139_LOB-EN001_UR.
 */
function mapYugiohPrints(cards, set) {
  const rows = [];
  for (const card of Array.isArray(cards) ? cards : []) {
    for (const p of card.card_sets || []) {
      if (String(p.set_name).toLowerCase() !== String(set.name).toLowerCase()) continue;
      const rarityCode = sanitizeIdPart(p.set_rarity_code) || sanitizeIdPart(p.set_rarity).slice(0, 8) || 'X';
      rows.push({
        external_id: `${card.id}_${sanitizeIdPart(p.set_code)}_${rarityCode}`,
        name: card.name,
        set_code: set.id,
        set_name: set.name,
        rarity: p.set_rarity || null,
        img_url: card.card_images?.[0]?.image_url || null,
        details: {
          localId: p.set_code || null,
          language: languageOfPrintCode(p.set_code),
          cardId: card.id,
          type: card.type || null,
          race: card.race || null,
          attribute: card.attribute || null,
          level: card.level ?? null,
          atk: card.atk ?? null,
          def: card.def ?? null,
          desc: card.desc || null,
        },
      });
    }
  }
  return rows;
}

module.exports = { slugify, languageOfPrintCode, sanitizeIdPart, mapYugiohPrints, REGION_LANGUAGE };
