import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { dialogNode } from '../../lib/game/npcs';
import { useTypewriter } from './hooks';

/**
 * One line of an NPC with the player's possible answers. The text types itself out (a tap shows it all at once);
 * the answers are real buttons: arrows move between them, Enter / tap picks one. `onChoose(optionId)`.
 */
export default function DialogView({ npc, node, onChoose, autoFocus = true }) {
  const { t } = useTranslation();
  const d = dialogNode(npc, node);
  const text = d ? t(d.textKey) : '';
  const { visible, done, finish } = useTypewriter(text);
  const listRef = useRef(null);

  // the answers take the keyboard as soon as they appear, like a dialogue box (the map's keys pause meanwhile)
  useEffect(() => {
    if (done && autoFocus) listRef.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [done, autoFocus, npc, node]);

  if (!d) return null;

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const buttons = [...(listRef.current?.querySelectorAll('button') || [])];
    const i = buttons.indexOf(document.activeElement);
    const next = buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length];
    if (next) { e.preventDefault(); next.focus(); }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <button type="button" onClick={finish} className="cbg-dialog-text text-left" aria-live="polite" aria-label={text}>
        <span aria-hidden>{visible}</span>
        {done ? <span className="cbg-dialog-next" aria-hidden>▼</span> : null}
      </button>
      {done && (
        <ul ref={listRef} className="flex flex-col gap-1.5" aria-label={t('game.dialog.answers')}>
          {d.options.map((o) => (
            <li key={o.id}>
              <button type="button" className="cbg-option" onClick={() => onChoose(o.id)} onKeyDown={onKeyDown}>
                {t(o.labelKey)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
