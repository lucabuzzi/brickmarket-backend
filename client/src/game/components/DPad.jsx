import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ICON = 'h-6 w-6';
const DIRS = [
  { dir: 'up', icon: <ChevronUp className={ICON} aria-hidden />, area: 'cbg-dpad-up' },
  { dir: 'left', icon: <ChevronLeft className={ICON} aria-hidden />, area: 'cbg-dpad-left' },
  { dir: 'right', icon: <ChevronRight className={ICON} aria-hidden />, area: 'cbg-dpad-right' },
  { dir: 'down', icon: <ChevronDown className={ICON} aria-hidden />, area: 'cbg-dpad-down' },
];

/**
 * On-screen cross D-pad for the left thumb. Each arm is held as long as a finger (or the mouse) stays on it, and
 * two arms can be held together for diagonals (multi-touch). `onChange({ up, down, left, right })` fires on every
 * change; everything is released when the pointer leaves, is cancelled, or the window loses focus.
 */
export default function DPad({ onChange, className = '' }) {
  const { t } = useTranslation();
  const held = useRef(new Map()); // pointerId -> dir
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const emit = () => {
    const keys = { up: false, down: false, left: false, right: false };
    for (const dir of held.current.values()) keys[dir] = true;
    onChangeRef.current?.(keys);
  };
  const press = (dir) => (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
    held.current.set(e.pointerId, dir);
    emit();
  };
  const release = (e) => {
    if (held.current.delete(e.pointerId)) emit();
  };

  useEffect(() => {
    const map = held.current;
    const releaseAll = () => { if (map.size) { map.clear(); emit(); } };
    window.addEventListener('blur', releaseAll);
    return () => { window.removeEventListener('blur', releaseAll); releaseAll(); };
  }, []);

  return (
    <div className={`cbg-dpad ${className}`} role="group" aria-label={t('game.dpad.label')}>
      {DIRS.map(({ dir, icon, area }) => (
        <button
          key={dir}
          type="button"
          className={`cbg-dpad-btn ${area}`}
          aria-label={t(`game.dpad.${dir}`)}
          onPointerDown={press(dir)}
          onPointerUp={release}
          onPointerCancel={release}
          onLostPointerCapture={release}
          onContextMenu={(e) => e.preventDefault()}
        >
          {icon}
        </button>
      ))}
      <span className="cbg-dpad-hub" aria-hidden />
    </div>
  );
}
