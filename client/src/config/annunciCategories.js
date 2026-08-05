// Category registry for the /annunci and /aste (listings/auctions) hubs — mirrors
// the visual language of client/src/config/catalogGames.js (same emoji/accent per
// game) so the marketplace and the reference catalog feel like one system.
// `name` values are brand/product names (not translated); `nameKey`/`taglineKey`
// point into the `hubs.categories` i18n namespace and are resolved via t().
export const ANNUNCI_TOP_CATEGORIES = [
  {
    slug: 'lego',
    name: 'LEGO',
    emoji: '🧱',
    accent: 'blue',
    taglineKey: 'hubs.categories.lego_tagline',
  },
  {
    slug: 'carte-collezionabili',
    nameKey: 'hubs.categories.carte_name',
    emoji: '🎴',
    accent: 'purple',
    taglineKey: 'hubs.categories.carte_tagline',
  },
  {
    slug: 'funko',
    name: 'Funko Pop!',
    emoji: '🧸',
    accent: 'rose',
    taglineKey: 'hubs.categories.funko_tagline',
  },
];

export const ANNUNCI_CARD_GAMES = [
  { slug: 'pokemon', name: 'Pokémon', emoji: '⚡', accent: 'emerald' },
  { slug: 'magic', name: 'Magic: The Gathering', emoji: '🔮', accent: 'purple' },
  { slug: 'lorcana', name: 'Disney Lorcana', emoji: '✨', accent: 'purple' },
  { slug: 'yugioh', name: 'Yu-Gi-Oh!', emoji: '🎴', accent: 'amber' },
  { slug: 'onepiece', name: 'One Piece Card Game', emoji: '🏴‍☠️', accent: 'rose' },
  { slug: 'dragonball', name: 'Dragon Ball Super Card Game', emoji: '🐉', accent: 'amber' },
];

export const getAnnunciCardGame = (slug) => ANNUNCI_CARD_GAMES.find((g) => g.slug === slug) || null;
