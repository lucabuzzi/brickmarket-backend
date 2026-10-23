// GET a JSON document from an external catalog API (Scryfall, YGOPRODeck, TCGdex, OPTCG, Lorcana, apitcg).
// Never throws: a network error, a timeout or a non-2xx answer gives null, and the caller falls back to the
// local cache. Network errors are logged with the API's label; HTTP errors are not (a 404 is a normal answer).
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * @param {string} url
 * @param {object} opts
 * @param {string} opts.label           name in the log line, e.g. 'Scryfall'
 * @param {object} [opts.headers]       extra headers (Accept: application/json is always sent)
 * @param {number} [opts.timeoutMs]     abort after this long (default 8 s)
 * @returns {Promise<any|null>}
 */
async function fetchJson(url, { label, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[${label}] Network error:`, err.message);
    return null;
  }
}

module.exports = { fetchJson, DEFAULT_TIMEOUT_MS };
