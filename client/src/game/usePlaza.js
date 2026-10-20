import { useCallback, useEffect, useRef, useState } from 'react';
import { connectPlaza } from './plazaClient';
import { buildAvatarSheet } from './skinLoader';
import { emptyPlaza, applyPlazaMessage, shouldSendMove, MAX_REMOTE_PLAYERS } from '../lib/game/plazaState';
import { sanitizeAvatar } from '../lib/game/skins';

const VISIBLE_KEY = 'cardbrix_game_visible';

function readVisible() {
  try { return localStorage.getItem(VISIBLE_KEY) !== '0'; } catch { return true; }
}

/**
 * Connects the running scene (`gameRef.current`, once `ready`) to the plaza: other players appear, walk and
 * leave in the scene; our own moves go out throttled. Returns what the HUD needs.
 */
export default function usePlaza({ gameRef, ready }) {
  const [status, setStatus] = useState('connecting');
  const [count, setCount] = useState(0);
  const [visible, setVisibleState] = useState(readVisible);
  const stateRef = useRef(emptyPlaza());
  const clientRef = useRef(null);
  const lastSentRef = useRef(null);
  const shownRef = useRef(new Set()); // ids currently added to the scene

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
      onStatus: setStatus,
      onMessage: (msg) => {
        if (msg.t === 'correct') {
          gameRef.current?.setPosition(msg.x, msg.y);
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

  /** The public info of another player (for the card shown when they are tapped). */
  const playerInfo = useCallback((id) => stateRef.current.players[id] || null, []);

  return { status, count, visible, setVisible, reportMove, playerInfo };
}
