const { getFrontendUrl } = require('../src/utils/frontendUrl');

describe('getFrontendUrl', () => {
  test('FRONTEND_URL wins, trimmed and without trailing slashes', () => {
    expect(getFrontendUrl({ FRONTEND_URL: 'https://cardbrix.com' })).toBe('https://cardbrix.com');
    expect(getFrontendUrl({ FRONTEND_URL: '  https://cardbrix.com//  ', NODE_ENV: 'production' })).toBe('https://cardbrix.com');
  });
  test('production without FRONTEND_URL falls back to the real site, never localhost', () => {
    for (const v of [undefined, '', '   ']) expect(getFrontendUrl({ FRONTEND_URL: v, NODE_ENV: 'production' })).toBe('https://cardbrix.com');
  });
  test('development without FRONTEND_URL uses the Vite dev server', () => {
    expect(getFrontendUrl({ NODE_ENV: 'development' })).toBe('http://localhost:5173');
    expect(getFrontendUrl({})).toBe('http://localhost:5173');
  });
});

describe('links built by the backend', () => {
  const read = (p) => require('fs').readFileSync(require('path').join(__dirname, '..', p), 'utf8');
  test('no module builds a link straight from process.env.FRONTEND_URL', () => {
    for (const f of ['src/services/authService.js', 'src/controllers/paymentsController.js']) {
      expect(read(f)).not.toMatch(/\$\{process\.env\.FRONTEND_URL/);
    }
  });
});
