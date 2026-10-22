/**
 * The games the card recognition can read, each an adapter with the same shape:
 *   game, title          the catalog key and the name the model is told
 *   prompt               what to read on this game's cards (the reading fields: code, name, number, setCode, rarity)
 *   identify(reading)    the identifiers read, cleaned (null when nothing usable was read besides the name)
 *   findPrints(reading, query, deps) -> { prints, names, language? }
 *                        the real prints in the public database (master_cards rows); `names` are what the name read
 *                        is compared with (null: not comparable), `language` overrides the one the model read
 *   keysOf(print), sample(key)   the trial script's scoring and synthetic photos
 * Dragon Ball is not here yet: its catalog needs an apitcg.com key (APITCG_API_KEY) to look a code up.
 */

const ADAPTERS = Object.freeze({
  onepiece: require('./onepiece'),
  magic: require('./magic'),
  pokemon: require('./pokemon'),
  yugioh: require('./yugioh'),
  lorcana: require('./lorcana'),
});

const adapterFor = (game) => (Object.prototype.hasOwnProperty.call(ADAPTERS, game) ? ADAPTERS[game] : null);

module.exports = { ADAPTERS, adapterFor, GAMES: Object.keys(ADAPTERS) };
