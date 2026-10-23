const express = require('express');
const http = require('http');
const healthHandler = require('../src/routes/health');

const request = (port, path, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request({ port, path, method, agent: false }, (res) => {
    let body = ''; res.on('data', (c) => (body += c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });
  req.on('error', reject); req.end();
});

describe('/health', () => {
  let server; let port;
  beforeAll(() => {
    const app = express();
    // same shape as server.js: probe first, then a rate limiter that must never see it
    const limiterSeen = [];
    app.get(['/health', '/api/health'], healthHandler);
    app.use((req, res, next) => { limiterSeen.push(req.path); next(); });
    app.get('/other', (req, res) => res.send('x'));
    app.locals.limiterSeen = limiterSeen;
    server = app.listen(0); port = server.address().port; app.locals.port = port;
    global.__app = app;
  });
  afterAll(() => server.close());

  test.each(['/health', '/api/health'])('GET %s -> 200 ok JSON with uptime', async (path) => {
    const r = await request(port, path);
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body)).toEqual({ status: 'ok', uptime: expect.any(Number) });
  });
  test('is not cacheable and not indexable', async () => {
    const r = await request(port, '/health');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.headers['x-robots-tag']).toMatch(/noindex/);
  });
  test('HEAD works too (some monitors use it)', async () => {
    expect((await request(port, '/health', 'HEAD')).status).toBe(200);
  });
  test('answers before later middleware (i.e. before the rate limiter)', async () => {
    global.__app.locals.limiterSeen.length = 0;
    await request(port, '/health'); await request(port, '/api/health');
    expect(global.__app.locals.limiterSeen).toEqual([]);
    await request(port, '/other');
    expect(global.__app.locals.limiterSeen).toEqual(['/other']);
  });
  test('src/app.js mounts it before express.json and the global rate limiter, once', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../src/app.js'), 'utf8');
    const mount = src.indexOf("app.get(['/health', '/api/health']");
    expect(mount).toBeGreaterThan(-1);
    expect(mount).toBeLessThan(src.indexOf("app.use(express.json("));
    expect(mount).toBeLessThan(src.indexOf('Rate limiting globale'));
    expect(src.match(/app\.get\([^)]*health/g)).toHaveLength(1);
  });
});
