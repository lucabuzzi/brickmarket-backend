import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, GraduationCap, Pencil, Smartphone, Users } from 'lucide-react';
import DragonView from '../components/DragonView';
import DPad from '../components/DPad';
import ChatPanel from '../components/ChatPanel';
import { chatText } from '../chatText';
import InventoryPanel from '../components/InventoryPanel';
import usePlaza from '../usePlaza';
import { buildAvatarSheet } from '../skinLoader';
import { useAuth } from '../../auth/useAuth';
import { useLocalizedNav } from '../../routing/useLocalizedNav';
import { ALL_PLACES } from '../../lib/game/maps';
import {
  startTutorial, tutorialReducer, currentStep, guideTarget, progress, shouldAutoStart, markDone, clearDone,
} from '../../lib/game/tutorial';

const INACTIVE = { active: false, finished: false, index: 0, phase: 'explain' };

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

function TutorialCard({ step, state, place, goSite, dispatch }) {
  const { t } = useTranslation();
  const { done, total } = progress(state);
  const isPlace = Boolean(step.place);
  const last = step.id === 'finish';
  const color = place?.color || '#c6ff3d';
  return (
    <div className="cbg-panel cbg-card-enter relative z-10 mx-auto mt-4 max-w-xl p-4 sm:absolute sm:inset-x-3 sm:bottom-3 sm:mt-0 sm:p-5" style={{ borderColor: color }} role="dialog" aria-live="polite" aria-label={t(`game.tutorial.${step.id}.title`)}>
      {last && (
        <div className="mb-3 flex flex-col items-center gap-2 text-center">
          <DragonView scale={3} className="cbg-dragon-float" />
          <p className="cbg-pixel cbg-victory text-xl uppercase sm:text-2xl">{t('game.tutorial.victory')}</p>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <h3 className="cbg-pixel text-sm uppercase sm:text-base" style={{ color }}>{t(`game.tutorial.${step.id}.title`)}</h3>
        {isPlace && <span className="cbg-pixel shrink-0 text-[0.55rem] text-white/50">{t('game.tutorial.progress', { done, total })}</span>}
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
 * The plaza: the map with the guided tutorial on top, the other players, the fixed-phrase chat, an on-screen
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
  const [selected, setSelected] = useState(null); // public info of the tapped player ({ u, a, ... })
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
    gameRef.current?.showBubble(m.mine ? 'me' : m.id, chatText(t, m.k));
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

  const labels = useMemo(() => Object.fromEntries(ALL_PLACES.map((p) => [p.id, t(`game.places.${p.id}`)])), [t]);
  const placeById = (id) => ALL_PLACES.find((p) => p.id === id) || null;
  const goSite = (place) => navigate(navTo(place.path));
  // a door either leads to another map (castle gate, market gate) or out to the site page of the place
  const enterPlace = (place) => {
    if (place.travel) {
      plazaRef.current.travel(place.travel.to);
      gameRef.current?.travel(place.travel.to, place.travel.spawn);
    } else {
      goSite(place);
    }
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
        const sheet = await buildAvatarSheet(avatar);
        if (cancelled) return;
        game = await startGame({
          canvas,
          sheet,
          username: user?.username || '',
          labels,
          start,
          onDoorChange: setDoor,
          onMapChange: setMapId,
          onEnterRequest: (id) => { const p = placeById(id); if (p) enterPlace(p); },
          onLocalMove: (move) => plazaRef.current.reportMove(move),
          onPlayerTap: (id) => setSelected(plazaRef.current.playerInfo(id)),
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

  // the first time the tour ends (finished or skipped) it stops auto-starting for this account
  const wasActive = useRef(tut.active);
  useEffect(() => {
    if (wasActive.current && !tut.active) {
      try { markDone(window.localStorage, user?.id); } catch { /* blocked */ }
    }
    wasActive.current = tut.active;
  }, [tut.active, user?.id]);

  const near = !tut.active || tut.phase === 'walk' ? placeById(door) : null;
  const goal = tut.active && tut.phase === 'walk' ? placeById(target) : null;
  const setVirtualKeys = useCallback((keys) => gameRef.current?.setVirtualKeys(keys), []);
  const drawer = !(wide && panelColumn);

  // Esc closes the inventory drawer
  useEffect(() => {
    if (!selected || !drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, drawer]);

  function replay() {
    try { clearDone(window.localStorage, user?.id); } catch { /* blocked */ }
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

      {status === 'ready' && (
        <div className="cbg-pixel absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 border-2 border-black bg-[#14111f]/95 px-1.5 py-1 text-[0.45rem] uppercase text-white sm:right-3 sm:top-3 sm:gap-2 sm:border-4 sm:px-2.5 sm:py-1.5 sm:text-[0.55rem]" aria-live="polite">
          <Users className="h-3 w-3 text-[#22d3ee] sm:h-3.5 sm:w-3.5" aria-hidden />
          {plaza.status === 'online' ? t(mapId === 'market' ? 'game.plaza.online_market' : 'game.plaza.online', { count: plaza.count })
            : plaza.status === 'replaced' ? t('game.plaza.replaced')
              : plaza.status === 'connecting' ? t('game.plaza.connecting') : t('game.plaza.offline')}
        </div>
      )}

      {status === 'ready' && !wide && toolbar}

      {(near?.path || near?.travel) && !(tut.active && tut.phase === 'explain') && (
        <div className="cbg-panel cbg-card-enter absolute bottom-2 left-1/2 z-10 w-[min(94%,380px)] -translate-x-1/2 p-2.5 text-center sm:bottom-3 sm:p-3" style={{ borderColor: near.color }}>
          <p className="cbg-pixel text-[0.55rem] uppercase sm:text-xs" style={{ color: near.color }}>{t(`game.places_info.${near.id}.title`)}</p>
          <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/55 sm:text-[0.7rem]">{t(`game.places_info.${near.id}.subtitle`)}</p>
          <p className="mt-1.5 hidden text-sm leading-snug text-white/80 sm:block">{t(`game.places_info.${near.id}.flavour`)}</p>
          <button type="button" onClick={() => gameRef.current?.enter()} className="cbg-btn mt-2 w-full" style={{ background: near.color }}>
            {near.travel ? t(`game.world.travel_${near.travel.to}`) : t('game.world.enter', { place: labels[near.id] })} ▶
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
    <ChatPanel messages={plaza.messages} onSay={plaza.say} cooldown={plaza.cooldown} canSpeak={plaza.visible && plaza.status === 'online'} className={sideChat ? 'cbg-chat--side' : wide ? 'cbg-chat--wide' : 'cbg-chat--narrow'} />
  );

  // the inventory of the tapped player as a drawer (from the right in landscape, from the bottom in portrait)
  const inventoryDrawer = selected && (
    <>
      <button type="button" className="cbg-drawer-backdrop" aria-label={t('game.plaza.close')} onClick={() => setSelected(null)} />
      <InventoryPanel player={selected} onClose={() => setSelected(null)} className={wide ? 'cbg-drawer' : 'cbg-drawer cbg-drawer--bottom'} />
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
          <DPad onChange={setVirtualKeys} />
        </aside>
        <main className="cbg-wide-center">
          <div className="cbg-wide-column">
            {stage}
            {!sideChat && chat}
          </div>
        </main>
        {panelColumn && <InventoryPanel player={selected} onClose={() => setSelected(null)} className="cbg-wide-right" />}
        {sideChat && <div className="cbg-wide-right">{chat}</div>}
        {drawer && inventoryDrawer}
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
        <DPad onChange={setVirtualKeys} className="shrink-0" />
        <div className="min-w-0 flex-1">{chat}</div>
      </div>

      <p className="cbg-world-hint mt-3 text-center text-xs text-white/50">{t('game.world.hint')}</p>

      {inventoryDrawer}
      {srLinks}
    </div>
  );
}
