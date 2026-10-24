// JWT_SECRET has no fallback anywhere: the old hardcoded defaults were public (in the repo), so a token signed
// with one of them must be rejected, and the server must refuse to boot without a real secret.
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');

jest.mock('../src/db', () => ({ query: jest.fn() }));
// Every handler is a no-op: only the auth middleware in front of them is under test.
jest.mock('../src/controllers/contestController', () => new Proxy({}, { get: () => (req, res) => res.end() }));
jest.mock('../src/integrations/cloudinary', () => ({ upload: { single: () => (req, res, next) => next() } }));
jest.mock('../src/middleware/auth', () => ({ adminAuth: (req, res, next) => next() }));

const { assertJwtSecret, getJwtSecret, MIN_JWT_SECRET_LENGTH } = require('../src/config/jwtSecret');

const REPO_ROOT = path.resolve(__dirname, '..');
const STRONG = 'x'.repeat(MIN_JWT_SECRET_LENGTH);
const OLD_PUBLIC_DEFAULTS = ['clutchvault_secret_key_1337', 'secret_di_sviluppo_super_sicuro'];

describe('assertJwtSecret', () => {
  test('missing secret throws, in every environment', () => {
    expect(() => assertJwtSecret({ NODE_ENV: 'production' })).toThrow(/not set/);
    expect(() => assertJwtSecret({ NODE_ENV: 'development' })).toThrow(/not set/);
  });

  test('short secret is fatal in production', () => {
    expect(() => assertJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/too short/);
  });

  test('short secret only warns outside production', () => {
    const warn = jest.fn();
    expect(assertJwtSecret({ NODE_ENV: 'development', JWT_SECRET: 'short' }, warn)).toBe('short');
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/too short/));
  });

  test('a long enough secret passes silently', () => {
    const warn = jest.fn();
    expect(assertJwtSecret({ NODE_ENV: 'production', JWT_SECRET: STRONG }, warn)).toBe(STRONG);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('getJwtSecret', () => {
  const saved = process.env.JWT_SECRET;
  afterEach(() => { process.env.JWT_SECRET = saved; if (saved === undefined) delete process.env.JWT_SECRET; });

  test('never falls back to a default', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow(/not set/);
  });
});

describe('contest authenticateToken', () => {
  const { authenticateToken } = require('../src/routes/contest');
  const mainDb = require('../src/db');
  const saved = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = STRONG;
    mainDb.query.mockReset();
  });
  afterAll(() => { process.env.JWT_SECRET = saved; if (saved === undefined) delete process.env.JWT_SECRET; });

  function call(token) {
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    return authenticateToken(req, res, next).then(() => ({ req, res, next }));
  }

  test.each(OLD_PUBLIC_DEFAULTS)('rejects a token forged with the old public default %s', async (oldSecret) => {
    const forged = jwt.sign({ userId: 1, role: 'admin' }, oldSecret);
    const { res, next } = await call(forged);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mainDb.query).not.toHaveBeenCalled();
  });

  test('accepts a token signed with the real secret', async () => {
    mainDb.query.mockResolvedValue({ rows: [{ id: 7, username: 'u', email: 'u@x.it', role: 'user' }] });
    const { req, next } = await call(jwt.sign({ userId: 7 }, STRONG));
    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe(7);
  });
});

describe('server.js boot', () => {
  // Run from a directory with no .env, so dotenv can't fill in the real secret behind the test's back.
  function boot(extraEnv) {
    const env = { ...process.env, ...extraEnv, PORT: '0' };
    delete env.JWT_SECRET;
    if (extraEnv.JWT_SECRET) env.JWT_SECRET = extraEnv.JWT_SECRET;
    return new Promise((resolve) => {
      const proc = spawn(process.execPath, [path.join(REPO_ROOT, 'server.js')], {
        cwd: os.tmpdir(), env: { ...env, NODE_PATH: path.join(REPO_ROOT, 'node_modules') }, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      const timer = setTimeout(() => { if (proc.exitCode === null) proc.kill(); }, 8000);
      proc.on('exit', (code) => { clearTimeout(timer); resolve({ code, stderr }); });
    });
  }

  test('refuses to start without JWT_SECRET', async () => {
    const { code, stderr } = await boot({ NODE_ENV: 'development' });
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/JWT_SECRET is not set/);
  }, 15000);

  test('refuses to start in production with a short JWT_SECRET', async () => {
    const { code, stderr } = await boot({ NODE_ENV: 'production', JWT_SECRET: 'short' });
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/JWT_SECRET is too short/);
  }, 15000);
});
