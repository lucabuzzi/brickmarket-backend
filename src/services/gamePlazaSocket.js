// WebSocket channel of the game plaza (/ws/game). Separate from the public "Live Hub" broadcast socket in
// server.js: here every connection must identify itself with the site's JWT before it sees or is seen by anyone.
//
// Players are in one map at a time (the plaza or the market inside the castle, client/src/config/gameMaps.json):
// everything below (join, leave, moves, chat) only reaches the players of the same map.
//
// Protocol (JSON text frames):
//   client -> server  { t: 'hello', token, visible, map, spawn }  first message, within HELLO_TIMEOUT_MS
//                                                       (map/spawn: where the client starts, default the plaza)
//                     { t: 'move', x, y, d, m }           own position (d = down|up|right|left, m = walking)
//                     { t: 'visible', v }                 show / hide me in the plaza
//                     { t: 'say', k }                     say a fixed phrase / emoji (client/src/config/plazaPhrases.json)
//                     { t: 'travel', to }                 walk through a linking door into map `to`
//   server -> client  { t: 'welcome', you, map, x, y, players }  after a valid hello or travel: where I am and
//                                                       who is already in that map
//                     { t: 'join', p } / { t: 'leave', id }
//                     { t: 'moves', list }                batched every TICK_MS, never includes the receiver
//                     { t: 'correct', map, x, y }         a move or travel was impossible: snap back here
//                     { t: 'said', id, u, k }             someone (also the sender) said phrase k
// Close codes: 4001 missing/invalid hello, 4002 replaced by a newer connection of the same account,
//              4003 account not allowed (disabled / unknown).
const WebSocket = require('ws');
const { PlazaRoom } = require('./gamePlaza');

/**
 * @param {object} deps
 * @param {(token: string) => { userId: string }} deps.verifyToken  throws on an invalid token (jwt.verify)
 * @param {(userId: string) => Promise<{ id, username, avatar_config, is_active } | null>} deps.loadUser
 */
function createPlaza({ verifyToken, loadUser, room = new PlazaRoom(), tickMs = 100, helloTimeoutMs = 5000, heartbeatMs = 30000 }) {
  const wss = new WebSocket.Server({ noServer: true, maxPayload: 2048 });
  const sockets = new Map(); // userId -> ws (one live connection per account)

  const send = (ws, obj) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };
  // to everyone in `map` except `exceptId`
  const broadcast = (map, obj, exceptId) => {
    const payload = JSON.stringify(obj);
    for (const [id, ws] of sockets) {
      const p = room.get(id);
      if (id !== exceptId && p && p.map === map && ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  };
  const welcome = (ws, p) => send(ws, { t: 'welcome', you: p.id, map: p.map, x: p.x, y: p.y, players: room.visiblePlayers(p.id, p.map) });

  wss.on('connection', (ws) => {
    let userId = null;
    let authing = false;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    const helloTimer = setTimeout(() => ws.close(4001, 'hello timeout'), helloTimeoutMs);

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (!msg || typeof msg !== 'object') return;

      if (!userId) {
        if (authing) return;
        if (msg.t !== 'hello' || typeof msg.token !== 'string') { ws.close(4001, 'hello required'); return; }
        authing = true;
        let claims;
        try { claims = verifyToken(msg.token); } catch { ws.close(4001, 'invalid token'); return; }
        let user = null;
        try { user = await loadUser(claims && claims.userId); } catch (err) { console.error('Plaza loadUser failed:', err.message); }
        if (!user || user.is_active === false) { ws.close(4003, 'not allowed'); return; }
        if (ws.readyState !== WebSocket.OPEN) return; // gave up while we were checking
        clearTimeout(helloTimer);
        userId = user.id;
        const previous = sockets.get(userId);
        if (previous && previous !== ws) previous.close(4002, 'replaced');
        sockets.set(userId, ws);
        const p = room.join(user, { visible: msg.visible !== false, map: msg.map, spawn: msg.spawn });
        welcome(ws, p);
        if (p.visible) broadcast(p.map, { t: 'join', p: room.publicView(p) }, userId);
        return;
      }

      if (msg.t === 'move') {
        if (room.move(userId, msg) === 'rejected') {
          const p = room.get(userId);
          send(ws, { t: 'correct', map: p.map, x: p.x, y: p.y });
        }
      } else if (msg.t === 'travel') {
        const r = room.travel(userId, msg.to);
        const p = room.get(userId);
        if (!r) { send(ws, { t: 'correct', map: p.map, x: p.x, y: p.y }); return; }
        if (p.visible) {
          broadcast(r.from, { t: 'leave', id: userId }, userId);
          broadcast(r.to, { t: 'join', p: room.publicView(p) }, userId);
        }
        welcome(ws, p);
      } else if (msg.t === 'say') {
        if (room.say(userId, msg.k) === 'ok') {
          const p = room.get(userId);
          const said = { t: 'said', id: userId, u: p.username, k: msg.k };
          broadcast(p.map, said, userId);
          send(ws, said); // the sender sees their own message too
        }
      } else if (msg.t === 'visible') {
        const r = room.setVisible(userId, msg.v);
        const p = room.get(userId);
        if (r.changed) broadcast(p.map, r.visible ? { t: 'join', p: room.publicView(p) } : { t: 'leave', id: userId }, userId);
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (userId && sockets.get(userId) === ws) {
        sockets.delete(userId);
        const p = room.get(userId);
        if (room.leave(userId)) broadcast(p.map, { t: 'leave', id: userId });
      }
    });
  });

  const tick = setInterval(() => {
    const moves = room.takeDirtyMoves();
    if (!moves.length) return;
    for (const [id, ws] of sockets) {
      const me = room.get(id);
      if (!me) continue;
      const list = moves.filter((mv) => mv.id !== id && mv.map === me.map).map(({ map, ...mv }) => mv);
      if (list.length) send(ws, { t: 'moves', list });
    }
  }, tickMs);

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, heartbeatMs);

  return {
    wss,
    room,
    handleUpgrade(request, socket, head) {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    },
    close() {
      clearInterval(tick);
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}

module.exports = { createPlaza };
