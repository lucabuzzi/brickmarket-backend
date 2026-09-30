// GET /api/wallet/rules (public, read-only) and the credits-page copy that goes with it.
// Every collaborator that could reach a database is mocked.
jest.mock('../src/routes/contest', () => ({ authenticateToken: (req, res, next) => next() }));
jest.mock('../src/controllers/walletController', () => ({ getBalanceHandler: jest.fn(), getTransactionsHandler: jest.fn(), buyProductHandler: jest.fn() }));
jest.mock('../src/repositories/creditConfigRepository', () => ({ getAll: jest.fn() }));

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const creditConfigRepository = require('../src/repositories/creditConfigRepository');
const walletRouter = require('../src/routes/wallet');
const { pageFor } = require('../src/services/seoContent/pages');

const ROOT = path.join(__dirname, '..');
const LOCALES = ['it', 'en', 'de', 'es', 'fr'];
const locale = (lang) => JSON.parse(fs.readFileSync(path.join(ROOT, 'client/src/locales', `${lang}.json`), 'utf8'));

const ALL_KEYS = [
  ['signup_bonus', 5], ['referral_bonus', 5], ['sale_bonus', 5], ['purchase_bonus', 5], ['maturation_days', 15], ['min_order_amount', 5],
  ['daily_bonus_cap_per_user', 20], ['monthly_bonus_cap_per_user', 60], ['monthly_bonus_cap_per_pair', 15],
].map(([key, value]) => ({ key, value, description: null, updatedAt: null, isDefault: false }));

async function get(pathname) {
  const app = express();
  app.use('/api/wallet', walletRouter);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${pathname}`);
    return { status: res.status, headers: res.headers, body: await res.json() };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); creditConfigRepository.getAll.mockReset(); });
afterEach(() => jest.restoreAllMocks());

describe('GET /api/wallet/rules', () => {
  test('is public and exposes only the whitelisted values, never the anti-abuse caps', async () => {
    creditConfigRepository.getAll.mockResolvedValue(ALL_KEYS);
    const { status, body, headers } = await get('/api/wallet/rules'); // no Authorization header at all
    expect(status).toBe(200);
    expect(Object.keys(body.rules).sort()).toEqual(['maturation_days', 'min_order_amount', 'purchase_bonus', 'referral_bonus', 'sale_bonus', 'signup_bonus']);
    expect(body.rules.maturation_days).toBe(15);
    expect(JSON.stringify(body)).not.toMatch(/cap/);
    expect(headers.get('cache-control')).toMatch(/public, max-age=\d+/);
  });

  test('reports a server error instead of leaking details when the config cannot be read', async () => {
    creditConfigRepository.getAll.mockRejectedValue(new Error('connection string postgres://secret'));
    const { status, body } = await get('/api/wallet/rules');
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('postgres://');
  });

  test('the whitelist is exactly what the credits page renders', () => {
    expect(walletRouter.PUBLIC_RULE_KEYS.sort()).toEqual(['maturation_days', 'min_order_amount', 'purchase_bonus', 'referral_bonus', 'sale_bonus', 'signup_bonus']);
  });
});

describe('credits-page copy about maturation', () => {
  const MAT_KEYS = ['mat_title', 'mat_intro', 'mat_rule_days', 'mat_rule_condition', 'mat_rule_min', 'mat_rule_clawback', 'mat_rewards_title', 'mat_reward_signup', 'mat_reward_referral', 'mat_reward_sale', 'mat_reward_purchase'];

  test.each(LOCALES)('%s has every mat_* string and keeps the placeholders the page fills in', (lang) => {
    const { wallet } = locale(lang);
    for (const k of MAT_KEYS) expect([lang, k, typeof wallet[k]]).toEqual([lang, k, 'string']);
    expect(wallet.mat_rule_days).toContain('{{days}}');
    expect(wallet.mat_rule_min).toContain('{{amount}}');
    for (const k of ['mat_reward_signup', 'mat_reward_referral', 'mat_reward_sale', 'mat_reward_purchase']) expect(wallet[k]).toContain('{{amount}}');
  });

  test('product rules: no credit/euro ratio, no purchase or conversion of credits, and never "diritto di recesso" (Italian)', () => {
    const forbidden = /acquist\w*\s+(?:i\s+)?crediti|compr\w*\s+(?:i\s+)?crediti|1\s*credito\s*=|credito\s*=\s*\d|crediti?\s*=\s*[\d.,]+\s*(?:€|euro)|\d\s*(?:€|euro)\s*=\s*\d+\s*credit|recesso/i;
    for (const lang of LOCALES) {
      const { wallet } = locale(lang);
      const text = MAT_KEYS.map((k) => wallet[k]).join(' ');
      expect([lang, forbidden.test(text)]).toEqual([lang, false]);
    }
  });

  test('the Italian copy uses "periodo di maturazione"', () => {
    expect(locale('it').wallet.mat_intro).toMatch(/periodo di maturazione/);
  });

  test('the server-rendered /crediti page carries the maturation rules, without unresolved placeholders or hardcoded numbers', () => {
    const d = pageFor('/crediti');
    expect(d.body).toContain(locale('it').wallet.mat_title);
    expect(d.body).toMatch(/periodo di maturazione/);
    expect(d.body).not.toMatch(/\{\{/);
    expect(d.body).not.toContain(String(locale('it').wallet.mat_rule_days));
  });
});

describe('listing page trust blocks', () => {
  const src = fs.readFileSync(path.join(ROOT, 'client/src/pages/ListingDetail.jsx'), 'utf8');

  test('seller reviews use the public reviews API for the listing seller, capped at three', () => {
    expect(src).toContain('`/api/reviews/user/${sellerId}`');
    expect(src).toContain('rows.slice(0, 3)');
    expect(src).toMatch(/<SellerReviews key=\{listing\.seller_id\} sellerId=\{listing\.seller_id\}/);
  });

  test.each(LOCALES)('%s has the seller-review and dispute strings', (lang) => {
    const { product } = locale(lang);
    for (const k of ['seller_reviews_title', 'seller_reviews_all', 'trust_dispute']) expect([lang, k, typeof product[k]]).toEqual([lang, k, 'string']);
  });
});
