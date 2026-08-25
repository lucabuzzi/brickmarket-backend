// One-off script: renders a branded 1200x630 OG/Twitter card image to
// client/public/og-image.png using the existing sharp dependency (no new
// packages). Not part of the build — run manually if the artwork needs a refresh.
const sharp = require('sharp');
const path = require('path');

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#120a24"/>
      <stop offset="55%" stop-color="#2a0f5c"/>
      <stop offset="100%" stop-color="#4a1a94"/>
    </linearGradient>
    <radialGradient id="glowPurple" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7e14ff" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#7e14ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBlue" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#47bfff" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#47bfff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="980" cy="120" r="360" fill="url(#glowPurple)"/>
  <circle cx="120" cy="560" r="320" fill="url(#glowBlue)"/>

  <!-- brand mark, echoing favicon.svg's diamond silhouette -->
  <g transform="translate(90,225) scale(3.2)">
    <path fill="#d4af37" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
  </g>

  <text x="270" y="330" font-family="Arial, Helvetica, sans-serif" font-size="108" font-weight="900" fill="#ffffff" letter-spacing="-2">CardBrix</text>
  <text x="272" y="400" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="#d4af37" letter-spacing="2">LEGO &#183; TRADING CARDS &#183; AUCTIONS</text>
  <text x="272" y="450" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="400" fill="#c9bfe0">The marketplace for collectors. Buy, sell, bid and win.</text>
</svg>
`;

const outPath = path.join(__dirname, '..', 'client', 'public', 'og-image.png');

sharp(Buffer.from(svg))
  .png()
  .toFile(outPath)
  .then(() => console.log('Wrote', outPath))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
