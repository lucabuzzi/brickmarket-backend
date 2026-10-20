import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import DragonView from '../components/DragonView';
import { buildAvatarSheet } from '../skinLoader';
import { useAuth } from '../../auth/useAuth';
import { useLocalizedNav } from '../../routing/useLocalizedNav';
import { PLACES } from '../../lib/game/gameMap';
import {
  startTutorial, tutorialReducer, currentStep, guideTarget, progress, shouldAutoStart, markDone, clearDone,
} from '../../lib/game/tutorial';

const INACTIVE = { active: false, finished: false, index: 0, phase: 'explain' };

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

/** The map with the guided tutorial on top. Entering a place leaves the game for the matching site page. */
export default function WorldScreen({ avatar, onEdit }) {
  const { t } = useTranslation();
  const navTo = useLocalizedNav();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const [door, setDoor] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [tut, dispatch] = useReducer(tutorialReducer, null, () => {
    let store = null;
    try { store = window.localStorage; } catch { /* blocked */ }
    return store && !shouldAutoStart(store, user?.id) ? INACTIVE : startTutorial();
  });

  const labels = useMemo(() => Object.fromEntries(PLACES.map((p) => [p.id, t(`game.places.${p.id}`)])), [t]);
  const placeById = (id) => PLACES.find((p) => p.id === id) || null;
  const goSite = (place) => navigate(navTo(place.path));
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
    hostRef.current.appendChild(canvas);
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
          onDoorChange: setDoor,
          onEnterRequest: (id) => { const p = placeById(id); if (p) goSite(p); },
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
      if (game) game.destroy();
      canvas.remove();
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

  function replay() {
    try { clearDone(window.localStorage, user?.id); } catch { /* blocked */ }
    dispatch({ type: 'restart' });
  }

  return (
    <div className="mx-auto flex min-h-full max-w-[980px] flex-col justify-center px-3 pb-6 pt-20">
      <div className="relative mx-auto" style={{ width: 'min(100%, calc((100dvh - 13rem) * 1.3333))' }}>
      <div className="cbg-panel relative w-full overflow-hidden bg-[#0b1a12]" style={{ aspectRatio: '4 / 3' }}>
        <div ref={hostRef} className="h-full w-full" />
        {status === 'loading' && <div className="cbg-pixel absolute inset-0 flex items-center justify-center text-xs text-white/70">{t('game.world.loading')}</div>}
        {status === 'error' && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-bold text-white/70">{t('game.world.error')}</div>}

        {goal && (
          <div className="cbg-pixel absolute left-3 top-3 z-10 max-w-[80%] border-4 border-black bg-[#14111f]/95 px-3 py-2 text-[0.6rem] uppercase" style={{ color: goal.color }}>
            {t('game.world.objective', { place: labels[goal.id] })}
          </div>
        )}

        {near?.path && !(tut.active && tut.phase === 'explain') && (
          <button type="button" onClick={() => gameRef.current?.enter()} className="cbg-btn absolute bottom-4 left-1/2 z-10 -translate-x-1/2" style={{ background: near.color }}>
            {t('game.world.enter', { place: labels[near.id] })} ▶
          </button>
        )}

      </div>

      {tut.active && tut.phase === 'explain' && step && (
        <TutorialCard step={step} state={tut} place={placeById(step.place)} goSite={goSite} dispatch={dispatch} />
      )}
      </div>

      <p className="mt-3 text-center text-xs text-white/50">{t('game.world.hint')}</p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="cbg-btn cbg-btn--ghost" onClick={replay}>{t('game.world.tutorial_button')}</button>
        <button type="button" className="cbg-btn cbg-btn--ghost" onClick={onEdit}><Pencil className="h-4 w-4" aria-hidden /> {t('game.creator.edit')}</button>
      </div>

      <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="CardBrix">
        {PLACES.filter((p) => p.path).map((p) => (
          <li key={p.id}>
            <Link to={navTo(p.path)} className="inline-flex min-h-11 items-center gap-2 border-2 border-white/15 px-4 text-sm font-bold text-white transition hover:bg-white/10">
              <span className="h-2.5 w-2.5" style={{ background: p.color }} aria-hidden />
              {labels[p.id]}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
