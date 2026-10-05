import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Camera, Focus, Frame, Search, Smartphone, Square, Sun, X, ZapOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GUIDE_TIP_IDS } from '../../lib/sell/shots';
import ShotGlyph from './ShotGlyph';

const TIP_ICONS = { light: Sun, noflash: ZapOff, background: Square, frame: Frame, parallel: Smartphone, focus: Focus, honest: Search };

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * "Come fare la foto": a bottom sheet on phones, a centred card on larger screens. Explains the shots for
 * the current category (the same ones the photo tiles suggest) and seven rules that make any photo better.
 * Closes with Escape, the backdrop, the X or the final button; focus goes in and comes back to the chip.
 */
export default function PhotoGuide({ open, onClose, shots }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
    };
  }, [open, onClose]);

  const slide = reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 };

  // Rendered on <body>: the page has its own stacking context, so inside it the sheet would sit under the site header.
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          <button type="button" tabIndex={-1} aria-label={t('sell.ui.guide.close')} onClick={onClose} className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm" />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sell-guide-title"
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#0d0c12] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.95)] md:rounded-[2rem]"
            initial={{ y: reduceMotion ? 0 : '100%' }}
            animate={{ y: 0 }}
            exit={{ y: reduceMotion ? 0 : '100%' }}
            transition={slide}
          >
            <header className="flex items-start gap-4 border-b border-white/10 px-5 pb-4 pt-5 sm:px-7">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#c6ff3d]/12 text-[#c6ff3d]">
                <Camera size={22} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="sell-guide-title" className="text-xl font-black tracking-tight text-white sm:text-2xl">{t('sell.ui.guide.title')}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-white/60">{t('sell.ui.guide.subtitle')}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={t('sell.ui.guide.close')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/60"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[#c6ff3d]">{t('sell.ui.guide.shots_title')}</h3>
              <p className="mb-3 mt-1 text-[13px] text-white/50">{t('sell.ui.guide.shots_sub')}</p>
              <ol className="space-y-2.5">
                {shots.map((id, i) => (
                  <li key={id} className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#c6ff3d]/10 text-[#c6ff3d]">
                      <ShotGlyph id={id} size={36} />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                        <span className="font-mono text-xs text-white/40">{i + 1}</span>
                        {t(`sell.ui.shots.${id}.label`)}
                        {i === 0 ? <span className="rounded bg-[#c6ff3d] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#10140a]">{t('sell.cover_badge')}</span> : null}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-snug text-white/55">{t(`sell.ui.shots.${id}.tip`)}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <h3 className="mt-7 text-sm font-black uppercase tracking-[0.14em] text-[#c6ff3d]">{t('sell.ui.guide.tips_title')}</h3>
              <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {GUIDE_TIP_IDS.map((id) => {
                  const Icon = TIP_ICONS[id];
                  return (
                  <li key={id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                    <Icon size={20} className="mt-0.5 shrink-0 text-[#c6ff3d]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{t(`sell.ui.guide.tips.${id}.title`)}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-white/55">{t(`sell.ui.guide.tips.${id}.text`)}</p>
                    </div>
                  </li>
                  );
                })}
              </ul>

              <p className="mt-5 text-xs text-white/40">{t('sell.ui.guide.tech')}</p>
            </div>

            <footer className="border-t border-white/10 px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={onClose}
                className="lx-shine relative w-full overflow-hidden rounded-2xl bg-[#c6ff3d] px-6 py-3.5 text-[15px] font-black text-[#10140a] shadow-[0_10px_30px_-10px_rgba(198,255,61,0.6)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {t('sell.ui.guide.done')}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
