/**
 * cardNames.js — tolerant comparison of a card name read on a photo with the catalog name, shared by every game the
 * card recognition supports. Pure functions, no I/O.
 */

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

module.exports = { nameKey, namesMatch, editDistance };
