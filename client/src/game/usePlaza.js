import { useCallback, useEffect, useRef, useState } from 'react';
import { connectPlaza } from './plazaClient';
import { buildAvatarSheet } from './skinLoader';
import { emptyPlaza, applyPlazaMessage, shouldSendMove, MAX_REMOTE_PLAYERS } from '../lib/game/plazaState';
import { sanitizeAvatar } from '../lib/game/skins';
import PHRASES from '../config/plazaPhrases.json';

const MAX_MESSAGES = 30;

const VISIBLE_KEY = 'cardbrix_game_visible';

function readVisible() {
  try { return localStorage.getItem(VISIBLE_KEY) !== '0'; } catch { return true; }
}

/**
 * Connects the running scene (`gameRef.current`, once `ready`) to the plaza: other players appear, walk and
 * leave in the scene; our own moves go out throttled. Returns what the HUD needs.
 * `onSaid({ id, u, k, x, mine })` fires for every chat message (ours included), e.g. to show a speech bubble: `k` a
 * fixed phrase / emoji, or `x` a typed text (already moderated by the server).
 * `start` = { map, spawn } where the scene put the character, sent with the first hello. Players only see the
 * others of the same map; `travel(to)` takes us through a linking door.
 */
export default function usePlaza({ gameRef, ready, onSaid, start = {} }) {
  const [status, setStatus] = useState('connecting');
  const [visible, setVisibleState] = useState(readVisible);
  const stateRef = useRef(emptyPlaza());
  const clientRef = useRef(null);
  const lastSentRef = useRef(null);
  const shownRef = useRef(new Set()); // ids currently added to the scene
  // last chat messages: { n, id, u, k | x, mine }, or { n, notice: { key, vars, muted? } } shown only to us
  const [messages, setMessages] = useState([]);
  const [cooldown, setCooldown] = useState(false);
  const [chat, setChat] = useState({ freeText: false, maxLength: 140 }); // typed messages on? (server setting)
  const [sending, setSending] = useState(null); // our typed message being moderated: its number, or null
  const sendingRef = useRef(null);
  const onSaidRef = useRef(onSaid);
  useEffect(() => { onSaidRef.current = onSaid; }, [onSaid]);
  const counterRef = useRef(0);
  const startRef = useRef(start);

  useEffect(() => {
    if (!ready) return undefined;
    const shown = shownRef.current;

    const show = async (p) => {
      if (shown.has(p.id) || shown.size >= MAX_REMOTE_PLAYERS) return;
      shown.add(p.id);
      const avatar = sanitizeAvatar(p.a);
      try {
        const sheet = await buildAvatarSheet(avatar);
        if (!shown.has(p.id)) return; // left while the sheet was being built
        gameRef.current?.addRemote({ id: p.id, username: p.u, avatarKey: JSON.stringify(avatar), sheet, x: p.x, y: p.y, d: p.d });
      } catch (err) {
        shown.delete(p.id);
        console.error('Plaza: could not draw a player', err);
      }
    };
    const hide = (id) => {
      shown.delete(id);
      gameRef.current?.removeRemote(id);
    };

    const client = connectPlaza({
      visible: readVisible(),
      // the first hello says where the scene started; a reconnect says where the character is now
      where: () => gameRef.current?.whereAmI() || startRef.current,
      onStatus: setStatus,
      onMessage: (msg) => {
        if (msg.t === 'correct') {
          gameRef.current?.setPosition(msg.x, msg.y, msg.map);
          return;
        }
        // the server says we are in another map than the scene shows (e.g. a refused travel): follow it
        if (msg.t === 'welcome' && msg.you && msg.map && gameRef.current && gameRef.current.whereAmI().map !== msg.map) {
          gameRef.current.setPosition(msg.x, msg.y, msg.map);
        }
        if (msg.t === 'welcome' && msg.chat) setChat({ freeText: Boolean(msg.chat.freeText), maxLength: msg.chat.maxLength || 140 });
        if (msg.t === 'chat_config') {
          setChat({ freeText: Boolean(msg.freeText), maxLength: msg.maxLength || 140 });
          return;
        }
        if (msg.t === 'said') {
          const mine = msg.id === stateRef.current.you;
          const text = typeof msg.x === 'string' ? { x: msg.x } : { k: msg.k };
          const entry = { n: ++counterRef.current, id: msg.id, u: String(msg.u || ''), ...text, mine };
          setMessages((list) => [...list.slice(-(MAX_MESSAGES - 1)), entry]);
          if (mine && msg.n != null && msg.n === sendingRef.current) { sendingRef.current = null; setSending(null); }
          onSaidRef.current?.(entry);
          return;
        }
        if (msg.t === 'chat_refused') {
          if (msg.n != null && msg.n === sendingRef.current) { sendingRef.current = null; setSending(null); }
          const entry = { n: ++counterRef.current, refused: msg };
          setMessages((list) => [...list.slice(-(MAX_MESSAGES - 1)), entry]);
          if (msg.reason === 'disabled') setChat((c) => ({ ...c, freeText: false }));
          return;
        }
        const prev = stateRef.current;
        const next = applyPlazaMessage(prev, msg);
        if (next === prev) return;
        stateRef.current = next;
        if (msg.t === 'welcome') {
          for (const id of [...shown]) if (!next.players[id]) hide(id);
          for (const p of Object.values(next.players)) show(p);
        } else if (msg.t === 'join') {
          const p = next.players[msg.p.id];
          if (shown.has(p.id) && prev.players[p.id] && JSON.stringify(prev.players[p.id].a) !== JSON.stringify(p.a)) hide(p.id); // changed look
          show(p);
        } else if (msg.t === 'leave') {
          hide(msg.id);
        } else if (msg.t === 'moves') {
          for (const mv of msg.list) {
            const p = next.players[mv.id];
            if (p) gameRef.current?.moveRemote(mv.id, { x: mv.x, y: mv.y, d: p.d, m: mv.m });
          }
        }
      },
    });
    clientRef.current = client;

    return () => {
      client.close();
      clientRef.current = null;
      for (const id of [...shown]) hide(id);
      stateRef.current = emptyPlaza();
      lastSentRef.current = null;
    };
  }, [ready, gameRef]);

  /** Called by the scene every frame with our position; sends at most ~10 updates per second. */
  const reportMove = useCallback((move) => {
    const now = performance.now();
    if (!shouldSendMove(lastSentRef.current, move, now)) return;
    lastSentRef.current = { ...move, at: now };
    clientRef.current?.sendMove(move);
  }, []);

  const setVisible = useCallback((v) => {
    setVisibleState(v);
    try { localStorage.setItem(VISIBLE_KEY, v ? '1' : '0'); } catch { /* blocked */ }
    clientRef.current?.setVisible(v);
  }, []);

  /** Sends a fixed phrase / emoji; the buttons rest for the same cooldown the server enforces. */
  const say = useCallback((k) => {
    if (cooldown) return;
    clientRef.current?.say(k);
    setCooldown(true);
    setTimeout(() => setCooldown(false), PHRASES.cooldownMs);
  }, [cooldown]);

  /**
   * Sends a typed message; the server moderates it and answers with the message itself (`said`) or a refusal
   * (`chat_refused`). Returns false when it could not be sent (offline, resting, another one still being checked).
   */
  const sendText = useCallback((text) => {
    if (cooldown || sendingRef.current != null) return false;
    const n = ++counterRef.current;
    if (!clientRef.current?.chat(text, n)) return false;
    sendingRef.current = n;
    setSending(n);
    // no answer (connection lost while checking): free the box again
    setTimeout(() => { if (sendingRef.current === n) { sendingRef.current = null; setSending(null); } }, 10000);
    setCooldown(true);
    setTimeout(() => setCooldown(false), PHRASES.cooldownMs);
    return true;
  }, [cooldown]);

  /** Walks through a linking door: the players of this map disappear, the server sends those of the next one. */
  const travel = useCallback((to) => {
    for (const id of [...shownRef.current]) {
      shownRef.current.delete(id);
      gameRef.current?.removeRemote(id);
    }
    stateRef.current = { ...emptyPlaza(), you: stateRef.current.you };
    clientRef.current?.travel(to);
  }, [gameRef]);

  /** The public info of another player (for the card shown when they are tapped). */
  const playerInfo = useCallback((id) => stateRef.current.players[id] || null, []);

  return { status, visible, setVisible, reportMove, playerInfo, messages, say, cooldown, travel, chat, sendText, sending: sending != null };
}
