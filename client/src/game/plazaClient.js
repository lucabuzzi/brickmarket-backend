// Browser side of the plaza WebSocket (/ws/game, protocol in src/services/gamePlazaSocket.js). Connects with
// the site's JWT, reconnects with backoff after network drops, and stops for good when the server says the
// login is invalid (4001), the account is not allowed (4003) or another tab took over (4002).
import { TOKEN_STORAGE_KEY } from '../api';

const FINAL_CODES = [4001, 4002, 4003];

function readToken() {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY); } catch { return null; }
}

/**
 * @param {object} opts
 * @param {boolean} opts.visible        start visible in the plaza or not
 * @param {() => { map, spawn }} [opts.where]  where the character is when (re)connecting (default: plaza start)
 * @param {(msg: object) => void} opts.onMessage
 * @param {(status: 'connecting'|'online'|'offline'|'replaced') => void} opts.onStatus
 */
export function connectPlaza({ visible, where = () => ({}), onMessage, onStatus }) {
  const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/game`;
  let ws = null;
  let closed = false;
  let retry = 0;
  let timer = null;
  let isVisible = visible;

  function open() {
    const token = readToken();
    if (!token) { onStatus('offline'); return; }
    onStatus('connecting');
    ws = new WebSocket(url);
    ws.onopen = () => {
      retry = 0;
      const { map, spawn } = where() || {};
      ws.send(JSON.stringify({ t: 'hello', token, visible: isVisible, map, spawn }));
    };
    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.t === 'welcome') onStatus('online');
      onMessage(msg);
    };
    ws.onclose = (event) => {
      if (closed) return;
      onStatus(event.code === 4002 ? 'replaced' : 'offline');
      onMessage({ t: 'welcome', you: null, players: [] }); // forget the others until we are back
      if (FINAL_CODES.includes(event.code)) return;
      timer = setTimeout(open, Math.min(15000, 1000 * 2 ** retry++));
    };
    ws.onerror = () => { /* onclose follows */ };
  }

  open();

  const sendJson = (obj) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); };
  return {
    sendMove(move) { sendJson({ t: 'move', ...move }); },
    setVisible(v) { isVisible = Boolean(v); sendJson({ t: 'visible', v: isVisible }); },
    /** Says one of the fixed phrases / emojis (client/src/config/plazaPhrases.json). */
    say(k) { sendJson({ t: 'say', k }); },
    /** Sends a typed message (n: our number for it, echoed in the answer); false when not connected. */
    chat(text, n) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      sendJson({ t: 'chat', text, n });
      return true;
    },
    /** Walks through a linking door into map `to` (the server checks we are at the door). */
    travel(to) { sendJson({ t: 'travel', to }); },
    close() { closed = true; clearTimeout(timer); if (ws) ws.close(); },
  };
}
