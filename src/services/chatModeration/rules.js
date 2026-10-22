/**
 * Layer 1 of the plaza chat moderation: fixed rules, instant and free, that no model can talk its way around.
 * Pure (no I/O): the banned terms come from the database through the caller (gameChatRepository.js).
 *
 *   check(text, { terms }) -> null (passes) | { category, detail }
 *     category: 'link' (outside cardbrix.com) | 'phone' | 'email' | 'banned_word'
 *     detail:   what matched, for the admin log only (never sent to other players)
 */

const { fold, words, termPattern } = require('./normalize');

const SITE_DOMAINS = ['cardbrix.com'];

// TLDs worth catching without "http"/"www": the common ones, plus those of the countries CardBrix sells to. A
// whitelist on purpose: "ciao.come stai" or "ok.ma" are not links.
const TLDS = [
  'com', 'net', 'org', 'info', 'biz', 'io', 'co', 'me', 'app', 'dev', 'gg', 'tv', 'ly', 'to', 'xyz', 'shop', 'store',
  'online', 'site', 'link', 'live', 'club', 'eu', 'it', 'de', 'fr', 'es', 'uk', 'ch', 'at', 'nl', 'be', 'pt', 'pl', 'ru', 'us', 'cn',
];
// a bare dot only without spaces ("finito. It was" is a sentence), the spelled-out forms with or without them
const DOT = String.raw`(?:\.|\s*[([]\s*(?:dot|punto|punkt|point)\s*[)\]]\s*|\s+(?:dot|punto|punkt|point)\s+)`;
const DOMAIN = new RegExp(String.raw`([a-z0-9][a-z0-9-]{0,62})${DOT}(${TLDS.join('|')})(?![a-z0-9])`, 'gi');
const SCHEME = /\b(?:https?|ftp)\s*:\s*\/\/|\bwww\s*\./i;

const AT = String.raw`(?:@|＠|\(\s*at\s*\)|\[\s*at\s*\]|\s+at\s+|\s*chiocciola\s*|\s*arroba\s*|\s*arobase\s*|\s*klammeraffe\s*)`;
const EMAIL = new RegExp(String.raw`[a-z0-9._%+-]+${AT}[a-z0-9-]+${DOT}[a-z]{2,}`, 'i');
// a mail provider named in the message is a contact being given out, with or without the "@"
const PROVIDERS = /\b(?:gmail|googlemail|hotmail|outlook|yahoo|libero|icloud|protonmail|proton\s*me|tiscali|virgilio|aol|gmx|yandex)\b/i;

// numbers written as words, so "tre tre otto..." counts as digits
const NUMBER_WORDS = {
  zero: 0, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  cero: 0, dos: 2, cuatro: 4, seis: 6, siete: 7, ocho: 8, nueve: 9,
  un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, sept: 7, huit: 8, neuf: 9,
  null: 0, eins: 1, zwei: 2, drei: 3, vier: 4, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9,
};
const MIN_PHONE_DIGITS = 9;

/** Any link that does not point at the site itself. */
function findLink(text) {
  const s = fold(text);
  // overlapping on purpose: "cardbrix.com.ru" is "cardbrix.com" AND "com.ru"
  const domains = [];
  const re = new RegExp(DOMAIN.source, 'gi');
  let m;
  while ((m = re.exec(s))) {
    domains.push(`${m[1]}.${m[2]}`);
    re.lastIndex = m.index + m[0].length - m[2].length;
  }
  const outside = domains.find((d) => !SITE_DOMAINS.includes(d));
  if (outside) return outside;
  // "https://" or "www." with no domain recognised (an unusual TLD): a link all the same
  if (SCHEME.test(s) && !domains.length) return s.match(SCHEME)[0];
  return null;
}

function findEmail(text) {
  const s = fold(text);
  const m = s.match(EMAIL);
  if (m) return m[0];
  const p = s.match(PROVIDERS);
  return p ? p[0] : null;
}

/**
 * A phone number: at least 9 digits in a row, separated at most by spaces, dots, dashes, slashes or brackets, and
 * starting like a phone number does (+, 00, 0 or 3: Italian landlines and mobiles). "150 200 300" (prices) passes,
 * "333 123 4567", "+39 06...", "tre tre tre uno due..." do not.
 */
function findPhone(text) {
  const tokens = fold(text).replace(/[a-z]+/g, (w) => (w in NUMBER_WORDS ? ` ${NUMBER_WORDS[w]} ` : ` ${w} `));
  const runs = tokens.match(/\+?[\d(][\d\s.\-/()]*\d/g) || [];
  for (const run of runs) {
    const digits = run.replace(/\D/g, '');
    if (digits.length < MIN_PHONE_DIGITS) continue;
    if (run.trim().startsWith('+') || /^(00|0|3)/.test(digits)) return run.trim().replace(/\s+/g, ' ');
  }
  return null;
}

/** The first banned term found in the message (terms: the admin's list, as stored). */
function findBannedTerm(text, terms = []) {
  const w = words(text);
  for (const term of terms) {
    const pattern = termPattern(term);
    if (!pattern) continue;
    const n = pattern.words.length;
    for (let i = 0; i + n <= w.length; i++) {
      let hit = true;
      for (let j = 0; j < n; j++) {
        const word = w[i + j];
        const want = pattern.words[j];
        const last = j === n - 1;
        if (!(word === want || (last && pattern.prefix && word.startsWith(want)))) { hit = false; break; }
      }
      if (hit) return term;
    }
    // "porcodio" written as one word: the joined form of a multi-word term
    if (n > 1) {
      const joined = pattern.words.join('');
      if (w.some((word) => word === joined || (pattern.prefix && word.startsWith(joined)))) return term;
    }
  }
  return null;
}

function check(text, { terms = [] } = {}) {
  let detail;
  if ((detail = findEmail(text))) return { category: 'email', detail };
  if ((detail = findLink(text))) return { category: 'link', detail };
  if ((detail = findPhone(text))) return { category: 'phone', detail };
  if ((detail = findBannedTerm(text, terms))) return { category: 'banned_word', detail };
  return null;
}

module.exports = { check, findLink, findEmail, findPhone, findBannedTerm, SITE_DOMAINS };
