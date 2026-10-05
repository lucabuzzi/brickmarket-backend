import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BellRing, Check, Copy, Link2, PackageCheck, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ListingCard from '../ListingCard';
import { confettiPieces } from '../../lib/sell/confetti';

const NEXT = [
  { id: 'reply', Icon: BellRing },
  { id: 'share', Icon: Link2 },
  { id: 'pack', Icon: PackageCheck },
];

function Confetti() {
  const pieces = useMemo(() => confettiPieces(38, 11), []);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[460px] overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block"
          style={{ left: `${p.x}%`, width: p.size, height: p.round ? p.size : p.size * 1.6, background: p.color, borderRadius: p.round ? '9999px' : 2 }}
          initial={{ y: -30, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 440, x: p.drift, opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration + 0.8, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

/**
 * Shown instead of the wizard once a new listing has been published: the real card, what to do next, and
 * ways out (see it, my listings, publish another). It promises nothing about sales or credits.
 */
export default function Celebration({ listing, path, onAnother }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const headingRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(id);
  }, [copied]);

  async function copyLink() {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
    } catch {
      // clipboard blocked (insecure context, permissions): the link is still reachable through "see your listing"
    }
  }

  const rise = (delay) => (reduceMotion ? { initial: false } : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] } });

  return (
    <div className="relative">
      {reduceMotion ? null : <Confetti />}

      <div className="relative mx-auto max-w-[720px] text-center">
        <motion.div
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-[#c6ff3d] text-[#10140a] shadow-[0_0_80px_rgba(198,255,61,0.55)]"
          initial={reduceMotion ? false : { scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        >
          <Check size={48} strokeWidth={3.5} aria-hidden="true" />
        </motion.div>

        <motion.div {...rise(0.15)} role="status">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-7 text-[clamp(2rem,7vw,3.4rem)] font-black leading-[1] tracking-[-0.045em] text-white [text-shadow:0_0_60px_rgba(198,255,61,0.3)] focus:outline-none"
          >
            {t('sell.ui.celebrate.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/60">{t('sell.ui.celebrate.sub')}</p>
        </motion.div>

        <motion.div {...rise(0.3)} className="mx-auto mt-9 max-w-[320px]">
          <div className="lx-float" inert aria-hidden="true">
            <div className="pointer-events-none select-none text-left">
              <ListingCard l={listing} hideMissingSetNumber />
            </div>
          </div>
        </motion.div>

        <motion.div {...rise(0.42)} className="mx-auto mt-9 flex max-w-md flex-col gap-3">
          {path ? (
            <Link
              to={path}
              className="lx-shine relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-gold-300 via-gold-400 to-gold-600 px-7 py-4 text-[15px] font-black text-[#100d07] shadow-[0_10px_30px_-8px_rgba(212,175,55,0.55)] transition-transform hover:-translate-y-0.5"
            >
              {t('sell.ui.celebrate.view')}
            </Link>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onAnother}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#c6ff3d]/40 bg-[#c6ff3d]/10 px-5 py-3.5 text-sm font-bold text-[#c6ff3d] transition-colors hover:bg-[#c6ff3d]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/60"
            >
              <Plus size={17} aria-hidden="true" /> {t('sell.ui.celebrate.another')}
            </button>
            {path ? (
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3.5 text-sm font-bold text-white/85 transition-colors hover:border-white/30 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/60"
              >
                {copied ? <Check size={17} className="text-[#c6ff3d]" aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
                {copied ? t('sell.ui.celebrate.copied') : t('sell.ui.celebrate.copy')}
              </button>
            ) : null}
          </div>
          <Link to="/my-listings" className="text-sm font-semibold text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline">
            {t('sell.ui.celebrate.mine')}
          </Link>
          <p aria-live="polite" className="sr-only">{copied ? t('sell.ui.celebrate.copied') : ''}</p>
        </motion.div>

        <motion.section {...rise(0.55)} className="mx-auto mt-12 text-left" aria-labelledby="sell-next-title">
          <h2 id="sell-next-title" className="mb-3 text-center text-sm font-black uppercase tracking-[0.14em] text-[#c6ff3d]">{t('sell.ui.celebrate.next_title')}</h2>
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {NEXT.map(({ id, Icon }) => (
              <li key={id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <Icon size={20} className="text-[#c6ff3d]" aria-hidden="true" />
                <p className="mt-2.5 text-sm font-bold text-white">{t(`sell.ui.celebrate.next.${id}.title`)}</p>
                <p className="mt-1 text-[13px] leading-snug text-white/55">{t(`sell.ui.celebrate.next.${id}.text`)}</p>
              </li>
            ))}
          </ul>
        </motion.section>
      </div>
    </div>
  );
}
