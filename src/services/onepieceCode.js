/**
 * onepieceCode.js — the card code printed on a One Piece Card Game card (bottom right: "OP01-077", "ST10-005",
 * "EB01-012", "PRB01-001", "P-034") as read from a photo, cleaned of the usual reading mistakes, plus a tolerant
 * comparison of the name read with the catalog name (cardNames.js). Pure functions, no I/O.
 */

const { nameKey, namesMatch } = require('./cardNames');

// letters a reader confuses with digits, only applied where the code must have a digit
const DIGIT_LOOKALIKES = { O: '0', Q: '0', D: '0', I: '1', L: '1', '|': '1', Z: '2', S: '5', B: '8', G: '6' };
const toDigits = (s) => s.split('').map((c) => DIGIT_LOOKALIKES[c] || c).join('');

const DASHES = /[‐-―−_.]/g; // hyphen-like characters and the separators a reader may put instead

/**
 * Text read on a card -> the canonical code ("OP01-077"), or null when no plausible code is in it.
 * Accepts lower case, spaces, other dashes, a missing dash and O/I/S-for-digit mistakes in the numeric parts.
 */
function normalizeCode(raw) {
  if (raw == null) return null;
  const s = String(raw).toUpperCase().replace(DASHES, '-').replace(/\s+/g, '');
  // set cards: OP / ST / EB / PRB (+ OP misread as 0P), two digits, three digits
  let m = /(PRB|OP|0P|ST|5T|EB)([0-9OQDILZSBG|]{2})-?([0-9OQDILZSBG|]{3})(?![0-9])/.exec(s);
  if (m) {
    const prefix = { '0P': 'OP', '5T': 'ST' }[m[1]] || m[1];
    return `${prefix}${toDigits(m[2])}-${toDigits(m[3])}`;
  }
  // promos: P-034 (the dash is printed; without it "P034" is still accepted)
  m = /(?:^|[^A-Z])P-?([0-9OQDILZSBG|]{3})(?![0-9])/.exec(s);
  if (m) return `P-${toDigits(m[1])}`;
  return null;
}

/** Which public list a code belongs to: 'promo' (P-xxx), 'starter' (STxx-xxx) or 'set' (OP / EB / PRB). */
function codeKind(code) {
  if (/^P-\d{3}$/.test(code)) return 'promo';
  if (/^ST\d{2}-\d{3}$/.test(code)) return 'starter';
  if (/^(OP|EB|PRB)\d{2}-\d{3}$/.test(code)) return 'set';
  return null;
}

module.exports = { normalizeCode, codeKind, nameKey, namesMatch };
