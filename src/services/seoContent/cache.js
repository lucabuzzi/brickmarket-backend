// Small in-memory TTL cache with a size cap, for content that would otherwise cost one DB query per
// crawler request. Failures are never cached: a loader that throws or times out is retried next time.
const store = new Map();
const MAX_ENTRIES = 300;

/**
 * Returns the cached value for `key`, or runs `loader()` (bounded by `timeoutMs`) and caches its result.
 * Resolves to `null` when the loader fails or is too slow; callers must treat null as "leave that part out".
 */
async function cached(key, ttlMs, loader, { timeoutMs = 1500, now = Date.now } = {}) {
  const hit = store.get(key);
  if (hit && hit.expires > now()) return hit.value;

  let timer;
  try {
    const value = await Promise.race([
      loader(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout ${timeoutMs}ms`)), timeoutMs); }),
    ]);
    if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value); // oldest inserted first
    store.set(key, { value, expires: now() + ttlMs });
    return value;
  } catch (err) {
    console.warn(`seoContent cache "${key}":`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const clear = () => store.clear();

module.exports = { cached, clear, MAX_ENTRIES };
