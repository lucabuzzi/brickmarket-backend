/**
 * Text normalisation for the plaza chat filters (rules.js). Pure, no I/O.
 *
 * The same function is applied to the message and to each banned term, so they meet halfway whatever trick was used:
 *   "P0RC0", "pòrco", "porcooo", "p o r c o", "p.o.r.c.o", "p-o-r-c-o"  -> "porco"
 * Doubled letters are collapsed on BOTH sides ("cazzo" -> "cazo"), which is what lets "cazzzzo" meet "cazzo".
 */

// digits and symbols commonly used in place of letters
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '€': 'e', '!': 'i', '|': 'i' };

/** Lower case, no accents, no zero-width or look-alike tricks. Keeps digits and punctuation (links/phones need them). */
function fold(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents
    .replace(/[​-‏⁠﻿­]/g, '') // zero-width characters, soft hyphen
    .toLowerCase();
}

/**
 * Words of a message, as compared with the banned terms: letters only, look-alikes mapped, repeated letters collapsed,
 * and runs of single letters ("p o r c o", "p.o.r.c.o") joined back into one word.
 */
function words(text) {
  const mapped = fold(text).replace(/[0-9@$€!|]/g, (c) => LEET[c] || c);
  const raw = mapped.split(/[^a-z]+/).filter(Boolean);
  const out = [];
  let run = '';
  for (const w of raw) {
    if (w.length === 1) { run += w; continue; }
    if (run) { out.push(run); run = ''; }
    out.push(w);
  }
  if (run) out.push(run);
  return out.map(collapse);
}

/** "porcooo" -> "porco", "cazzo" -> "cazo". */
const collapse = (w) => w.replace(/([a-z])\1+/g, '$1');

/**
 * A banned term as stored by the admin -> what words() is compared with:
 *   { words: ['porco', 'dio'], prefix: false }   "porco dio" (any separator, any trick between the words)
 *   { words: ['stronz'], prefix: true }          "stronz*" also matches stronzo, stronza, stronzate
 * null for an empty term.
 */
function termPattern(term) {
  const s = String(term ?? '').trim();
  const prefix = s.endsWith('*');
  const w = words(prefix ? s.slice(0, -1) : s);
  return w.length ? { words: w, prefix } : null;
}

module.exports = { fold, words, collapse, termPattern, LEET };
