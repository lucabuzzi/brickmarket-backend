// Single source of truth for the "four pillars" accent system (see client/src/index.css for the
// matching CSS tokens: --color-pillar-listings, --color-pillar-auctions, --color-pillar-arena,
// --color-pillar-catalog). Gold (--accent / gold-* Tailwind classes) is reserved for header/nav
// chrome and primary CTA buttons — it is NOT one of the pillars and should not appear here.
//
// Import this instead of re-typing the hex values: components that only need a Tailwind class
// (not a raw JS value) should prefer the `pillar-listings` / `pillar-auctions` / `pillar-arena` /
// `pillar-catalog` utility classes generated from index.css instead of inline styles built from
// this file.
export const PILLARS = {
  listings: {
    id: 'listings',
    label: 'Annunci',
    accent: '#c6ff3d',
    accentInk: '#10140a',
  },
  auctions: {
    id: 'auctions',
    label: 'Aste',
    accent: '#ff5a36',
    accentInk: '#ffffff',
  },
  arena: {
    id: 'arena',
    label: 'Puzzle Arena',
    accent: '#8b5cf6',
    accentSecondary: '#22d3ee',
    accentInk: '#ffffff',
  },
  catalog: {
    id: 'catalog',
    label: 'Wiki',
    accent: '#3b82f6',
    accentInk: '#ffffff',
  },
};
