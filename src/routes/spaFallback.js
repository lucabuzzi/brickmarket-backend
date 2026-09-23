const fs = require('fs');
const path = require('path');
const { renderPage } = require('../services/seoMeta');

/**
 * Express handler that serves the built React app (client/dist/index.html) for any non-API, non-uploads
 * GET path so client-side routes work on a hard refresh or a direct link. The shell is rewritten per
 * request (title, canonical, OG, JSON-LD; see services/seoMeta.js) and the HTTP status is 404 when the URL
 * is not a page of the app or the listing does not exist, so crawlers do not index invented URLs.
 */
function createSpaFallback(clientDistPath) {
  const indexPath = path.join(clientDistPath, 'index.html');
  return async function spaFallback(req, res) {
    let baseHtml;
    try {
      baseHtml = fs.readFileSync(indexPath, 'utf-8');
    } catch (err) {
      return res.status(404).send('Frontend build not found — run `npm run build` first.');
    }

    res.set('Content-Type', 'text/html; charset=UTF-8');
    try {
      const { html, status } = await renderPage(req.path, baseHtml);
      return res.status(status).send(html);
    } catch (err) {
      console.error('index.html render error:', err.message);
      return res.send(baseHtml);
    }
  };
}

module.exports = { createSpaFallback };
