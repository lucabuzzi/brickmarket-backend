/**
 * http.js — the one way the card recognition asks a public card database: JSON or null, never a throw, with a
 * timeout, so a database that is down or slow becomes "not found" instead of a failed recognition.
 */

const TIMEOUT_MS = 8000;

async function fetchJson(url, { fetchImpl = fetch, headers = {}, tag = 'recognition' } = {}) {
  try {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[${tag}] Network error:`, err.message);
    return null;
  }
}

/** Digits a reader may print as letters (O for 0, I for 1...), only applied where a digit must be. */
const DIGIT_LOOKALIKES = { O: '0', Q: '0', D: '0', I: '1', L: '1', '|': '1', Z: '2', S: '5', B: '8', G: '6' };
const toDigits = (s) => String(s).toUpperCase().split('').map((c) => DIGIT_LOOKALIKES[c] || c).join('');

/** "0063" -> "63", "TG05" -> "TG5", "123a" -> "123A": a collector number compared without padding. */
function numberKey(raw) {
  const m = /^([A-Z]*)0*(\d+)([A-Z★]*)$/i.exec(String(raw ?? '').trim());
  return m ? `${m[1].toUpperCase()}${m[2]}${m[3].toUpperCase()}` : null;
}

module.exports = { fetchJson, toDigits, numberKey, DIGIT_LOOKALIKES };
