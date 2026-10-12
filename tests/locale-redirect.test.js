// Legacy unprefixed structural URLs -> their real /it or /en URL (src/routes/localeRedirect.js).
const { localeRedirect, preferredLocale } = require('../src/routes/localeRedirect');

function call(path, acceptLanguage) {
  const req = { path, url: path, headers: { 'accept-language': acceptLanguage } };
  const res = { redirect: jest.fn() };
  const next = jest.fn();
  localeRedirect(req, res, next);
  return { req, res, next };
}

describe('preferredLocale', () => {
  test('English only when it is the first real preference; everything else (including none) defaults to Italian', () => {
    expect(preferredLocale('en-US,en;q=0.9')).toBe('en');
    expect(preferredLocale('en')).toBe('en');
    expect(preferredLocale('it-IT,it;q=0.9,en;q=0.8')).toBe('it');
    expect(preferredLocale('fr-FR,fr;q=0.9')).toBe('it');
    expect(preferredLocale(undefined)).toBe('it');
    expect(preferredLocale('')).toBe('it');
  });
});

describe('localeRedirect', () => {
  test('bare "/" redirects to the home of the preferred locale', () => {
    const { res, next } = call('/', 'it-IT');
    expect(res.redirect).toHaveBeenCalledWith(301, '/it');
    expect(next).not.toHaveBeenCalled();
  });

  test('an old bare structural URL redirects to its /it or /en equivalent', () => {
    expect(call('/annunci/lego', 'it-IT').res.redirect).toHaveBeenCalledWith(301, '/it/annunci/lego');
    expect(call('/annunci/lego', 'en-US').res.redirect).toHaveBeenCalledWith(301, '/en/listings/lego');
    expect(call('/aste/carte-collezionabili/pokemon', 'en').res.redirect).toHaveBeenCalledWith(301, '/en/auctions/trading-cards/pokemon');
  });

  test('a query string survives the redirect', () => {
    const req = { path: '/annunci', url: '/annunci?ref=foo', headers: {} };
    const res = { redirect: jest.fn() };
    localeRedirect(req, res, jest.fn());
    expect(res.redirect).toHaveBeenCalledWith(301, '/it/annunci?ref=foo');
  });

  test('a non-structural, already-prefixed, or unrelated path calls next(), not redirect', () => {
    for (const p of ['/product/abc', '/login', '/api/health', '/assets/index-xyz.js', '/it/annunci', '/en/listings', '/sitemap.xml', '/favicon.ico']) {
      const { res, next } = call(p, 'it-IT');
      expect([p, next.mock.calls.length, res.redirect.mock.calls.length]).toEqual([p, 1, 0]);
    }
  });
});
