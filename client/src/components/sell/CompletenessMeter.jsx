import { ArrowRight, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

/** "Completezza dell'annuncio": how much is filled in, and the next natural thing to do (see lib/sell/score.js). */
export default function CompletenessMeter({ percent, hint }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const complete = percent >= 100;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-white/50">{t('sell.ui.meter.label')}</span>
        <span className={`font-mono text-lg font-black tabular-nums ${complete ? 'text-[#c6ff3d]' : 'text-white'}`}>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={t('sell.ui.meter.label')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2.5 overflow-hidden rounded-full bg-white/10"
      >
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r from-[#c6ff3d] to-[#e4ff8f] ${complete ? 'shadow-[0_0_16px_rgba(198,255,61,0.7)]' : ''}`}
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      {complete ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-bold text-[#c6ff3d]">
          <Sparkles size={15} aria-hidden="true" /> {t('sell.ui.meter.complete')}
        </p>
      ) : hint ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-white/65">
          <ArrowRight size={14} className="shrink-0 text-[#c6ff3d]" aria-hidden="true" /> {t(`sell.ui.hint.${hint}`)}
        </p>
      ) : null}
    </div>
  );
}
