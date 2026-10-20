// The plaza WebSocket channel (src/services/gamePlazaSocket.js) end to end with REAL sockets on a local port and
// injected auth (no DB, no JWT secret): hello/auth, players seeing each other join/move/leave, visibility,
// one connection per account, and impossible moves being corrected.
const http = require('http');
const WebSocket = require('ws');
const { createPlaza } = require('../src/services/gamePlazaSocket');
const { PlazaRoom, PLAZA_WORLD } = require('../src/services/gamePlaza');

const USERS = {
  'tok-a': { id: 'a', username: 'alice', avatar_config: null, is_active: true },
  'tok-b': { id: 'b', username: 'bob', avatar_config: null, is_active: true },
  'tok-off': { id: 'z', username: 'zed', avatar_config: null, is_active: false },
};

let server;
let plaza;
let url;
const open = [];

beforeEach(async () => {
  plaza = createPlaza({
    verifyToken: (token) => { if (!USERS[token]) throw new Error('bad'); return { userId: token }; },
    loadUser: async (token) => USERS[token] || null,
    room: new PlazaRoom({ minIntervalMs: 0 }),
    tickMs: 20,
    helloTimeoutMs: 300,
    heartbeatMs: 60000,
  });
  server = http.createServer();
  server.on('upgrade', (req, socket, head) => plaza.handleUpgrade(req, socket, head));
  await new Promise((r) => server.listen(0, r));
  url = `ws://127.0.0.1:${server.address().port}/ws/game`;
});

afterEach(async () => {
  for (const ws of open) try { ws.terminate(); } catch { /* already closed */ }
  open.length = 0;
  plaza.close();
  await new Promise((r) => server.close(r));
});

/** A client that records every message; resolves once connected. */
async function client() {
  const ws = new WebSocket(url);
  open.push(ws);
  ws.inbox = [];
  ws.on('message', (raw) => ws.inbox.push(JSON.parse(raw)));
  ws.closed = new Promise((r) => ws.on('close', (code) => r(code)));
  await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  return ws;
}
const sendJson = (ws, obj) => ws.send(JSON.stringify(obj));
async function waitFor(ws, pred, ms = 1500) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const hit = ws.inbox.find(pred);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`timeout; inbox: ${JSON.stringify(ws.inbox)}`);
}
async function joined(token, visible = true) {
  const ws = await client();
  sendJson(ws, { t: 'hello', token, visible });
  await waitFor(ws, (m) => m.t === 'welcome');
  return ws;
}

describe('authentication', () => {
  test('an invalid token is closed with 4001 and never welcomed', async () => {
    const ws = await client();
    sendJson(ws, { t: 'hello', token: 'forged' });
    expect(await ws.closed).toBe(4001);
    expect(ws.inbox).toEqual([]);
  });

  test('anything other than hello first is refused', async () => {
    const ws = await client();
    sendJson(ws, { t: 'move', x: 1, y: 1, d: 'down' });
    expect(await ws.closed).toBe(4001);
  });

  test('silence after connecting times out', async () => {
    const ws = await client();
    expect(await ws.closed).toBe(4001);
  });

  test('a disabled account is refused with 4003', async () => {
    const ws = await client();
    sendJson(ws, { t: 'hello', token: 'tok-off' });
    expect(await ws.closed).toBe(4003);
  });

  test('a valid hello gets a welcome with the caller id and the players already there', async () => {
    const a = await joined('tok-a');
    const b = await client();
    sendJson(b, { t: 'hello', token: 'tok-b' });
    const welcome = await waitFor(b, (m) => m.t === 'welcome');
    expect(welcome.you).toBe('b');
    expect(welcome.players.map((p) => p.u)).toEqual(['alice']);
    expect(a).toBeTruthy();
  });
});

describe('seeing each other', () => {
  test('join, move and leave reach the other player, never the mover', async () => {
    const a = await joined('tok-a');
    const b = await joined('tok-b');
    const join = await waitFor(a, (m) => m.t === 'join');
    expect(join.p).toMatchObject({ id: 'b', u: 'bob' });

    await new Promise((r) => setTimeout(r, 30));
    sendJson(b, { t: 'move', x: PLAZA_WORLD.spawn.x + 3, y: PLAZA_WORLD.spawn.y, d: 'right', m: true });
    const moves = await waitFor(a, (m) => m.t === 'moves');
    expect(moves.list).toEqual([{ id: 'b', x: PLAZA_WORLD.spawn.x + 3, y: PLAZA_WORLD.spawn.y, d: 'right', m: true }]);
    await new Promise((r) => setTimeout(r, 60));
    expect(b.inbox.some((m) => m.t === 'moves' && m.list.some((x) => x.id === 'b'))).toBe(false);

    b.close();
    const leave = await waitFor(a, (m) => m.t === 'leave');
    expect(leave.id).toBe('b');
  });

  test('a hidden player is not announced, and appears/disappears when toggling visibility', async () => {
    const a = await joined('tok-a');
    const b = await joined('tok-b', false);
    await new Promise((r) => setTimeout(r, 60));
    expect(a.inbox.some((m) => m.t === 'join')).toBe(false);

    sendJson(b, { t: 'visible', v: true });
    expect((await waitFor(a, (m) => m.t === 'join')).p.id).toBe('b');
    sendJson(b, { t: 'visible', v: false });
    expect((await waitFor(a, (m) => m.t === 'leave')).id).toBe('b');
  });

  test('an impossible move is corrected back to the server position', async () => {
    const b = await joined('tok-b');
    await new Promise((r) => setTimeout(r, 30));
    sendJson(b, { t: 'move', x: 5, y: 5, d: 'up', m: true });
    const fix = await waitFor(b, (m) => m.t === 'correct');
    expect([fix.x, fix.y]).toEqual([PLAZA_WORLD.spawn.x, PLAZA_WORLD.spawn.y]);
  });

  test('garbage frames are ignored without killing the connection', async () => {
    const a = await joined('tok-a');
    a.send('not json');
    a.send('[]');
    sendJson(a, { t: 'unknown' });
    await new Promise((r) => setTimeout(r, 50));
    expect(a.readyState).toBe(WebSocket.OPEN);
  });
});

describe('one connection per account', () => {
  test('logging in again replaces the old connection (4002) without the others seeing a leave', async () => {
    const a = await joined('tok-a');
    const b1 = await joined('tok-b');
    await waitFor(a, (m) => m.t === 'join');
    const b2 = await joined('tok-b');
    expect(await b1.closed).toBe(4002);
    await new Promise((r) => setTimeout(r, 60));
    expect(a.inbox.some((m) => m.t === 'leave')).toBe(false);
    expect(b2.readyState).toBe(WebSocket.OPEN);
  });
});

describe('chat over the socket', () => {
  test('a phrase reaches the others and echoes back to the sender, with the sender name', async () => {
    const a = await joined('tok-a');
    const b = await joined('tok-b');
    sendJson(b, { t: 'say', k: 'hello' });
    expect(await waitFor(a, (m) => m.t === 'said')).toEqual({ t: 'said', id: 'b', u: 'bob', k: 'hello' });
    expect(await waitFor(b, (m) => m.t === 'said')).toEqual({ t: 'said', id: 'b', u: 'bob', k: 'hello' });
  });

  test('free text is dropped silently', async () => {
    const a = await joined('tok-a');
    const b = await joined('tok-b');
    sendJson(b, { t: 'say', k: 'compra fuori dal sito: 333 1234567' });
    await new Promise((r) => setTimeout(r, 80));
    expect(a.inbox.some((m) => m.t === 'said')).toBe(false);
    expect(b.readyState).toBe(WebSocket.OPEN);
  });
});

describe('maps (plaza and the market inside the castle)', () => {
  const hello = async (token, extra) => {
    const ws = await client();
    sendJson(ws, { t: 'hello', token, visible: true, ...extra });
    return { ws, welcome: await waitFor(ws, (m) => m.t === 'welcome') };
  };

  test('a hello can start in the market at a stall; the welcome says where', async () => {
    const { welcome } = await hello('tok-a', { map: 'market', spawn: 'lego' });
    expect(welcome).toMatchObject({ map: 'market', x: 88, y: 150, players: [] });
  });

  test('walking through the castle gate: the plaza sees a leave, the traveller gets a market welcome', async () => {
    const a = await joined('tok-a');
    const { ws: b } = await hello('tok-b', { map: 'plaza', spawn: 'castle' });
    await waitFor(a, (m) => m.t === 'join');
    sendJson(b, { t: 'travel', to: 'market' });
    expect((await waitFor(a, (m) => m.t === 'leave')).id).toBe('b');
    const w = await waitFor(b, (m) => m.t === 'welcome' && m.map === 'market');
    expect(w).toMatchObject({ map: 'market', x: 240, y: 266, players: [] });
  });

  test('a travel far from the door is refused with a correction to the current map', async () => {
    const b = await joined('tok-b');
    sendJson(b, { t: 'travel', to: 'market' });
    expect(await waitFor(b, (m) => m.t === 'correct')).toMatchObject({ map: 'plaza', x: PLAZA_WORLD.spawn.x, y: PLAZA_WORLD.spawn.y });
  });

  test('players in different maps never get each other\'s join, moves or chat', async () => {
    const { ws: a } = await hello('tok-a', { map: 'market' });
    const b = await joined('tok-b');
    await new Promise((r) => setTimeout(r, 30));
    sendJson(b, { t: 'move', x: PLAZA_WORLD.spawn.x + 3, y: PLAZA_WORLD.spawn.y, d: 'right', m: true });
    sendJson(b, { t: 'say', k: 'hello' });
    await waitFor(b, (m) => m.t === 'said');
    await new Promise((r) => setTimeout(r, 80));
    expect(a.inbox.filter((m) => ['join', 'moves', 'said'].includes(m.t))).toEqual([]);
  });
});
