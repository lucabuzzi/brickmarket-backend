import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, GraduationCap, Pencil, Smartphone, WifiOff } from 'lucide-react';
import DragonStatue from '../components/DragonStatue';
import VirtualJoystick from '../components/VirtualJoystick';
import ChatPanel from '../components/ChatPanel';
import { chatText } from '../chatText';
import { bubbleText } from '../../lib/game/chatInput';
import ContextPanel from '../panel/ContextPanel';
import usePlaza from '../usePlaza';
import { buildAvatarSheet } from '../skinLoader';
import { useAuth } from '../../auth/useAuth';
import { useLocalizedNav } from '../../routing/useLocalizedNav';
import { ALL_PLACES } from '../../lib/game/maps';
import { NPCS, npcById, npcNameKey, npcRoleKey, startNode, chooseOption } from '../../lib/game/npcs';
import { panelReducer, EMPTY_PANEL, currentView } from '../../lib/game/contextPanel';
import { MAP_INTROS, hasSeen, markSeen, clearSeen } from '../../lib/game/firstVisit';
import NpcPortrait from '../panel/NpcPortrait';
import { auctionsUrl, nextEndingAuction } from '../../lib/game/marketQueries';
import { apiFetch } from '../../api';
import {
  startTutorial, tutorialReducer, currentStep, guideTarget, progress, shouldAutoStart, markDone, clearDone,
} from '../../lib/game/tutorial';

const INACTIVE = { active: false, finished: false, index: 0, phase: 'explain' };

/** Who answers at a place: its keeper / merchant, or the NPC itself when the "place" is an NPC standing alone. */
function npcAt(place) {
  if (!place) return null;
  if (place.kind === 'npc') return npcById(place.npc);
  return NPCS.find((n) => n.place === place.id) || null;
}

/** The recoloured sheets of the NPCs drawn in the scene (an NPC whose sheet fails is simply left out). */
async function buildNpcSheets() {
  const entries = await Promise.all(NPCS.filter((n) => n.avatar).map((n) => buildAvatarSheet(n.avatar).then((c) => [n.id, c]).catch(() => null)));
  return Object.fromEntries(entries.filter(Boolean));
}

// A phone held upright (touch screen, narrow, portrait): the plaza is much bigger in landscape.
const PORTRAIT_PHONE = '(pointer: coarse) and (orientation: portrait) and (max-width: 767px)';
// Wide screens (desktop, tablets in landscape, phones in landscape) use the 3-column layout: controls on the
// left band, map + chat in the middle, the inventory of the tapped player on the right band.
const WIDE = '(min-width: 1024px) and (min-height: 560px), (orientation: landscape) and (max-height: 520px) and (min-width: 640px)';
// Only a wide desktop with a mouse keeps the inventory as a fixed right column; every touch screen (phones,
// tablets, touch laptops) and narrower window opens it as a drawer when a player is tapped.
const PANEL_COLUMN = '(min-width: 1280px) and (min-height: 560px) and (hover: hover) and (pointer: fine)';
// Phones in landscape: too short for the chat under the map, so it moves beside it.
const SHORT_LANDSCAPE = '(orientation: landscape) and (max-height: 520px)';
const ROTATE_DISMISSED_KEY = 'cardbrix_game_rotate_dismissed';
// Where the character was when the world was left (a stall's page, the inventory, editing the character): the
// next start in this tab puts it back there, e.g. in the market in front of the LEGO stall. Stale after 2 hours.
const RETURN_KEY = 'cardbrix_game_return';
const RETURN_TTL_MS = 2 * 60 * 60 * 1000;

function readReturnPoint() {
  try {
    const r = JSON.parse(sessionStorage.getItem(RETURN_KEY) || 'null');
    if (r && typeof r.map === 'string' && Date.now() - r.at < RETURN_TTL_MS) return { map: r.map, spawn: r.spawn };
  } catch { /* blocked or malformed */ }
  return {};
}

function saveReturnPoint(where) {
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ ...where, at: Date.now() })); } catch { /* blocked */ }
}

function useMedia(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Local storage, or null when the browser blocks it. */
function storage() {
  try { return window.localStorage; } catch { return null; }
}

/** A tour card, told by the NPC who keeps that stop (the guide opens and closes the tour). */
function TutorialCard({ step, state, place, goSite, dispatch }) {
  const { t } = useTranslation();
  const { done, total } = progress(state);
  const isPlace = Boolean(step.place);
  const last = step.id === 'finish';
  const color = place?.color || '#c6ff3d';
  const speaker = step.speaker ? npcById(step.speaker) : null;
  return (
    <div className="cbg-panel cbg-card-enter relative z-10 mx-auto mt-4 max-w-xl p-4 sm:absolute sm:inset-x-3 sm:bottom-3 sm:mt-0 sm:p-5" style={{ borderColor: color }} role="dialog" aria-live="polite" aria-label={t(`game.tutorial.${step.id}.title`)}>
      {last && (
        <div className="mb-3 flex flex-col items-center gap-2 text-center">
          <DragonStatue width={170} className="cbg-dragon-float" />
          <p className="cbg-pixel cbg-victory text-xl uppercase sm:text-2xl">{t('game.tutorial.victory')}</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        {speaker && !last && <NpcPortrait npc={speaker} color={speaker.color} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="cbg-pixel text-sm uppercase sm:text-base" style={{ color }}>{t(`game.tutorial.${step.id}.title`)}</h3>
            {isPlace && <span className="cbg-pixel shrink-0 text-[0.55rem] text-white/50">{t('game.tutorial.progress', { done, total })}</span>}
          </div>
          {speaker && <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white/50">{t(npcNameKey(speaker.id))} · {t(npcRoleKey(speaker.id))}</p>}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">{t(`game.tutorial.${step.id}.body`)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="cbg-btn" style={{ background: color }} onClick={() => dispatch({ type: 'next' })}>
          {step.id === 'welcome' ? t('game.tutorial.start') : last ? t('game.tutorial.finish_btn') : t('game.tutorial.next')} ▶
        </button>
        {isPlace && place?.path && (
          <button type="button" className="cbg-btn cbg-btn--ghost" onClick={() => goSite(place)}>{t('game.tutorial.go_site')}</button>
        )}
        {!last && (
          <button type="button" className="min-h-11 px-2 text-sm font-bold text-white/55 underline-offset-4 hover:text-white hover:underline" onClick={() => dispatch({ type: 'skip' })}>
            {t('game.tutorial.skip')}
          </button>
        )}
      </div>
    </div>
  );
}

/** First visit of a map: one short card about what is there (never shown again for this account). */
function AreaIntro({ mapId, onClose }) {
  const { t } = useTranslation();
  return (
    <div className="cbg-panel cbg-card-enter absolute inset-x-2 top-10 z-20 mx-auto max-w-md p-3 sm:top-14 sm:p-4" role="dialog" aria-live="polite" aria-labelledby="cbg-area-intro">
      <h3 id="cbg-area-intro" className="cbg-pixel text-[0.6rem] uppercase text-[#c6ff3d] sm:text-xs">{t(`game.intro.${mapId}.title`)}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/80">{t(`game.intro.${mapId}.body`)}</p>
      <button type="button" className="cbg-btn mt-3 w-full" onClick={onClose}>{t('game.intro.ok')} ▶</button>
    </div>
  );
}

/** "Turn your phone" card, shown once per visit on a phone held upright; it goes away by itself in landscape. */
function RotateHint({ onDismiss }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal="true" aria-labelledby="cbg-rotate-title">
      <div className="cbg-panel cbg-card-enter w-full max-w-xs p-5 text-center">
        <Smartphone className="cbg-rotate-phone mx-auto h-12 w-12 text-[#22d3ee]" aria-hidden />
        <h2 id="cbg-rotate-title" className="cbg-pixel mt-4 text-sm uppercase text-white">{t('game.world.rotate_title')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/75">{t('game.world.rotate_text')}</p>
        <button type="button" className="cbg-btn cbg-btn--ghost mt-5 w-full" style={{ fontFamily: "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif", textTransform: 'none', fontSize: '0.95rem', fontWeight: 800 }} onClick={onDismiss}>{t('game.world.rotate_dismiss')}</button>
      </div>
    </div>
  );
}

/** Small square icon button (tutorial / character / visibility). */
function ToolButton({ label, pressed, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={pressed} className="cbg-tool">
      {children}
    </button>
  );
}

/**
 * The plaza: the map with the guided tutorial on top, the other players, the chat (fixed phrases, and typed messages when the admin switches them on), an on-screen
 * D-pad and the inventory of whoever you tap. Entering a place leaves the game for the matching site page; the
 * castle gate (Annunci) leads to the market map instead, and the market gate back to the plaza.
 */
export default function WorldScreen({ avatar, onEdit }) {
  const { t } = useTranslation();
  const navTo = useLocalizedNav();
  const navigate = useNavigate();
  const { user } = useAuth();
  // The map canvas lives across layout switches (rotating the phone swaps the 3-column and the stacked layout):
  // it is created once and moved into whichever host div is mounted, which keeps its WebGL context and the game.
  const canvasRef = useRef(null);
  const hostNodeRef = useRef(null);
  const setHost = useCallback((node) => {
    hostNodeRef.current = node;
    if (node && canvasRef.current && canvasRef.current.parentNode !== node) node.appendChild(canvasRef.current);
  }, []);
  const gameRef = useRef(null);
  const [door, setDoor] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  // the contextual side panel: NPC dialogues, merchants' goods, products, auctions, arena, other players
  const [panel, panelDispatch] = useReducer(panelReducer, EMPTY_PANEL);
  const view = currentView(panel);
  const [start] = useState(readReturnPoint); // { map, spawn } to start from (empty = plaza start)
  const [mapId, setMapId] = useState(start.map || 'plaza');
  const portraitPhone = useMedia(PORTRAIT_PHONE);
  const wide = useMedia(WIDE);
  const panelColumn = useMedia(PANEL_COLUMN);
  const shortLandscape = useMedia(SHORT_LANDSCAPE);
  const [rotateDismissed, setRotateDismissed] = useState(() => {
    try { return sessionStorage.getItem(ROTATE_DISMISSED_KEY) === '1'; } catch { return false; }
  });
  const dismissRotate = () => {
    setRotateDismissed(true);
    try { sessionStorage.setItem(ROTATE_DISMISSED_KEY, '1'); } catch { /* blocked */ }
  };

  // every chat message (ours too) also shows as a bubble over the speaker's head
  const onSaid = useCallback((m) => {
    gameRef.current?.showBubble(m.mine ? 'me' : m.id, m.x != null ? bubbleText(m.x) : chatText(t, m.k));
  }, [t]);
  const plaza = usePlaza({ gameRef, ready: status === 'ready', onSaid, start });
  // the scene is created once; it reaches the (stable) plaza callbacks through refs
  const plazaRef = useRef(plaza);
  useEffect(() => { plazaRef.current = plaza; }, [plaza]);
  const [tut, dispatch] = useReducer(tutorialReducer, null, () => {
    let store = null;
    try { store = window.localStorage; } catch { /* blocked */ }
    return store && !shouldAutoStart(store, user?.id) ? INACTIVE : startTutorial();
  });
  const tutRef = useRef(tut);
  useEffect(() => { tutRef.current = tut; }, [tut]);

  const labels = useMemo(() => Object.fromEntries(ALL_PLACES.map((p) => [p.id, p.kind === 'npc' ? t(npcNameKey(p.npc)) : t(`game.places.${p.id}`)])), [t]);
  const npcNames = useMemo(() => Object.fromEntries(NPCS.map((n) => [n.id, t(npcNameKey(n.id))])), [t]);
  const placeById = (id) => ALL_PLACES.find((p) => p.id === id) || null;
  const goSite = (place) => navigate(navTo(place.path));
  // A door leads to another map (castle gate, market gate) or to whoever keeps the place: their dialogue opens in
  // the side panel, and the real page of the site is one answer away. A place with nobody falls back to its page.
  const enterPlace = (place) => {
    // during the tour, reaching the current stop opens its explanation card instead (even at the castle gate)
    if (tutRef.current.active && guideTarget(tutRef.current) === place.id) return;
    if (place.travel) {
      plazaRef.current.travel(place.travel.to);
      gameRef.current?.travel(place.travel.to, place.travel.spawn);
      return;
    }
    const npc = npcAt(place);
    if (npc) panelDispatch({ type: 'open', view: { kind: 'dialog', npc: npc.id, node: startNode(npc.id) } });
    else if (place.path) goSite(place);
  };
  // the scene is created once: it reaches the latest enterPlace through a ref
  const enterRef = useRef(enterPlace);
  useEffect(() => { enterRef.current = enterPlace; });

  /** A dialogue answer: the next line, or an action (goods, auction board, arena, a page, walking somewhere...). */
  const onChoose = (npcId, nodeId, optionId) => {
    const r = chooseOption(npcId, nodeId, optionId);
    if (!r) return;
    if (r.type === 'node') { panelDispatch({ type: 'replace', view: { kind: 'dialog', npc: npcId, node: r.node } }); return; }
    const a = r.action;
    if (a.type === 'products') panelDispatch({ type: 'push', view: { kind: 'goods', npc: npcId, query: a.query } });
    else if (a.type === 'auctions') panelDispatch({ type: 'push', view: { kind: 'auctions', npc: npcId } });
    else if (a.type === 'arena') panelDispatch({ type: 'push', view: { kind: 'arena', npc: npcId } });
    else if (a.type === 'link') navigate(navTo(a.path));
    else if (a.type === 'walk') { panelDispatch({ type: 'close' }); gameRef.current?.walkTo(a.place); }
    else if (a.type === 'tutorial') { panelDispatch({ type: 'close' }); replay(); }
    else panelDispatch({ type: 'close' });
  };
  const step = currentStep(tut);
  const target = guideTarget(tut);
  const canvasLabel = t('game.world.canvas_label');

  useEffect(() => {
    let cancelled = false;
    let game = null;
    // Every run gets a brand-new canvas: a canvas whose WebGL context was torn down by a previous scene (e.g.
    // creator -> world) would come back with stale textures, and the text of the new scene would not draw.
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-full w-full touch-none';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', canvasLabel);
    canvasRef.current = canvas;
    hostNodeRef.current?.appendChild(canvas);
    (async () => {
      try {
        const { startGame } = await import('../../lib/game/gameScene');
        const [sheet, npcSheets] = await Promise.all([buildAvatarSheet(avatar), buildNpcSheets()]);
        if (cancelled) return;
        game = await startGame({
          canvas,
          sheet,
          username: user?.username || '',
          labels,
          npcSheets,
          npcNames,
          clockUnits: { d: t('game.panel.unit_d'), h: 'h' },
          start,
          onDoorChange: setDoor,
          onMapChange: setMapId,
          onEnterRequest: (id) => { const p = placeById(id); if (p) enterRef.current(p); },
          onLocalMove: (move) => plazaRef.current.reportMove(move),
          onPlayerTap: (id) => {
            const info = plazaRef.current.playerInfo(id);
            if (info) panelDispatch({ type: 'open', view: { kind: 'player', player: info } });
          },
        });
        if (cancelled) { game.destroy(); return; }
        gameRef.current = game;
        setStatus('ready');
      } catch (err) {
        console.error('Game failed to start:', err);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      gameRef.current = null;
      if (game) {
        saveReturnPoint(game.whereAmI());
        game.destroy();
      }
      canvas.remove();
      if (canvasRef.current === canvas) canvasRef.current = null;
    };
    // The scene restarts only when the character itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatar, user?.username]);

  // The clock over the auction house shows the real auction that ends first (refreshed every minute; the scene
  // counts down between refreshes). No auction or no answer -> "--:--", never an invented time.
  useEffect(() => {
    if (status !== 'ready') return undefined;
    let live = true;
    const load = () => apiFetch(auctionsUrl(20))
      .then((items) => { if (live) gameRef.current?.setAuctionClock(nextEndingAuction(items)?.auction_end || null); })
      .catch(() => { if (live) gameRef.current?.setAuctionClock(null); });
    load();
    const id = setInterval(load, 60000);
    return () => { live = false; clearInterval(id); };
  }, [status]);

  // keep the scene in sync with the tutorial: guide arrow + frozen while a card is open
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    g.setGuide(target);
    g.setFrozen(tut.active && tut.phase === 'explain');
  }, [tut, target, status]);

  // reaching the door of the current stop opens its explanation
  useEffect(() => {
    if (door && door === target) dispatch({ type: 'arrive', placeId: door });
  }, [door, target]);

  // First visits: a map gets a short intro card, a keeper / merchant greets the player once (speech bubble).
  const [, setSeenTick] = useState(0); // re-render once an intro is dismissed (the "seen" list lives in storage)
  const seenStore = storage();
  const intro = status === 'ready' && seenStore && MAP_INTROS.includes(mapId) && !hasSeen(seenStore, user?.id, `map:${mapId}`) ? mapId : null;
  const closeIntro = () => {
    if (seenStore && intro) markSeen(seenStore, user?.id, `map:${intro}`);
    setSeenTick((n) => n + 1);
  };
  useEffect(() => {
    const npc = npcAt(placeById(door));
    const store = storage();
    if (!npc || !npc.avatar || !store || hasSeen(store, user?.id, `greet:${npc.id}`)) return;
    gameRef.current?.showBubble(`npc:${npc.id}`, t(`game.npcs.${npc.id}.greet`));
    markSeen(store, user?.id, `greet:${npc.id}`);
  }, [door, t, user?.id]);

  // the first time the tour ends (finished or skipped) it stops auto-starting for this account
  const wasActive = useRef(tut.active);
  useEffect(() => {
    if (wasActive.current && !tut.active) {
      try { markDone(window.localStorage, user?.id); } catch { /* blocked */ }
    }
    wasActive.current = tut.active;
  }, [tut.active, user?.id]);

  const near = !tut.active || tut.phase === 'walk' ? placeById(door) : null;
  const nearNpc = near && !near.travel ? npcAt(near) : null;
  const goal = tut.active && tut.phase === 'walk' ? placeById(target) : null;
  const setVirtualStick = useCallback((v) => gameRef.current?.setVirtualStick(v), []);
  const drawer = !(wide && panelColumn);

  // Esc closes the panel; when it closes, the keyboard goes back to the map
  const hasView = Boolean(view);
  useEffect(() => {
    if (!hasView) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') panelDispatch({ type: 'close' }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasView]);
  const hadView = useRef(false);
  useEffect(() => {
    if (hadView.current && !hasView) canvasRef.current?.focus({ preventScroll: true });
    hadView.current = hasView;
  }, [hasView]);

  function replay() {
    try { clearDone(window.localStorage, user?.id); } catch { /* blocked */ }
    const store = storage();
    if (store) clearSeen(store, user?.id); // the whole tour of the world starts over: intros and greetings too
    setSeenTick((n) => n + 1);
    dispatch({ type: 'restart' });
  }

  const toolbar = (
    <div className={wide ? 'flex flex-col gap-2' : 'absolute left-2 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2 sm:left-3'} role="toolbar" aria-label={t('game.world.toolbar_label')}>
      <ToolButton label={t('game.world.tutorial_button')} onClick={replay}><GraduationCap className="h-5 w-5" aria-hidden /></ToolButton>
      <ToolButton label={t('game.creator.edit')} onClick={onEdit}><Pencil className="h-5 w-5" aria-hidden /></ToolButton>
      <ToolButton label={plaza.visible ? t('game.plaza.visible_on') : t('game.plaza.visible_off')} pressed={plaza.visible} onClick={() => plaza.setVisible(!plaza.visible)}>
        {plaza.visible ? <Eye className="h-5 w-5" aria-hidden /> : <EyeOff className="h-5 w-5 text-[#ff7a5c]" aria-hidden />}
      </ToolButton>
    </div>
  );

  const stage = (
    <div className="cbg-panel relative w-full overflow-hidden bg-[#0b1a12]" style={{ aspectRatio: '4 / 3' }}>
      <div ref={setHost} className="h-full w-full" />
      {status === 'loading' && <div className="cbg-pixel absolute inset-0 flex items-center justify-center text-xs text-white/70">{t('game.world.loading')}</div>}
      {status === 'error' && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-bold text-white/70">{t('game.world.error')}</div>}

      {goal && (
        <div className="cbg-pixel absolute left-2 top-2 z-10 max-w-[58%] border-2 border-black bg-[#14111f]/95 px-2 py-1.5 text-[0.5rem] uppercase sm:left-3 sm:top-3 sm:max-w-[70%] sm:border-4 sm:px-3 sm:py-2 sm:text-[0.6rem]" style={{ color: goal.color }}>
          {t('game.world.objective', { place: labels[goal.id] })}
        </div>
      )}

      {/* no player count: only a notice when the plaza is unreachable (nobody else shows, the chat cannot speak) */}
      {status === 'ready' && (plaza.status === 'offline' || plaza.status === 'replaced') && (
        <div className="cbg-pixel absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 border-2 border-black bg-[#14111f]/95 px-1.5 py-1 text-[0.45rem] uppercase text-white sm:right-3 sm:top-3 sm:gap-2 sm:border-4 sm:px-2.5 sm:py-1.5 sm:text-[0.55rem]" role="status">
          <WifiOff className="h-3 w-3 text-amber-300 sm:h-3.5 sm:w-3.5" aria-hidden />
          {t(plaza.status === 'replaced' ? 'game.plaza.replaced' : 'game.plaza.offline')}
        </div>
      )}

      {status === 'ready' && !wide && toolbar}

      {intro && !(tut.active && tut.phase === 'explain') && <AreaIntro mapId={intro} onClose={closeIntro} />}

      {near && (near.path || near.travel || nearNpc) && !(tut.active && tut.phase === 'explain') && !(nearNpc && view?.npc === nearNpc.id) && (
        <div className="cbg-panel cbg-card-enter absolute bottom-2 left-1/2 z-10 w-[min(94%,380px)] -translate-x-1/2 p-2.5 text-center sm:bottom-3 sm:p-3" style={{ borderColor: near.color }}>
          <p className="cbg-pixel text-[0.55rem] uppercase sm:text-xs" style={{ color: near.color }}>{near.kind === 'npc' ? labels[near.id] : t(`game.places_info.${near.id}.title`)}</p>
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/55 sm:text-[0.7rem]">{near.kind === 'npc' ? t(npcRoleKey(near.npc)) : t(`game.places_info.${near.id}.subtitle`)}</p>
          {near.kind !== 'npc' && <p className="mt-1.5 hidden text-sm leading-snug text-white/80 sm:block">{t(`game.places_info.${near.id}.flavour`)}</p>}
          <button type="button" onClick={() => gameRef.current?.enter()} className="cbg-btn mt-2 w-full" style={{ background: near.color }}>
            {near.travel ? t(`game.world.travel_${near.travel.to}`) : nearNpc ? t('game.world.talk', { name: npcNames[nearNpc.id] }) : t('game.world.enter', { place: labels[near.id] })} ▶
          </button>
        </div>
      )}

      {tut.active && tut.phase === 'explain' && step && wide && (
        <TutorialCard step={step} state={tut} place={placeById(step.place)} goSite={goSite} dispatch={dispatch} />
      )}
    </div>
  );

  const sideChat = wide && !panelColumn && shortLandscape;
  const chat = (
    <ChatPanel messages={plaza.messages} onSay={plaza.say} onSend={plaza.sendText} chat={plaza.chat} sending={plaza.sending} cooldown={plaza.cooldown} canSpeak={plaza.visible && plaza.status === 'online'} className={sideChat ? 'cbg-chat--side' : wide ? 'cbg-chat--wide' : 'cbg-chat--narrow'} />
  );

  // the side panel as a drawer (from the right in landscape, from the bottom in portrait) when something is open
  const panelDrawer = view && (
    <>
      <button type="button" className="cbg-drawer-backdrop" aria-label={t('game.plaza.close')} onClick={() => panelDispatch({ type: 'close' })} />
      <ContextPanel panel={panel} dispatch={panelDispatch} onChoose={onChoose} className={wide ? 'cbg-drawer' : 'cbg-drawer cbg-drawer--bottom'} />
    </>
  );

  // The canvas is not readable by screen readers: the sections stay reachable as plain links for them.
  const srLinks = (
    <ul className="sr-only" aria-label="CardBrix">
      {ALL_PLACES.filter((p) => p.path).map((p) => <li key={p.id}><Link to={navTo(p.path)}>{labels[p.id]}</Link></li>)}
    </ul>
  );

  if (wide) {
    return (
      <div className={`cbg-wide ${panelColumn ? 'cbg-wide--panel' : sideChat ? 'cbg-wide--sidechat' : 'cbg-wide--full'}`}>
        <aside className="cbg-wide-left">
          <div className="cbg-wide-left-spacer" aria-hidden />
          {status === 'ready' && toolbar}
          <VirtualJoystick onChange={setVirtualStick} />
        </aside>
        <main className="cbg-wide-center">
          <div className="cbg-wide-column">
            {stage}
            {!sideChat && chat}
          </div>
        </main>
        {panelColumn && <ContextPanel panel={panel} dispatch={panelDispatch} onChoose={onChoose} emptyHint={t('game.panel.empty')} className="cbg-wide-right" />}
        {sideChat && <div className="cbg-wide-right">{chat}</div>}
        {drawer && panelDrawer}
        {srLinks}
      </div>
    );
  }

  return (
    <div className="cbg-world mx-auto flex min-h-full max-w-[980px] flex-col justify-center px-3 pb-6 pt-20">
      {portraitPhone && !rotateDismissed && <RotateHint onDismiss={dismissRotate} />}
      <div className="cbg-stage-wrap relative mx-auto">
        {stage}
        {tut.active && tut.phase === 'explain' && step && (
          <TutorialCard step={step} state={tut} place={placeById(step.place)} goSite={goSite} dispatch={dispatch} />
        )}
      </div>

      <div className="cbg-stage-wrap mx-auto mt-3 flex items-stretch gap-2">
        <VirtualJoystick onChange={setVirtualStick} className="self-center" />
        <div className="min-w-0 flex-1">{chat}</div>
      </div>

      <p className="cbg-world-hint mt-3 text-center text-xs text-white/50">{t('game.world.hint')}</p>

      {panelDrawer}
      {srLinks}
    </div>
  );
}
