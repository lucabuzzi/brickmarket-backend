import { ArrowRight, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const ACCENT = {
  lime: { text: 'text-[#c6ff3d]', track: 'bg-gradient-to-r from-[#c6ff3d] to-[#e4ff8f]', glow: 'shadow-[0_0_16px_rgba(198,255,61,0.7)]' },
  orange: { text: 'text-pillar-auctions', track: 'bg-gradient-to-r from-pillar-auctions to-pillar-auctions/70', glow: 'shadow-[0_0_16px_rgba(255,90,54,0.7)]' },
};

/** "Completezza dell'annuncio": how much is filled in, and the next natural thing to do (see lib/sell/score.js). */
export default function CompletenessMeter({ percent, hint, accent = 'lime', ns = 'sell' }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const complete = percent >= 100;
  const a = ACCENT[accent] || ACCENT.lime;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/50">{t(`${ns}.ui.meter.label`)}</span>
        <span className={`font-mono text-lg font-black tabular-nums ${complete ? a.text : 'text-white'}`}>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={t(`${ns}.ui.meter.label`)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2.5 overflow-hidden rounded-full bg-white/10"
      >
        <motion.div
          className={`h-full rounded-full ${a.track} ${complete ? a.glow : ''}`}
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      {complete ? (
        <p className={`mt-2.5 flex items-center gap-1.5 text-[13px] font-bold ${a.text}`}>
          <Sparkles size={15} aria-hidden="true" /> {t(`${ns}.ui.meter.complete`)}
        </p>
      ) : hint ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-white/65">
          <ArrowRight size={14} className={`shrink-0 ${a.text}`} aria-hidden="true" /> {t(`${ns}.ui.hint.${hint}`)}
        </p>
      ) : null}
    </div>
  );
}
