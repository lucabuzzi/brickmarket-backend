// IndexNow (https://www.indexnow.org): tells Bing and the other participating engines that a public
// URL was added or changed, so it gets crawled in minutes instead of days.
//
// Inert unless INDEXNOW_KEY is set (8-128 chars, letters/digits/dashes). The same key must be served
// at /<key>.txt, which routes/seoFiles.js does. Only ever sends public listing URLs on our own host.
// Best-effort by design: it never throws and never delays the request that triggered it.

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BASE_URL = 'https://cardbrix.com';
const KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

function getKey(env = process.env) {
  const key = env.INDEXNOW_KEY;
  return key && KEY_RE.test(key) ? key : null;
}

async function submitUrls(urls, { env = process.env, fetchImpl = globalThis.fetch, baseUrl = BASE_URL, timeoutMs = 5000 } = {}) {
  const key = getKey(env);
  if (!key) return { submitted: 0, skipped: 'no-key' };
  const host = new URL(baseUrl).host;
  const list = [...new Set(urls)].filter((u) => {
    try { return new URL(u).host === host; } catch { return false; }
  }).slice(0, 10000);
  if (!list.length) return { submitted: 0, skipped: 'no-urls' };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${baseUrl}/${key}.txt`, urlList: list }),
      signal: ctl.signal,
    });
    // 200 = ok, 202 = accepted (key validation pending); anything else is logged, never thrown
    if (res.status !== 200 && res.status !== 202) console.warn(`IndexNow: HTTP ${res.status}`);
    return { submitted: list.length, status: res.status };
  } catch (err) {
    console.warn('IndexNow: invio non riuscito:', err.message);
    return { submitted: 0, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Fire-and-forget hook for "a listing became publicly visible / changed". */
function notifyListingChanged(listingId, opts) {
  submitUrls([`${(opts && opts.baseUrl) || BASE_URL}/product/${listingId}`], opts).catch(() => {});
}

module.exports = { getKey, submitUrls, notifyListingChanged, KEY_RE };
