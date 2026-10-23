// What the auth guards answer (status + message), pinned before they were rebuilt on the shared token helpers
// (src/utils/authToken.js): a refactor must not change a single one. The database is mocked.
jest.mock('../src/db', () => ({ query: jest.fn() }));
const jwt = require('jsonwebtoken');
const { query } = require('../src/db');
const auth = require('../src/middleware/auth');
const { adminAuth } = require('../src/middleware/auth');

const SECRET = 'x'.repeat(40);
const saved = process.env.JWT_SECRET;
beforeAll(() => { process.env.JWT_SECRET = SECRET; });
afterAll(() => { process.env.JWT_SECRET = saved; if (saved === undefined) delete process.env.JWT_SECRET; });
beforeEach(() => {
  query.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const token = (payload = { userId: 7 }, secret = SECRET) => jwt.sign(payload, secret);

async function call(mw, authorization) {
  const req = { header: (name) => (name === 'Authorization' ? authorization : undefined) };
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const next = jest.fn();
  await mw(req, res, next);
  return { req, res, next };
}

describe.each([['auth', auth], ['adminAuth', adminAuth]])('%s', (name, mw) => {
  const okRow = name === 'auth' ? { is_active: true } : { role: 'admin', is_active: true };

  test('no header -> 401 token mancante', async () => {
    const { res, next } = await call(mw, undefined);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Accesso negato. Token mancante.' });
    expect(next).not.toHaveBeenCalled();
  });

  test.each([['Bearer token', (t) => `Bearer ${t}`], ['raw token', (t) => t]])('valid %s -> next, req.user = payload', async (_, fmt) => {
    query.mockResolvedValueOnce({ rows: [okRow] });
    const { req, next } = await call(mw, fmt(token()));
    expect(next).toHaveBeenCalled();
    expect(req.user.userId).toBe(7);
    expect(query.mock.calls[0][1]).toEqual([7]);
  });

  test('bad signature -> 403 token non valido, no DB call', async () => {
    const { res, next } = await call(mw, `Bearer ${token({ userId: 7 }, 'y'.repeat(40))}`);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Token non valido' });
    expect(next).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  test('unknown user -> 403 utente non trovato', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const { res } = await call(mw, `Bearer ${token()}`);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Utente non trovato.' });
  });

  test('disabled account -> 403 account disabilitato', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...okRow, is_active: false }] });
    const { res } = await call(mw, `Bearer ${token()}`);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Account disabilitato.' });
  });

  test('a DB failure answers 403 token non valido (as before)', async () => {
    query.mockRejectedValueOnce(new Error('db down'));
    const { res, next } = await call(mw, `Bearer ${token()}`);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Token non valido' });
    expect(next).not.toHaveBeenCalled();
  });
});

test('auth reads only is_active; adminAuth reads role too', async () => {
  query.mockResolvedValue({ rows: [{ role: 'admin', is_active: true }] });
  await call(auth, `Bearer ${token()}`);
  await call(adminAuth, `Bearer ${token()}`);
  expect(query.mock.calls[0][0]).toBe('SELECT is_active FROM users WHERE id = $1');
  expect(query.mock.calls[1][0]).toMatch(/SELECT role, is_active FROM users WHERE id = \$1/);
});

test('adminAuth: a non-admin -> 403 riservato agli amministratori', async () => {
  query.mockResolvedValueOnce({ rows: [{ role: 'user', is_active: true }] });
  const { res, next } = await call(adminAuth, `Bearer ${token()}`);
  expect(res.statusCode).toBe(403);
  expect(res.body).toEqual({ error: 'Accesso riservato agli amministratori.' });
  expect(next).not.toHaveBeenCalled();
});
