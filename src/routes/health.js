// Liveness probe for uptime monitors / keep-alive pings (UptimeRobot etc.).
// Deliberately does NOT touch the database: it must be cheap, and its job is only to show the process is
// up (and, on Render's free plan, to stop the instance from spinning down after 15 idle minutes — the cold
// start of up to ~50s is what made Googlebot see 5xx errors).
// Mounted in server.js BEFORE the global rate limiter so frequent pings never eat the visitors' budget.
function healthHandler(req, res) {
  res.set({
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow', // a probe, not a page
  });
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
}

module.exports = healthHandler;
