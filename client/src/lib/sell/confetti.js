// A small, deterministic burst of confetti for the "published!" screen: the same seed always gives the same
// pieces, so it is testable and never flickers between renders. Colours are the pillar palette (no gold: gold
// belongs to the header and the primary buttons).
export const CONFETTI_COLORS = ['#c6ff3d', '#e4ff8f', '#8b5cf6', '#22d3ee', '#ff5a36', '#3b82f6'];

// mulberry32: tiny seeded generator, enough for decoration
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @returns {{ id:number, x:number, drift:number, delay:number, duration:number, rotate:number, size:number, color:string, round:boolean }[]}
 *  x = start position in % of the width, drift = sideways travel in px, delay/duration in seconds, size in px
 */
export function confettiPieces(count = 36, seed = 7) {
  const rand = rng(seed);
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, id) => ({
    id,
    x: Math.round(rand() * 100),
    drift: Math.round((rand() - 0.5) * 160),
    delay: Math.round(rand() * 60) / 100,
    duration: 1.6 + Math.round(rand() * 120) / 100,
    rotate: Math.round(rand() * 720 - 360),
    size: 6 + Math.round(rand() * 6),
    color: CONFETTI_COLORS[Math.floor(rand() * CONFETTI_COLORS.length)],
    round: rand() > 0.6,
  }));
}
