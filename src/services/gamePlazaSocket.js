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
//                     { t: 'chat', text, n }              say a typed message (n: the client's number for it); it is
//                                                       moderated BEFORE anyone sees it (src/services/chatModeration)
//                     { t: 'travel', to }                 walk through a linking door into map `to`
//   server -> client  { t: 'welcome', you, map, x, y, players, chat }  after a valid hello or travel: where I am,
//                                                       who is already in that map, and chat = { freeText, maxLength }
//                     { t: 'chat_config', freeText, maxLength }  the admin switched typed messages on/off
//                     { t: 'join', p } / { t: 'leave', id }
//                     { t: 'moves', list }                batched every TICK_MS, never includes the receiver
//                     { t: 'correct', map, x, y }         a move or travel was impossible: snap back here
//                     { t: 'said', id, u, k }             someone (also the sender) said phrase k
//                     { t: 'said', id, u, x[, n] }        someone said the typed text x (n only in the sender's copy)
//                     { t: 'chat_refused', n, reason, category?, until? }  only to the sender: message n reached
//                                                       nobody. reason: disabled | hidden | cooldown | empty | too_long |
//                                                       muted | blocked | unavailable (see chatModeration/index.js)
// Close codes: 4001 missing/invalid hello, 4002 replaced by a newer connection of the same account,
//              4003 account not allowed (disabled / unknown).
const WebSocket = require('ws');
const { PlazaRoom } = require('./gamePlaza');

/**
 * @param {object} deps
 * @param {(token: string) => { userId: string }} deps.verifyToken  throws on an invalid token (jwt.verify)
 * @param {(userId: string) => Promise<{ id, username, avatar_config, is_active } | null>} deps.loadUser
 * @param {{ check, config }} [deps.moderator]  the typed-chat moderator (chatModeration/index.js); none = typed chat off
 */
function createPlaza({
  verifyToken, loadUser, moderator = null, room = new PlazaRoom(), tickMs = 100, helloTimeoutMs = 5000, heartbeatMs = 30000, chatRefreshMs = 30000,
}) {
  const wss = new WebSocket.Server({ noServer: true, maxPayload: 2048 });
  const sockets = new Map(); // userId -> ws (one live connection per account)

  // whether typed messages are on (admin setting), re-read every chatRefreshMs: a change reaches everyone connected
  let chat = { freeText: false, maxLength: 140 };
  const refreshChat = async () => {
    if (!moderator) return;
    let next;
    try { next = await moderator.config(); } catch (err) { console.error('Plaza chat config failed:', err.message); return; }
    if (next.freeText === chat.freeText && next.maxLength === chat.maxLength) return;
    chat = { freeText: Boolean(next.freeText), maxLength: next.maxLength };
    const payload = JSON.stringify({ t: 'chat_config', ...chat });
    for (const ws of sockets.values()) if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  };
  refreshChat();
  const chatTimer = setInterval(refreshChat, chatRefreshMs);

  const send = (ws, obj) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };
  // to everyone in `map` except `exceptId`
  const broadcast = (map, obj, exceptId) => {
    const payload = JSON.stringify(obj);
    for (const [id, ws] of sockets) {
      const p = room.get(id);
      if (id !== exceptId && p && p.map === map && ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  };
  const welcome = (ws, p) => send(ws, { t: 'welcome', you: p.id, map: p.map, x: p.x, y: p.y, players: room.visiblePlayers(p.id, p.map), chat });

  wss.on('connection', (ws) => {
    let userId = null;
    let authing = false;
    let checking = false; // a typed message is being moderated: the next one waits for it
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
      } else if (msg.t === 'chat') {
        const n = Number.isInteger(msg.n) ? msg.n : null;
        const refuse = (reason, extra = {}) => send(ws, { t: 'chat_refused', n, reason, ...extra });
        if (!moderator || !chat.freeText) { refuse('disabled'); return; }
        if (typeof msg.text !== 'string') return;
        if (checking) { refuse('cooldown'); return; }
        const r = room.speak(userId);
        if (r !== 'ok') { refuse(r === 'cooldown' ? 'cooldown' : 'hidden'); return; }
        checking = true;
        let verdict;
        try {
          verdict = await moderator.check({ id: userId, username: room.get(userId)?.username }, msg.text.slice(0, 1000));
        } catch (err) {
          console.error('Plaza chat moderation failed:', err.message);
          verdict = { ok: false, reason: 'unavailable' };
        } finally {
          checking = false;
        }
        // gone (or replaced by another connection) while the message was being checked
        if (ws.readyState !== WebSocket.OPEN || sockets.get(userId) !== ws) return;
        const p = room.get(userId);
        if (!p) return;
        if (!verdict.ok) {
          refuse(verdict.reason, {
            ...(verdict.category ? { category: verdict.category } : {}),
            ...(verdict.mutedUntil ? { until: new Date(verdict.mutedUntil).toISOString() } : {}),
          });
          if (verdict.reason === 'disabled') refreshChat();
          return;
        }
        if (!p.visible) { refuse('hidden'); return; }
        const said = { t: 'said', id: userId, u: p.username, x: verdict.text };
        broadcast(p.map, said, userId);
        send(ws, { ...said, n });
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
    refreshChat,
    handleUpgrade(request, socket, head) {
      wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
    },
    close() {
      clearInterval(tick);
      clearInterval(heartbeat);
      clearInterval(chatTimer);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}

module.exports = { createPlaza };
