// Polite fetcher for the audit: same-host only, bounded size/time, manual redirects so the chain is
// visible, and a small concurrency pool with a delay so an audit never looks like a load test.

const UA_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 CardBrixSeoAudit/1.0';
const UA_GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) CardBrixSeoAudit/1.0';
const MAX_BYTES = 2 * 1024 * 1024;

function makeFetcher({ baseUrl, timeoutMs = 15000, delayMs = 150 }) {
  const baseHost = new URL(baseUrl).host;
  let lastAt = 0;

  async function politeWait() {
    const wait = lastAt + delayMs - Date.now();
    lastAt = Math.max(Date.now(), lastAt + delayMs);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  async function get(url, { ua = UA_BROWSER, maxRedirects = 5, method = 'GET' } = {}) {
    if (new URL(url).host !== baseHost) throw new Error(`Refusing to fetch off-site URL: ${url}`);
    const chain = [];
    let current = url;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      await politeWait();
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      const started = Date.now();
      let res;
      try {
        res = await fetch(current, {
          method,
          redirect: 'manual',
          signal: ctl.signal,
          headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-encoding': 'gzip, br' },
        });
      } catch (err) {
        clearTimeout(timer);
        return { url, finalUrl: current, status: 0, error: err.name === 'AbortError' ? 'timeout' : err.message, chain, headers: {}, body: '', bytes: 0, ttfbMs: null };
      }
      const ttfbMs = Date.now() - started;
      const headers = Object.fromEntries(res.headers.entries());
      if (res.status >= 300 && res.status < 400 && headers.location) {
        chain.push({ url: current, status: res.status });
        current = new URL(headers.location, current).toString();
        clearTimeout(timer);
        continue;
      }
      let body = '';
      let bytes = 0;
      if (method !== 'HEAD') {
        const buf = Buffer.from(await res.arrayBuffer());
        bytes = buf.length;
        body = buf.subarray(0, MAX_BYTES).toString('utf8');
      }
      clearTimeout(timer);
      return { url, finalUrl: current, status: res.status, chain, headers, body, bytes, ttfbMs, error: null };
    }
    return { url, finalUrl: current, status: 0, error: 'too many redirects', chain, headers: {}, body: '', bytes: 0, ttfbMs: null };
  }

  return { get, baseHost };
}

/** Runs `worker(item)` over `items` with at most `limit` in flight, preserving result order. */
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await worker(items[i], i);
      }
    })
  );
  return results;
}

module.exports = { makeFetcher, pool, UA_BROWSER, UA_GOOGLEBOT };
