// The shared building blocks extracted from duplicated code (refactor/foundations): token helpers, the catalog
// fetchJson, the pool options, the job scheduler and the Live Hub. All pure or with injected fakes: no DB, no network.
// The job list requires the services it runs, which require the DB module: mocked, it is never called here.
jest.mock('../src/db', () => ({ query: jest.fn(), getClient: jest.fn(), withTransaction: jest.fn() }));
const jwt = require('jsonwebtoken');
const { extractToken, verifyToken, optionalUserId } = require('../src/utils/authToken');
const { fetchJson } = require('../src/utils/fetchJson');
const { poolOptions, logIdleErrors } = require('../src/db/poolConfig');
const { startJobs, runOnce } = require('../src/jobs/scheduler');
const { JOBS } = require('../src/jobs');

const SECRET = 'x'.repeat(40);
const saved = process.env.JWT_SECRET;
beforeAll(() => { process.env.JWT_SECRET = SECRET; });
afterAll(() => { process.env.JWT_SECRET = saved; if (saved === undefined) delete process.env.JWT_SECRET; });
afterEach(() => jest.restoreAllMocks());

const reqWith = (authorization) => ({ header: (n) => (n === 'Authorization' ? authorization : undefined) });

describe('authToken', () => {
  test('extractToken: Bearer, bare token, none', () => {
    expect(extractToken(reqWith('Bearer abc'))).toBe('abc');
    expect(extractToken(reqWith('abc'))).toBe('abc');
    expect(extractToken(reqWith(undefined))).toBeNull();
  });

  test('extractToken bearerOnly ignores a bare token', () => {
    expect(extractToken(reqWith('abc'), { bearerOnly: true })).toBeNull();
    expect(extractToken(reqWith('Bearer abc'), { bearerOnly: true })).toBe('abc');
  });

  test('extractToken also reads plain headers objects (no req.header)', () => {
    expect(extractToken({ headers: { authorization: 'Bearer abc' } })).toBe('abc');
  });

  test('verifyToken accepts the site secret only', () => {
    expect(verifyToken(jwt.sign({ userId: 3 }, SECRET)).userId).toBe(3);
    expect(() => verifyToken(jwt.sign({ userId: 3 }, 'y'.repeat(40)))).toThrow();
  });

  test('optionalUserId: id or null, never throws', () => {
    expect(optionalUserId(reqWith(`Bearer ${jwt.sign({ userId: 9 }, SECRET)}`))).toBe(9);
    expect(optionalUserId(reqWith(jwt.sign({ userId: 9 }, SECRET)))).toBe(9);
    expect(optionalUserId(reqWith(jwt.sign({ userId: 9 }, SECRET)), { bearerOnly: true })).toBeNull();
    expect(optionalUserId(reqWith('Bearer garbage'))).toBeNull();
    expect(optionalUserId(reqWith(`Bearer ${jwt.sign({ other: 1 }, SECRET)}`))).toBeNull();
    expect(optionalUserId(reqWith(undefined))).toBeNull();
  });
});

describe('fetchJson', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  test('sends Accept + extra headers and a timeout signal; returns the JSON', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ a: 1 }) }));
    await expect(fetchJson('https://x.test/a', { label: 'X', headers: { 'User-Agent': 'UA' } })).resolves.toEqual({ a: 1 });
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://x.test/a');
    expect(init.headers).toEqual({ Accept: 'application/json', 'User-Agent': 'UA' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test('non-2xx -> null, nothing logged', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) }));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(fetchJson('https://x.test', { label: 'X' })).resolves.toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  test('network error -> null, logged with the label', async () => {
    global.fetch = jest.fn(async () => { throw new Error('boom'); });
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(fetchJson('https://x.test', { label: 'Scryfall' })).resolves.toBeNull();
    expect(log).toHaveBeenCalledWith('[Scryfall] Network error:', 'boom');
  });
});

describe('poolConfig', () => {
  test("defaults are node-postgres' own (nothing changes without env vars)", () => {
    expect(poolOptions('postgres://h/db', {})).toEqual({
      connectionString: 'postgres://h/db', ssl: { rejectUnauthorized: false },
      max: 10, idleTimeoutMillis: 10000, connectionTimeoutMillis: 0,
    });
  });

  test('env vars override; invalid values fall back', () => {
    const o = poolOptions('c', { PG_POOL_MAX: '4', PG_IDLE_TIMEOUT_MS: '5000', PG_CONNECT_TIMEOUT_MS: '3000' });
    expect([o.max, o.idleTimeoutMillis, o.connectionTimeoutMillis]).toEqual([4, 5000, 3000]);
    const bad = poolOptions('c', { PG_POOL_MAX: '0', PG_IDLE_TIMEOUT_MS: 'x', PG_CONNECT_TIMEOUT_MS: '-1' });
    expect([bad.max, bad.idleTimeoutMillis, bad.connectionTimeoutMillis]).toEqual([10, 10000, 0]);
  });

  test('an idle connection error is logged, not thrown', () => {
    const { EventEmitter } = require('events');
    const pool = logIdleErrors(new EventEmitter(), 'main');
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => pool.emit('error', new Error('terminated'))).not.toThrow();
    expect(log).toHaveBeenCalledWith('[db:main] idle connection error:', 'terminated');
  });
});

describe('scheduler', () => {
  test('runOnce logs the described result, or the failure, and never rejects', async () => {
    const info = jest.spyOn(console, 'log').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    await runOnce({ name: 'J', run: async () => 3, describe: (n) => `${n} done.` }, 'Daily job');
    expect(info).toHaveBeenCalledWith('[J] Daily job: 3 done.');
    await expect(runOnce({ name: 'J', run: async () => { throw new Error('x'); } }, 'Daily job')).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith('[J] Daily job failed:', 'x');
    await runOnce({ name: 'Quiet', run: async () => 1 }, 'Hourly');
    expect(info).toHaveBeenCalledTimes(1); // no describe -> no success line
  });

  test('a job that throws synchronously is caught too', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(runOnce({ name: 'S', run: () => { throw new Error('sync'); } }, 'Startup pass')).resolves.toBeUndefined();
  });

  test('startJobs: boot runs only for atBoot jobs, every job is scheduled with its cron', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const a = jest.fn(async () => 0);
    const b = jest.fn(async () => 0);
    const schedule = jest.fn(() => ({}));
    startJobs([
      { name: 'A', cron: '1 * * * *', label: 'a', atBoot: true, run: a },
      { name: 'B', cron: '2 * * * *', label: 'b', atBoot: false, run: b },
    ], { schedule });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    expect(schedule.mock.calls.map(([c]) => c)).toEqual(['1 * * * *', '2 * * * *']);
    schedule.mock.calls[1][1]();
    expect(b).toHaveBeenCalledTimes(1);
  });

  test('the backend jobs keep their schedules and boot behaviour', () => {
    expect(JOBS.map(({ name, cron, atBoot }) => [name, cron, atBoot])).toEqual([
      ['Analytics', '10 0 * * *', true],
      ['Featured', '5 * * * *', false],
      ['CreditMaturation', '20 0 * * *', true],
      ['AutoConfirm', '15 * * * *', true],
    ]);
    const cron = require('node-cron');
    for (const j of JOBS) expect(cron.validate(j.cron)).toBe(true);
  });
});

describe('Live Hub', () => {
  test('broadcast sends one JSON payload to open clients only', () => {
    const { createLiveHub } = require('../src/realtime/liveHub');
    const hub = createLiveHub();
    const open = { readyState: 1, send: jest.fn() };
    const closed = { readyState: 3, send: jest.fn() };
    hub.wss.clients.add(open);
    hub.wss.clients.add(closed);
    hub.broadcast({ type: 'X', payload: 1 });
    expect(open.send).toHaveBeenCalledWith('{"type":"X","payload":1}');
    expect(closed.send).not.toHaveBeenCalled();
    hub.wss.close();
  });
});
