const { parseTrustProxyHops } = require('../src/utils/trustProxy');
const express = require('express');

describe('parseTrustProxyHops', () => {
  test.each([[undefined, 1], [null, 1], ['', 1], ['  ', 1], ['abc', 1], ['-1', 1], ['1.5', 1], ['9', 1], ['2', 2], [' 3 ', 3], ['0', 0], [1, 1]])('%j -> %j', (raw, expected) => {
    expect(parseTrustProxyHops(raw)).toBe(expected);
  });
  test('custom fallback', () => expect(parseTrustProxyHops('x', 2)).toBe(2));
});

describe('server.js wires it before any middleware', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../server.js'), 'utf8');
  test('sets trust proxy right after creating the app', () => {
    const appIdx = src.indexOf('const app = express()');
    const trustIdx = src.indexOf("app.set('trust proxy'");
    const firstUse = src.indexOf('app.use(');
    expect(trustIdx).toBeGreaterThan(appIdx);
    expect(trustIdx).toBeLessThan(firstUse);
  });
});

describe('req.ip with trust proxy = 1 (real Express)', () => {
  const http = require('http');
  const get = (port, headers) => new Promise((resolve, reject) => {
    http.get({ port, path: '/', headers, agent: false }, (res) => {
      let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve(b));
    }).on('error', reject);
  });
  test('uses the entry appended by the proxy, ignores a forged leftmost value', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.get('/', (req, res) => res.send(req.ip));
    const server = app.listen(0);
    try {
      const { port } = server.address();
      // client forged 9.9.9.9; the platform proxy appended the real address 203.0.113.7
      expect(await get(port, { 'X-Forwarded-For': '9.9.9.9, 203.0.113.7' })).toBe('203.0.113.7');
      // no header (local dev): falls back to the socket address
      expect(await get(port, {})).toMatch(/127\.0\.0\.1|::1/);
    } finally { server.close(); }
  });
});
