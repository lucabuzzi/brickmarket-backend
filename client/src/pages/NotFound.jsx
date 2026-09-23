import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Compass } from 'lucide-react';

// Rendered for any URL that matches no route. The server answers these with HTTP 404 (see
// src/routes/spaFallback.js); this page is what people actually see, and it is marked noindex
// for in-app navigation where no HTTP status is involved.
export default function NotFound() {
  const { t } = useTranslation();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${t('not_found.title')} | CardBrix`;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => {
      robots.remove();
      document.title = previousTitle;
    };
  }, [t]);

  return (
    <section className="lx-page min-h-[calc(100vh-4rem)]">
      <div className="lx-bleed lx-grid pointer-events-none absolute inset-y-0 opacity-30" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[#8b5cf6]/20 blur-[120px]" aria-hidden="true" />

      <div className="relative mx-auto flex max-w-xl flex-col items-center px-5 pb-20 pt-24 text-center md:pt-32">
        <Compass size={40} className="text-[#c6ff3d]" aria-hidden="true" />
        <p className="lx-text-arena mt-4 text-[clamp(5rem,26vw,9rem)] font-black leading-none tracking-[-0.06em]" aria-hidden="true">404</p>
        <h1 className="mt-4 text-[clamp(1.6rem,6vw,2.4rem)] font-black leading-tight tracking-[-0.03em] text-white">{t('not_found.title')}</h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-white/65">{t('not_found.text')}</p>

        <div className="mt-8 flex w-full flex-col gap-3 min-[430px]:w-auto min-[430px]:flex-row">
          <Link
            to="/"
            className="lx-shine group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white px-6 py-4 text-[15px] font-black text-[#07060b] transition-transform hover:-translate-y-0.5"
          >
            {t('not_found.home')}
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/annunci"
            className="inline-flex items-center justify-center rounded-2xl border border-[#8b5cf6]/50 bg-[#8b5cf6]/10 px-6 py-4 text-[15px] font-black text-white transition-all hover:-translate-y-0.5 hover:border-[#8b5cf6] hover:bg-[#8b5cf6]/25"
          >
            {t('not_found.listings')}
          </Link>
        </div>
      </div>
    </section>
  );
}
