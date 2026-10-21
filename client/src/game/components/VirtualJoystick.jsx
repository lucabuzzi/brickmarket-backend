import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { stickVector } from '../../lib/game/joystick';

/**
 * Fixed virtual joystick for the left thumb: the base stays where it is, the knob follows the finger (or the mouse)
 * inside the ring and stops on the rim when the finger goes further. `onChange({ x, y })` fires on every move with
 * the walking vector (length 0..1, proportional to how far the knob is pushed); lifting the finger, a cancelled
 * pointer or the window losing focus recentres the knob and sends { x: 0, y: 0 }.
 */
export default function VirtualJoystick({ onChange, className = '' }) {
  const { t } = useTranslation();
  const baseRef = useRef(null);
  const knobRef = useRef(null);
  const active = useRef(null); // { id, cx, cy, radius } of the finger driving the stick
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // the knob is moved straight on the DOM: no React render per pointer move
  const draw = (x, y, on) => {
    const knob = knobRef.current;
    if (knob) knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    baseRef.current?.classList.toggle('is-active', on);
  };
  const follow = (e) => {
    const a = active.current;
    const v = stickVector(e.clientX - a.cx, e.clientY - a.cy, a.radius);
    draw(v.knobX, v.knobY, true);
    onChangeRef.current?.({ x: v.x, y: v.y });
  };
  const stop = () => {
    if (!active.current) return;
    active.current = null;
    draw(0, 0, false);
    onChangeRef.current?.({ x: 0, y: 0 });
  };

  const onPointerDown = (e) => {
    if (active.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const base = baseRef.current.getBoundingClientRect();
    const knob = knobRef.current.getBoundingClientRect();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
    active.current = {
      id: e.pointerId,
      cx: base.left + base.width / 2,
      cy: base.top + base.height / 2,
      radius: Math.max(1, (base.width - knob.width) / 2),
    };
    follow(e);
  };
  const onPointerMove = (e) => {
    if (active.current && e.pointerId === active.current.id) follow(e);
  };
  const onPointerEnd = (e) => {
    if (active.current && e.pointerId === active.current.id) stop();
  };

  useEffect(() => {
    window.addEventListener('blur', stop);
    return () => { window.removeEventListener('blur', stop); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={baseRef}
      className={`cbg-joystick ${className}`}
      role="img"
      aria-label={t('game.joystick.label')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="cbg-joystick-ring" aria-hidden />
      <span ref={knobRef} className="cbg-joystick-knob" aria-hidden />
    </div>
  );
}
