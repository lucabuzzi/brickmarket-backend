// /api/admin/game-chat (src/routes/adminGameChat.js): only admins; settings validated and pushed to the plaza at
// once; banned terms; the blocked-messages log; muting by name; the "try a message" preview. Plus the new repository
// queries and the moderator's preview. Offline: auth, repository and moderator are fakes, the HTTP is real.
jest.mock('../src/db', () => ({ query: jest.fn() }));

const http = require('http');
const express = require('express');
const { createAdminGameChatRouter } = require('../src/routes/adminGameChat');
const settings = require('../src/services/chatModeration/settings');

const ADMIN = 'aaaaaaaa-0000-4000-8000-000000000001';
const PLAYER = 'bbbbbbbb-0000-4000-8000-000000000002';

function fakeRepo() {
  const state = { settings: {}, terms: [{ id: 1, term: 'stronz*' }], mutes: [], log: [] };
  return {
    state,
    getSettings: jest.fn(async () => settings.merge(Object.entries(state.settings).map(([key, value]) => ({ key, value })))),
    listSettingRows: jest.fn(async () => Object.keys(state.settings).map((key) => ({ key, updated_at: '2026-10-22T10:00:00Z' }))),
    setSetting: jest.fn(async (key, value) => { state.settings[key] = value; return value; }),
    listTerms: jest.fn(async () => state.terms),
    addTerm: jest.fn(async (term) => {
      const clean = term.trim().toLowerCase();
      if (state.terms.some((t) => t.term === clean)) return null;
      const row = { id: state.terms.length + 1, term: clean };
      state.terms.push(row);
      return row;
    }),
    removeTerm: jest.fn(async (id) => { const n = state.terms.length; state.terms = state.terms.filter((t) => t.id !== id); return state.terms.length < n; }),
    listLog: jest.fn(async () => ({ rows: state.log, total: state.log.length })),
    listMutes: jest.fn(async () => state.mutes),
    findUser: jest.fn(async (name) => (String(name).toLowerCase() === 'mario' ? { id: PLAYER, username: 'Mario' } : null)),
    setMute: jest.fn(async () => {}),
    clearMute: jest.fn(async (id) => id === PLAYER),
  };
}

let server;
let base;
let repo;
let moderator;
let changed;

beforeEach(async () => {
  repo = fakeRepo();
  moderator = { preview: jest.fn(async (text) => (/insta/.test(text) ? { ok: false, reason: 'blocked', source: 'ai', category: 'contact', detail: null } : { ok: true, text })) };
  changed = jest.fn();
  const app = express();
  app.use(express.json());
  const auth = (req, res, next) => {
    const role = req.header('x-test-role');
    if (!role) return res.status(401).json({ error: 'no token' });
    if (role !== 'admin') return res.status(403).json({ error: 'not admin' });
    req.user = { userId: ADMIN };
    return next();
  };
  app.use('/api/admin/game-chat', createAdminGameChatRouter({ repo, moderator, authMiddleware: auth, onSettingsChanged: changed }));
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/api/admin/game-chat`;
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  jest.restoreAllMocks();
});

const call = async (method, path, body, role = 'admin') => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

describe('access', () => {
  test.each([['GET', '/'], ['PUT', '/settings/free_text_enabled'], ['POST', '/terms'], ['GET', '/log'], ['POST', '/mutes'], ['POST', '/preview']])(
    '%s %s: logged out 401, not admin 403', async (method, path) => {
      expect((await call(method, path, method === 'GET' ? undefined : {}, null)).status).toBe(401);
      expect((await call(method, path, method === 'GET' ? undefined : {}, 'user')).status).toBe(403);
      expect(repo.setSetting).not.toHaveBeenCalled();
    },
  );
});

describe('settings', () => {
  test('the page gets the settings, defaults, limits, terms and mutes', async () => {
    repo.state.settings.max_length = 200;
    const { status, body } = await call('GET', '/');
    expect(status).toBe(200);
    expect(body.settings).toMatchObject({ free_text_enabled: false, max_length: 200 });
    expect(body.defaults.max_length).toBe(140);
    expect(body.ranges.max_length).toEqual([10, 500]);
    expect(body.updatedAt).toEqual({ max_length: '2026-10-22T10:00:00Z' });
    expect(body.terms).toEqual([{ id: 1, term: 'stronz*' }]);
  });

  test('switching typed chat on is stored and pushed to the plaza at once', async () => {
    expect(await call('PUT', '/settings/free_text_enabled', { value: true })).toEqual({ status: 200, body: { key: 'free_text_enabled', value: true } });
    expect(repo.setSetting).toHaveBeenCalledWith('free_text_enabled', true, ADMIN);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  test('the AI rules are cleaned', async () => {
    const { body } = await call('PUT', '/settings/custom_rules', { value: ['  niente vendite fuori   sito ', ''] });
    expect(body.value).toEqual(['niente vendite fuori sito']);
  });

  test.each([
    ['free_text_enabled', 'yes'], ['max_length', 5000], ['mute_minutes', 0], ['custom_rules', 'one rule'],
  ])('invalid %s = %p: 400 with a message, nothing stored', async (key, value) => {
    const { status, body } = await call('PUT', `/settings/${key}`, { value });
    expect(status).toBe(400);
    expect(body.error).toMatch(/\S/);
    expect(repo.setSetting).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  test('an unknown setting is 404', async () => {
    expect((await call('PUT', '/settings/drop_table', { value: 1 })).status).toBe(404);
  });
});

describe('banned terms', () => {
  test('add, refuse duplicates and bad ones, remove', async () => {
    expect(await call('POST', '/terms', { term: ' Porco Giuda ' })).toEqual({ status: 201, body: { id: 2, term: 'porco giuda' } });
    expect((await call('POST', '/terms', { term: 'porco giuda' })).status).toBe(409);
    expect((await call('POST', '/terms', { term: '  ' })).status).toBe(400);
    expect((await call('POST', '/terms', { term: 'x'.repeat(81) })).status).toBe(400);
    expect((await call('DELETE', '/terms/2')).status).toBe(200);
    expect((await call('DELETE', '/terms/2')).status).toBe(404);
    expect((await call('DELETE', '/terms/abc')).status).toBe(400);
  });
});

describe('log', () => {
  test('paged, capped at 200, filterable by a valid user id', async () => {
    await call('GET', '/log?limit=999&offset=-3');
    expect(repo.listLog).toHaveBeenLastCalledWith({ limit: 200, offset: 0, userId: null });
    await call('GET', `/log?userId=${PLAYER}`);
    expect(repo.listLog).toHaveBeenLastCalledWith({ limit: 50, offset: 0, userId: PLAYER });
    expect((await call('GET', '/log?userId=1;drop')).status).toBe(400);
  });
});

describe('mutes', () => {
  test('mute by username (any case) for some minutes, by this admin', async () => {
    const t0 = Date.now();
    const { status, body } = await call('POST', '/mutes', { username: 'MARIO', minutes: 60 });
    expect(status).toBe(200);
    expect(body).toMatchObject({ user_id: PLAYER, username: 'Mario', reason: 'admin' });
    const [id, until, reason, by] = repo.setMute.mock.calls[0];
    expect([id, reason, by]).toEqual([PLAYER, 'admin', ADMIN]);
    expect(until.getTime() - t0).toBeGreaterThanOrEqual(60 * 60 * 1000 - 50);
  });

  test.each([[{ username: 'nobody', minutes: 10 }, 404], [{ username: 'mario', minutes: 0 }, 400], [{ username: 'mario', minutes: 1.5 }, 400], [{ username: 'mario' }, 400]])(
    '%o -> %i', async (body, status) => {
      expect((await call('POST', '/mutes', body)).status).toBe(status);
      expect(repo.setMute).not.toHaveBeenCalled();
    },
  );

  test('unmute', async () => {
    expect((await call('DELETE', `/mutes/${PLAYER}`)).status).toBe(200);
    expect((await call('DELETE', `/mutes/${ADMIN}`)).status).toBe(404);
    expect((await call('DELETE', '/mutes/not-a-uuid')).status).toBe(400);
  });
});

describe('preview', () => {
  test('says whether a message would pass, and why not', async () => {
    expect((await call('POST', '/preview', { text: 'ciao' })).body).toEqual({ ok: true, text: 'ciao' });
    expect((await call('POST', '/preview', { text: 'su insta' })).body).toMatchObject({ ok: false, category: 'contact', source: 'ai' });
    expect((await call('POST', '/preview', {})).status).toBe(400);
  });

  test('a server error is a 500 without details', async () => {
    moderator.preview.mockRejectedValue(new Error('secret detail'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = await call('POST', '/preview', { text: 'x' });
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});

describe('moderator preview (the real one)', () => {
  const { createChatModerator } = require('../src/services/chatModeration');
  const { terms: SEED } = require('../src/config/gameChatBannedTerms.json');
  const make = (moderate, stored = {}) => {
    const r = {
      getSettings: async () => settings.merge(Object.entries(stored).map(([key, value]) => ({ key, value }))),
      getTerms: async () => SEED,
      logBlocked: jest.fn(),
      setMute: jest.fn(),
      getMute: jest.fn(),
    };
    return { r, m: createChatModerator({ repo: r, moderate, log: { warn() {}, error() {} } }) };
  };

  test('works while typed chat is off; nothing logged, nobody muted', async () => {
    const { r, m } = make(async () => ({ allowed: true, category: 'ok', rule: null }), { strike_threshold: 1 });
    expect(await m.preview('ciao')).toEqual({ ok: true, text: 'ciao' });
    expect(await m.preview('stronzo')).toEqual({ ok: false, reason: 'blocked', source: 'rule', category: 'banned_word', detail: 'stronz*' });
    expect(r.logBlocked).not.toHaveBeenCalled();
    expect(r.setMute).not.toHaveBeenCalled();
    expect(r.getMute).not.toHaveBeenCalled();
  });

  test('the AI verdict with the admin rule broken; an AI error says why', async () => {
    const { m } = make(async () => ({ allowed: false, category: 'custom_rule', rule: 1 }), { custom_rules: ['niente spam'] });
    expect(await m.preview('compra qui')).toEqual({ ok: false, reason: 'blocked', source: 'ai', category: 'custom_rule', detail: 'regola 1: niente spam' });
    const broken = make(async () => { throw Object.assign(new Error('x'), { code: 'timeout' }); });
    expect(await broken.m.preview('ciao')).toEqual({ ok: false, reason: 'unavailable', detail: 'timeout' });
  });
});

describe('repository queries for the page', () => {
  const { createGameChatRepository, gameChatRepository } = require('../src/repositories/gameChatRepository');

  test('the log: newest first, paged, one player only when asked', async () => {
    const q = jest.fn(async (sql) => (sql.includes('COUNT') ? { rows: [{ n: 7 }] } : { rows: [{ id: 1 }] }));
    const repo = createGameChatRepository({ db: { query: q } });
    expect(await repo.listLog({ limit: 10, offset: 20, userId: PLAYER })).toEqual({ rows: [{ id: 1 }], total: 7 });
    expect(q.mock.calls[0][0]).toMatch(/WHERE user_id = \$3 ORDER BY created_at DESC/);
    expect(q.mock.calls[0][1]).toEqual([10, 20, PLAYER]);
    expect(q.mock.calls[1][1]).toEqual([PLAYER]);
  });

  test('finding a player ignores case and spaces', async () => {
    const q = jest.fn(async () => ({ rows: [{ id: PLAYER, username: 'Mario' }] }));
    await createGameChatRepository({ db: { query: q } }).findUser('  MARIO ');
    expect(q.mock.calls[0]).toEqual(['SELECT id, username FROM public.users WHERE lower(username) = lower($1) LIMIT 1', ['MARIO']]);
  });

  test('one shared instance for the plaza and the admin page', () => {
    expect(gameChatRepository()).toBe(gameChatRepository());
  });
});
