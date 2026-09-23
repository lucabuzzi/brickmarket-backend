import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import logo1600 from '../../assets/brand/logo-1600.webp';
import logo800 from '../../assets/brand/logo-800.webp';
import cmark from '../../assets/brand/cmark-256.webp';
import { markIntroSeen } from './introGate';

const TARGET_ID = 'brand-mark-target';

// Where the brick "C" sits inside the full logo, as fractions of the logo's width/height. Must match
// C_MARK in scripts/build-brand-assets.js (crop 350px square centred on (1235, 510) of a 2000x1091 source).
const C_CX = 1235 / 2000;
const C_CY = 510 / 1091;
const C_SIZE = 350 / 2000;

const SHOW_MS = 1300; // how long the full logo is held before the C detaches and flies to the header
const FLY_S = 0.85;
const FAILSAFE_MS = 7000;

const MASK = 'radial-gradient(ellipse 54% 58% at 50% 50%, #000 64%, transparent 100%)';

export default function BrandIntro({ onDone }) {
  const { t } = useTranslation();
  const imgRef = useRef(null);
  const doneRef = useRef(false);
  const [phase, setPhase] = useState('wait'); // wait -> show -> fly
  const [fly, setFly] = useState(null); // measured flight of the C: { left, top, size, dx, dy, scale }

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    const root = document.documentElement;
    root.classList.remove('brand-intro');
    root.style.overflow = '';
    root.classList.add('brand-landed');
    setTimeout(() => root.classList.remove('brand-landed'), 1400);
    onDone();
  }, [onDone]);

  const startFly = useCallback(() => {
    const img = imgRef.current;
    const target = document.getElementById(TARGET_ID)?.getBoundingClientRect();
    if (!img || !target || !target.width) {
      finish();
      return;
    }
    const r = img.getBoundingClientRect();
    const size = C_SIZE * r.width;
    const cx = r.left + C_CX * r.width;
    const cy = r.top + C_CY * r.height;
    setFly({
      left: cx - size / 2,
      top: cy - size / 2,
      size,
      dx: target.left + target.width / 2 - cx,
      dy: target.top + target.height / 2 - cy,
      scale: target.width / size,
    });
    setPhase('fly');
  }, [finish]);

  const skip = useCallback(() => {
    if (phase === 'show') startFly();
    else if (phase === 'wait') finish();
  }, [phase, startFly, finish]);

  // Lock the page while the overlay is up, hide the real header mark so it can be "landed" on.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('brand-intro');
    root.style.overflow = 'hidden';
    markIntroSeen();
    const failsafe = setTimeout(finish, FAILSAFE_MS);
    return () => {
      clearTimeout(failsafe);
      root.classList.remove('brand-intro');
      root.style.overflow = '';
    };
  }, [finish]);

  // Wait for the logo to be decoded before revealing it (dark screen until then), but never forever.
  useEffect(() => {
    if (phase !== 'wait') return undefined;
    const img = imgRef.current;
    const go = () => setPhase('show');
    if (img?.complete && img.naturalWidth) go();
    const timer = setTimeout(go, 2200);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'show') return undefined;
    const timer = setTimeout(startFly, SHOW_MS);
    return () => clearTimeout(timer);
  }, [phase, startFly]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [skip]);

  const flying = phase === 'fly';

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex cursor-pointer items-center justify-center overflow-hidden bg-[#07060b]"
      onClick={skip}
      initial={{ opacity: 1 }}
      animate={{ opacity: flying ? 0 : 1 }}
      transition={{ duration: 0.6, delay: flying ? 0.3 : 0, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      {/* Colour wells behind the logo: blue on the card side, orange on the bricks side. */}
      <motion.span
        className="pointer-events-none absolute left-[18%] top-1/2 h-[60vmin] w-[60vmin] -translate-y-1/2 rounded-full bg-[#2b7fff]/25 blur-[110px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'show' ? 1 : 0 }}
        transition={{ duration: 1.1 }}
      />
      <motion.span
        className="pointer-events-none absolute right-[14%] top-1/2 h-[60vmin] w-[60vmin] -translate-y-1/2 rounded-full bg-[#ff8a1f]/25 blur-[110px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'show' ? 1 : 0 }}
        transition={{ duration: 1.1, delay: 0.15 }}
      />

      <div className="relative w-[min(135vw,1200px)] shrink-0">
        <motion.img
          ref={imgRef}
          src={logo1600}
          srcSet={`${logo800} 800w, ${logo1600} 1600w`}
          sizes="min(135vw, 1200px)"
          alt=""
          draggable="false"
          decoding="async"
          onLoad={() => setPhase((p) => (p === 'wait' ? 'show' : p))}
          className="block h-auto w-full select-none"
          style={{ maskImage: MASK, WebkitMaskImage: MASK }}
          initial={{ opacity: 0, scale: 0.86, filter: 'blur(14px)' }}
          animate={
            phase === 'wait'
              ? { opacity: 0, scale: 0.86, filter: 'blur(14px)' }
              : { opacity: flying ? 0 : 1, scale: flying ? 1.03 : 1, filter: flying ? 'blur(4px)' : 'blur(0px)' }
          }
          transition={{ duration: flying ? 0.45 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* The flash where the card meets the bricks (the seam sits at ~50.5% / 46% of the logo). */}
        {phase === 'show' && (
          <>
            <motion.span
              className="pointer-events-none absolute left-[50.5%] top-[46%] h-[46%] w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,214,120,0.55) 22%, rgba(255,214,120,0) 62%)' }}
              initial={{ opacity: 0, scale: 0.1 }}
              animate={{ opacity: [0, 1, 0], scale: [0.1, 1.15, 1.5] }}
              transition={{ duration: 1.1, delay: 0.35, times: [0, 0.35, 1], ease: 'easeOut' }}
            />
            <motion.span
              className="pointer-events-none absolute left-[50.5%] top-[46%] h-[2px] w-[80%] -translate-x-1/2 -translate-y-1/2"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: [0, 1, 0], scaleX: [0, 1, 1] }}
              transition={{ duration: 0.9, delay: 0.4, times: [0, 0.4, 1], ease: 'easeOut' }}
            />
          </>
        )}
      </div>

      {/* The brick "C" detaches from the logo and lands on the header mark. */}
      {fly && (
        <motion.img
          src={cmark}
          alt=""
          draggable="false"
          className="pointer-events-none fixed"
          style={{ left: fly.left, top: fly.top, width: fly.size, height: fly.size, filter: 'drop-shadow(0 0 18px rgba(255,190,60,0.6))' }}
          initial={{ x: 0, y: 0, scale: 1 }}
          animate={{ x: fly.dx, y: fly.dy, scale: fly.scale }}
          transition={{ duration: FLY_S, ease: [0.65, 0, 0.25, 1] }}
          onAnimationComplete={finish}
        />
      )}

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); skip(); }}
        className="absolute bottom-6 right-5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60 backdrop-blur-md transition-colors hover:text-white"
        style={{ opacity: phase === 'fly' ? 0 : 1, transition: 'opacity .3s' }}
      >
        {t('brand.skip_intro')}
      </button>
    </motion.div>
  );
}
