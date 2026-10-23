// Privacy / cookie / game compliance guards: what the texts promise must be what the code does.
// No database is touched (db module mocked).
jest.mock('../src/db', () => ({ query: jest.fn() }));

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES = ['it', 'en', 'de', 'es', 'fr'];
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const locale = (lang) => JSON.parse(read(`client/src/locales/${lang}.json`));
const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (
  e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]
));
const sections = (ns) => Object.keys(ns).filter((k) => /^s\d+_title$/.test(k)).length;

describe('no personal data leaves for Google Fonts (fonts are self-hosted)', () => {
  test('index.html and every client source file avoid fonts.googleapis.com / fonts.gstatic.com', () => {
    const files = ['client/index.html', ...walk('client/src').filter((f) => /\.(jsx?|css|html)$/.test(f))];
    for (const f of files) expect([f, /fonts\.(googleapis|gstatic)\.com/.test(read(f))]).toEqual([f, false]);
  });

  test('the font packages are installed and imported', () => {
    expect(read('client/src/main.jsx')).toContain('@fontsource-variable/plus-jakarta-sans');
    expect(read('client/src/game/GamePage.jsx')).toContain('@fontsource/press-start-2p');
    expect(read('client/src/game/InventoryPage.jsx')).toContain('@fontsource/press-start-2p');
    const pkg = JSON.parse(read('client/package.json')).dependencies;
    expect(pkg['@fontsource/press-start-2p']).toBeTruthy();
    expect(pkg['@fontsource-variable/plus-jakarta-sans']).toBeTruthy();
  });
});

describe('policy texts exist in every language with the same structure', () => {
  test.each(LOCALES)('%s has the full privacy and cookie policy and a placeholder in the same places as Italian', (lang) => {
    const l = locale(lang);
    const it = locale('it');
    expect(sections(l.privacy)).toBe(16);
    expect(sections(l.cookie_policy)).toBe(9);
    for (const ns of ['privacy', 'cookie_policy']) {
      for (const k of Object.keys(it[ns])) {
        expect([lang, ns, k, typeof l[ns][k]]).toEqual([lang, ns, k, 'string']);
        const mark = /\[(DATA|EMAIL PRIVACY)\]/;
        expect([lang, ns, k, mark.test(l[ns][k])]).toEqual([lang, ns, k, mark.test(it[ns][k])]);
      }
    }
  });

  test.each(LOCALES)('%s privacy covers the game, the EU complaint right and 18+', (lang) => {
    const body = JSON.stringify(locale(lang).privacy);
    expect(body).toContain('CardBrix the game');
    expect(body).toContain('edpb.europa.eu');
    expect(body).toMatch(/Art\. 77|art\. 77/);
    expect(body).toMatch(/18/);
    expect(body).not.toMatch(/Google Fonts/);
  });

  test.each(LOCALES)('%s credits rule holds: never purchasable or convertible', (lang) => {
    const l = locale(lang);
    const text = JSON.stringify([l.privacy, l.cookie_policy, l.legal]);
    expect(text).not.toMatch(/1\s*(credit|crédit|credito|Credit)\w*\s*=|(credit|crédit|credito|Credit)\w*\s*=\s*[\d.,]+\s*(€|euro)/i);
  });
});

describe('every storage key the code writes is declared in the cookie policy (drift guard)', () => {
  const policy = locale('it').cookie_policy;
  const text = Object.values(policy).join('\n');

  test('declared names match the constants in the code', () => {
    const grab = (file, re) => read(file).match(re)[1];
    const keys = [
      grab('client/src/analytics.js', /CONSENT_COOKIE = '([^']+)'/),
      grab('client/src/analytics.js', /SESSION_STORAGE_KEY = '([^']+)'/),
      grab('src/routes/analyticsTrack.js', /VISITOR_COOKIE = '([^']+)'/),
      grab('client/src/api.js', /TOKEN_STORAGE_KEY = '([^']+)'/),
      grab('client/src/context/CartContext.jsx', /GUEST_CART_KEY = '([^']+)'/),
      grab('client/src/components/GeoLanguageSuggestion.jsx', /CHECKED_KEY = '([^']+)'/),
      grab('client/src/components/brand/introGate.js', /SEEN_KEY = '([^']+)'/),
      grab('client/src/game/usePlaza.js', /VISIBLE_KEY = '([^']+)'/),
      grab('client/src/game/screens/WorldScreen.jsx', /ROTATE_DISMISSED_KEY = '([^']+)'/),
      grab('client/src/game/screens/WorldScreen.jsx', /RETURN_KEY = '([^']+)'/),
      grab('client/src/lib/game/tutorial.js', /KEY_PREFIX = '([^:']+)/),
      grab('client/src/pages/Sell.jsx', /GUIDE_SEEN_KEY = '([^']+)'/),
      'cardbrix_auction_guide_seen',
      'cardbrix_sell_draft_v',
      'cardbrix_auction_draft_v',
      'i18nextLng',
    ];
    for (const k of keys) expect([k, text.includes(k)]).toEqual([k, true]);
  });

  test('no cardbrix_/bm_ key is written anywhere in the client without being declared', () => {
    const declared = new Set((text.match(/\b(?:cardbrix|bm)_[a-z0-9_]+/g) || []));
    const files = walk('client/src').filter((f) => /\.(jsx?)$/.test(f));
    const found = new Set();
    for (const f of files) {
      const src = read(f);
      for (const m of src.matchAll(/['"`]((?:cardbrix|bm)_[a-z0-9_]+)/g)) {
        if (!src.includes(`${m[1]}.csv`)) found.add(m[1]); // download file names are not storage
      }
    }
    // `cardbrix_sell_draft_v` / `cardbrix_auction_draft_v` are prefixes (…_v1:<id>); `cardbrix_token` etc. are exact names
    const undeclared = [...found].filter((k) => ![...declared].some((d) => k === d || k.startsWith(d) || d.startsWith(k)));
    expect(undeclared).toEqual([]);
  });

  test('consent cookie lasts 6 months, as the policy says', () => {
    const analytics = read('client/src/analytics.js');
    expect(analytics).toContain('CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60');
    expect(text).toMatch(/bm_cookie_consent \(cookie proprio, 6 mesi\)/);
  });
});

describe('cookie banner', () => {
  const banner = read('client/src/components/CookieConsent.jsx');
  const analytics = read('client/src/analytics.js');

  test('accept and reject share one style (equal prominence) and there is a close = reject control', () => {
    const styles = [...banner.matchAll(/className=\{CHOICE_BTN\}/g)];
    expect(styles.length).toBeGreaterThanOrEqual(3); // save, reject, accept
    expect(banner).toMatch(/onClick=\{\(\) => choose\(false\)\}\s*\n?\s*aria-label=\{t\('cookies\.close'\)\}/);
  });

  test('Global Privacy Control is honoured and a withdrawal stops tracking at once', () => {
    expect(analytics).toContain('navigator.globalPrivacyControl === true');
    expect(banner).toContain("setConsent('rejected', 'gpc')");
    expect(analytics).toMatch(/if \(value !== 'accepted'\) stopAnalytics\(\)/);
  });

  test('no tracking call happens before consent: every tracker checks the cookie', () => {
    for (const fn of ['sendHeartbeat', 'handleGlobalClick', 'trackPageview', 'trackEvent']) {
      const body = analytics.slice(analytics.indexOf(`function ${fn}`));
      expect([fn, /if \(!hasConsent\(\)\) return;/.test(body.slice(0, 160))]).toEqual([fn, true]);
    }
  });

  test.each(LOCALES)('%s has every banner string', (lang) => {
    const c = locale(lang).cookies;
    for (const k of ['banner_title', 'banner_text', 'learn_more', 'accept', 'reject', 'customize', 'save', 'close', 'necessary_title', 'always_on', 'necessary_desc', 'stats_title', 'stats_desc', 'gpc_notice']) {
      expect([lang, k, typeof c[k]]).toEqual([lang, k, 'string']);
    }
  });
});

describe('consent log service', () => {
  const { parseConsent, hashIp, recordConsent, purgeOlderThan } = require('../src/services/consentLog');
  const legalPages = require('../client/src/config/legalPages.json');

  test('accepts only a known choice, source and a sane policy version', () => {
    const ok = { choice: 'rejected', source: 'banner', policy_version: legalPages.policyVersion };
    expect(parseConsent(ok)).toEqual({ choice: 'rejected', source: 'banner', policyVersion: legalPages.policyVersion });
    for (const bad of [null, {}, { ...ok, choice: 'maybe' }, { ...ok, source: 'admin' }, { ...ok, policy_version: '' },
      { ...ok, policy_version: 'x'.repeat(21) }, { ...ok, policy_version: "1'; DROP TABLE users;--" }, { ...ok, policy_version: 5 }]) {
      expect(parseConsent(bad)).toBeNull();
    }
  });

  test('the IP is only ever stored as a keyed hash, never in clear', () => {
    const h = hashIp('203.0.113.7', 'secret-a');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('203.0.113.7');
    expect(hashIp('203.0.113.7', 'secret-a')).toBe(h);
    expect(hashIp('203.0.113.7', 'secret-b')).not.toBe(h);
    expect(hashIp(null, 'secret-a')).toBeNull();
    expect(hashIp('203.0.113.7', '')).toBeNull(); // without a secret, store nothing rather than an unkeyed hash
  });

  test('recordConsent writes one parameterised row, truncating the user agent', async () => {
    process.env.JWT_SECRET = 'test-secret';
    const db = { query: jest.fn().mockResolvedValue({}) };
    await recordConsent(db, { choice: 'accepted', source: 'settings', policyVersion: 'v1', userId: null, ip: '198.51.100.9', userAgent: 'U'.repeat(500) });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO public\.consent_log/);
    expect(params.slice(0, 4)).toEqual(['accepted', 'settings', 'v1', null]);
    expect(params[4]).toMatch(/^[0-9a-f]{64}$/);
    expect(params[5]).toHaveLength(200);
    expect(params.join(' ')).not.toContain('198.51.100.9');
  });

  test('purgeOlderThan deletes by age and reports the count', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 4 }) };
    expect(await purgeOlderThan(db, 1095)).toBe(4);
    expect(db.query.mock.calls[0][0]).toMatch(/DELETE FROM public\.consent_log WHERE created_at </);
    expect(db.query.mock.calls[0][1]).toEqual(['1095']);
  });

  test('the migration is reversible, enables RLS and the route is mounted', () => {
    const mig = read('src/db/migrate_consent_log.js');
    expect(mig).toContain('ENABLE ROW LEVEL SECURITY');
    expect(mig).toContain("--down");
    expect(mig).toMatch(/DROP TABLE IF EXISTS public\.consent_log/);
    expect(read('src/app.js')).toContain("app.use('/api/consent', require('./routes/consent'))");
  });
});

describe('consent route (real Express, mocked db)', () => {
  const express = require('express');
  const http = require('http');
  const db = require('../src/db');
  const post = (port, body) => new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ port, path: '/api/consent', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end(data);
  });

  test('204 for a valid choice, 400 for garbage, and the db is only hit for the valid one', async () => {
    process.env.JWT_SECRET = 'test-secret';
    db.query.mockClear();
    db.query.mockResolvedValue({});
    const app = express();
    app.use(express.json());
    app.use('/api/consent', require('../src/routes/consent'));
    const server = app.listen(0);
    try {
      const { port } = server.address();
      expect(await post(port, { choice: 'accepted', source: 'banner', policy_version: '2026-10-21' })).toBe(204);
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(await post(port, { choice: 'yes please', source: 'banner', policy_version: '2026-10-21' })).toBe(400);
      expect(db.query).toHaveBeenCalledTimes(1);
    } finally { server.close(); }
  });
});

describe('game terms', () => {
  test.each(LOCALES)('%s legal rules include the game and reporting articles and the consumer court carve-out', (lang) => {
    const l = locale(lang).legal;
    expect(l.art14_title).toMatch(/CardBrix the game/);
    expect(l.art14_body).toMatch(/18/);
    expect(l.art15_title).toBeTruthy();
    expect(l.art13_body).toContain('13.3');
    expect(read('client/src/pages/LegalRules.jsx')).toContain("'art14', 'art15'");
  });
});
