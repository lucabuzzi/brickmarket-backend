// How many reverse-proxy hops sit in front of the app (Render's edge). Express only believes
// X-Forwarded-For entries from that many hops from the right, so `req.ip` is the visitor and a client
// cannot fake it by sending its own header. Without this, req.ip was the proxy's address for everybody:
// express-rate-limit logged ERR_ERL_UNEXPECTED_X_FORWARDED_FOR and all users shared one rate-limit bucket,
// and the IP-based anti-abuse / geo code saw a single address.
//
// Default 1 (conservative: the entry appended by the platform's own proxy can't be forged). Render's exact
// hop count isn't documented — if req.ip still looks like an edge address, raise TRUST_PROXY_HOPS on Render.
function parseTrustProxyHops(raw, fallback = 1) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(String(raw).trim());
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : fallback;
}

module.exports = { parseTrustProxyHops };
