import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Smartphone, UserRound, Map } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// The animated preview (dragon, hero sprite, pixel art) is code-split and only fetched when the card scrolls near
// the viewport, so the home page does not pay for it and none of the game engine is loaded here.
const GamePreviewStage = lazy(() => import('./GamePreviewStage'));

function useNearViewport() {
  const ref = useRef(null);
  // Without IntersectionObserver (very old browsers) the preview simply loads right away.
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, near];
}

/**
 * Entry card to "CardBrix the Game!" (the separate /game experience). It is only a link plus a decorative
 * animation: nothing of the game itself is loaded or embedded in the site.
 */
export default function LandingGameBanner() {
  const { t } = useTranslation();
  const [stageRef, near] = useNearViewport();

  const chips = [
    { icon: <UserRound className="h-3.5 w-3.5 text-[#22d3ee]" aria-hidden />, text: t('landing.game_banner.chip_character') },
    { icon: <Map className="h-3.5 w-3.5 text-[#22d3ee]" aria-hidden />, text: t('landing.game_banner.chip_tutorial') },
    { icon: <Smartphone className="h-3.5 w-3.5 text-[#22d3ee]" aria-hidden />, text: t('landing.game_banner.chip_mobile') },
  ];

  return (
    <section className="lx-bleed relative py-6 md:py-10">
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0c12] p-5 sm:p-8 md:p-10">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-[100px]" style={{ background: '#3b82f6' }} aria-hidden />
          <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full opacity-25 blur-[100px]" style={{ background: '#8b5cf6' }} aria-hidden />

          <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12">
            <div className="min-w-0 lg:order-1">
              <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-[#22d3ee]">
                <Gamepad2 className="h-4 w-4" aria-hidden /> {t('landing.game_banner.kicker')}
              </p>
              <h2 className="mt-3 text-[clamp(1.9rem,4.6vw,3.2rem)] font-black leading-[1.02] tracking-[-0.03em] text-white">{t('landing.game_banner.title')}</h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/60">{t('landing.game_banner.text')}</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {chips.map(({ icon, text }) => (
                  <li key={text} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 text-xs font-bold text-white/80">
                    {icon} {text}
                  </li>
                ))}
              </ul>
              <Link
                to="/game"
                className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full px-8 font-black text-black shadow-[0_10px_30px_-10px_rgba(212,175,55,0.8)] transition hover:brightness-110"
                style={{ background: '#d4af37' }}
              >
                {t('landing.game_banner.cta')} <span aria-hidden>▶</span>
              </Link>
            </div>

            <div ref={stageRef} className="mx-auto w-full min-w-0 max-w-[560px] lg:order-2 lg:max-w-none">
              <Link to="/game" tabIndex={-1} aria-hidden className="block">
                {near ? (
                  <Suspense fallback={<div className="aspect-[16/11] rounded-3xl bg-white/[0.04]" />}>
                    <GamePreviewStage />
                  </Suspense>
                ) : (
                  <div className="aspect-[16/11] rounded-3xl bg-white/[0.04]" />
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
