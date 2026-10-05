import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Progress through the wizard. Steps already reached can be clicked to go back (or forward again);
 * steps not reached yet cannot, so nobody skips the checks of a step.
 * `steps`: [{ id, Icon }], `current` and `reached` are 1-based.
 */
export default function Stepper({ steps, current, reached, onSelect }) {
  const { t } = useTranslation();
  const n = steps.length;
  // the track runs from the centre of the first column to the centre of the last one
  const inset = `${100 / (2 * n)}%`;
  const fill = n > 1 ? ((current - 1) / (n - 1)) * 100 : 0;

  return (
    <nav aria-label={t('sell.ui.eyebrow_new')}>
      <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        <li aria-hidden="true" className="pointer-events-none absolute top-[19px] h-[3px] rounded-full bg-white/10" style={{ left: inset, right: inset }}>
          <span className="block h-full rounded-full bg-gradient-to-r from-[#c6ff3d] to-[#e4ff8f] shadow-[0_0_14px_rgba(198,255,61,0.6)] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${fill}%` }} />
        </li>
        {steps.map(({ id, Icon }, i) => {
          const index = i + 1;
          const isCurrent = index === current;
          const isDone = index < current;
          const canJump = index <= reached && !isCurrent;
          return (
            <li key={id} className="relative z-10 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => canJump && onSelect(index)}
                disabled={!canJump && !isCurrent}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={t(`sell.ui.step.${id}`)}
                className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/60 ${
                  isCurrent
                    ? 'scale-110 border-[#e4ff8f] bg-[#c6ff3d] text-[#10140a] shadow-[0_0_24px_rgba(198,255,61,0.55)]'
                    : isDone
                      ? 'border-[#c6ff3d]/60 bg-[#c6ff3d]/15 text-[#c6ff3d] hover:bg-[#c6ff3d]/25'
                      : 'border-white/10 bg-[#0d0c12] text-white/35'
                } ${canJump ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {isCurrent ? <span className="lx-ping-soft absolute inset-0 rounded-full border-2 border-[#c6ff3d]/50" aria-hidden="true" /> : null}
                {isDone ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
              </button>
              <span className={`text-center text-[11px] leading-tight sm:text-xs ${isCurrent ? 'font-extrabold text-white' : isDone ? 'font-semibold text-white/70' : 'font-medium text-white/35'}`}>
                {t(`sell.ui.step.${id}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
