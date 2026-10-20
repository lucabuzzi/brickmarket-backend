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
 * `onSaid({ id, u, k, mine })` fires for every chat message (ours included), e.g. to show a speech bubble.
 * `start` = { map, spawn } where the scene put the character, sent with the first hello. Players only see the
 * others of the same map; `travel(to)` takes us through a linking door.
 */
export default function usePlaza({ gameRef, ready, onSaid, start = {} }) {
  const [status, setStatus] = useState('connecting');
  const [count, setCount] = useState(0);
  const [visible, setVisibleState] = useState(readVisible);
  const stateRef = useRef(emptyPlaza());
  const clientRef = useRef(null);
  const lastSentRef = useRef(null);
  const shownRef = useRef(new Set()); // ids currently added to the scene
  const [messages, setMessages] = useState([]); // last chat messages: { n, id, u, k, mine }
  const [cooldown, setCooldown] = useState(false);
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
        if (msg.t === 'said') {
          const mine = msg.id === stateRef.current.you;
          const entry = { n: ++counterRef.current, id: msg.id, u: String(msg.u || ''), k: msg.k, mine };
          setMessages((list) => [...list.slice(-(MAX_MESSAGES - 1)), entry]);
          onSaidRef.current?.(entry);
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
        setCount(Object.keys(next.players).length);
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

  /** Walks through a linking door: the players of this map disappear, the server sends those of the next one. */
  const travel = useCallback((to) => {
    for (const id of [...shownRef.current]) {
      shownRef.current.delete(id);
      gameRef.current?.removeRemote(id);
    }
    stateRef.current = { ...emptyPlaza(), you: stateRef.current.you };
    setCount(0);
    clientRef.current?.travel(to);
  }, [gameRef]);

  /** The public info of another player (for the card shown when they are tapped). */
  const playerInfo = useCallback((id) => stateRef.current.players[id] || null, []);

  return { status, count, visible, setVisible, reportMove, playerInfo, messages, say, cooldown, travel };
}
