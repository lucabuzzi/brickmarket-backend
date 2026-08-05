const geoip = require('geoip-lite');

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

/** ISO 3166-1 alpha-2 country code (e.g. 'IT', 'DE'), or null if unresolvable
 * (private/local IPs, unknown ranges). Offline lookup, no external network calls. */
function lookupCountry(req) {
  const ip = getClientIp(req);
  if (!ip) return null;
  const cleanIp = ip.replace('::ffff:', '');
  const geo = geoip.lookup(cleanIp);
  return geo?.country || null;
}

module.exports = { lookupCountry, getClientIp };
