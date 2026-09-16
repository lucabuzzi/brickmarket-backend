import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ANNUNCI_ROUTES, GAME_NAMES, formatEUR, listingImage } from './landingUtils';

const TABS = ['all', 'lego', 'tcg', 'funko'];

function ListingTile({ l }) {
  const { t, i18n } = useTranslation();
  const subtitle = l.product_type === 'tcg'
    ? GAME_NAMES[l.game] || l.theme
    : l.set_number ? t('landing.listings.set_number', { number: l.set_number }) : l.theme;

  return (
    <Link
      to={`/product/${l.id}`}
      className="group flex w-[240px] shrink-0 snap-start flex-col rounded-[24px] border border-white/10 bg-[#121017] p-2.5 transition-all duration-300 hover:-translate-y-1.5 hover:border-[#c6ff3d]/50 sm:w-[270px]"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-[#1b1822]">
        <img
          src={listingImage(l, 540)}
          alt={l.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.07]"
        />
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-md">
            {t(`details.condition_${(l.condition || '').toLowerCase()}`, { defaultValue: l.condition || '' })}
          </span>
          {l.is_featured ? (
            <span className="flex items-center gap-1 rounded-full bg-[#c6ff3d] px-2.5 py-1 text-[10px] font-black uppercase text-[#10140a]">
              <Sparkles size={11} /> {t('landing.listings.featured')}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-white">{l.title}</p>
        {subtitle ? <p className="mt-1 truncate text-xs font-medium text-white/40">{subtitle}</p> : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <span className="font-mono text-xl font-black tabular-nums tracking-tight text-white">
            {formatEUR(l.price, i18n.language)}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-white/45">
            <span className="truncate">{l.seller?.username}</span>
            {l.seller?.is_verified ? <BadgeCheck size={14} className="shrink-0 text-[#c6ff3d]" /> : null}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function LandingListings({ listings, loading }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('all');
  const railRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const counts = useMemo(() => {
    const c = { all: listings.length, lego: 0, tcg: 0, funko: 0 };
    listings.forEach((l) => { if (c[l.product_type] != null) c[l.product_type] += 1; });
    return c;
  }, [listings]);

  const visible = useMemo(() => {
    const filtered = tab === 'all' ? listings : listings.filter((l) => l.product_type === tab);
    return [...filtered].sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      return new Date(b.created_at) - new Date(a.created_at);
    }).slice(0, 12);
  }, [listings, tab]);

  const updateEdges = () => {
    const el = railRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  };

  useEffect(() => {
    const el = railRef.current;
    if (!el) return undefined;
    el.scrollTo({ left: 0 });
    updateEdges();
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible]);

  const scrollBy = (dir) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="lx-bleed relative py-20 md:py-24">
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c6ff3d]">{t('landing.listings.kicker')}</p>
            <h2 className="mt-3 text-[clamp(2rem,5vw,3.6rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">
              {t('landing.listings.title')}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={t('landing.listings.tabs_label')}>
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-bold transition-all ${
                  tab === key
                    ? 'border-[#c6ff3d] bg-[#c6ff3d] text-[#10140a]'
                    : 'border-white/12 text-white/70 hover:border-white/40 hover:text-white'
                }`}
              >
                {t(`landing.listings.tab_${key}`)}
                <span className={`font-mono text-xs tabular-nums ${tab === key ? 'text-[#10140a]/60' : 'text-white/35'}`}>
                  {loading ? '–' : counts[key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          {loading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[400px] w-[240px] shrink-0 animate-pulse rounded-[24px] bg-white/[0.04] sm:w-[270px]" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-[24px] border border-dashed border-white/15 p-8 md:flex-row md:items-center md:justify-between">
              <p className="text-base font-semibold text-white/60">{t('landing.listings.empty')}</p>
              <Link to="/sell" className="rounded-xl bg-[#c6ff3d] px-5 py-3 text-sm font-black text-[#10140a]">
                {t('landing.listings.empty_cta')}
              </Link>
            </div>
          ) : (
            <div
              ref={railRef}
              onScroll={updateEdges}
              className="lx-rail -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-4 pt-2 md:-mx-10 md:scroll-px-10 md:px-10"
            >
              {visible.map((l) => <ListingTile key={l.id} l={l} />)}
              <Link
                to={ANNUNCI_ROUTES[tab]}
                className="group flex w-[240px] shrink-0 snap-start flex-col justify-between rounded-[24px] bg-[#c6ff3d] p-6 text-[#10140a] transition-transform hover:-translate-y-1.5 sm:w-[270px]"
              >
                <span className="text-xs font-black uppercase tracking-[0.2em]">{t('landing.listings.see_all_kicker')}</span>
                <span className="text-4xl font-black leading-[0.95] tracking-[-0.04em]">
                  {t(`landing.listings.see_all_${tab}`)}
                </span>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#10140a] text-[#c6ff3d] transition-transform group-hover:translate-x-2">
                  <ArrowRight size={24} />
                </span>
              </Link>
            </div>
          )}
        </div>

        {!loading && visible.length > 0 ? (
          <div className="mt-6 flex items-center justify-between gap-4">
            <Link
              to={ANNUNCI_ROUTES[tab]}
              className="-my-3 inline-block py-3 text-sm font-bold text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-[#c6ff3d] hover:decoration-[#c6ff3d]"
            >
              {t(`landing.listings.see_all_${tab}`)}
            </Link>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                disabled={edges.start}
                aria-label={t('landing.listings.prev')}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-white transition-all hover:border-[#c6ff3d] hover:text-[#c6ff3d] disabled:pointer-events-none disabled:opacity-25"
              >
                <ArrowLeft size={20} />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                disabled={edges.end}
                aria-label={t('landing.listings.next')}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-white transition-all hover:border-[#c6ff3d] hover:text-[#c6ff3d] disabled:pointer-events-none disabled:opacity-25"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
