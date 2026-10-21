/**
 * onepieceCode.js — the card code printed on a One Piece Card Game card (bottom right: "OP01-077", "ST10-005",
 * "EB01-012", "PRB01-001", "P-034") as read from a photo, cleaned of the usual reading mistakes, plus a tolerant
 * comparison of the name read with the catalog name. Pure functions, no I/O (tests/onepiece-code.test.js).
 */

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

const ABBREVIATIONS = /\b(monkey|d|portgas|trafalgar|roronoa|vinsmoke|charlotte|donquixote|boa)\b/g;

/** Name reduced for comparison: lower case, no accents, no "(Alternate Art)"-style tags, no punctuation. */
function nameKey(name) {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Does the name read on the photo match the catalog name? Tolerant of tags ("Perona (Box Topper)"), punctuation
 * ("Monkey.D.Luffy"), a missing first name ("Luffy" vs "Monkey.D.Luffy") and one or two misread letters.
 */
function namesMatch(read, catalog) {
  const a = nameKey(read);
  const b = nameKey(catalog);
  if (!a || !b) return false;
  if (a === b) return true;
  const core = (s) => s.replace(ABBREVIATIONS, ' ').replace(/\s+/g, ' ').trim();
  const ca = core(a);
  const cb = core(b);
  if (ca && cb && (ca === cb || cb.endsWith(` ${ca}`) || ca.endsWith(` ${cb}`))) return true;
  return editDistance(ca || a, cb || b) <= Math.max(1, Math.floor(Math.min(a.length, b.length) / 8));
}

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

module.exports = { normalizeCode, codeKind, nameKey, namesMatch };
