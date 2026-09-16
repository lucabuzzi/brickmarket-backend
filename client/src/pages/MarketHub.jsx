import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Gavel, Plus, Search, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MarketCard from '../components/market/MarketCard';
import { MARKET_CATEGORIES, MARKET_MODES, displayPrice, useMarketItems } from '../components/market/marketConfig';
import { formatEUR, listingImage } from '../components/landing/landingUtils';

const WALL_MIN = 8;

function fillColumn(items) {
  if (!items.length) return [];
  const base = [];
  while (base.length < WALL_MIN) base.push(...items);
  return [...base, ...base];
}

/** Three slowly scrolling columns of real item photos, alternating direction. */
function ImageWall({ items, mode }) {
  const { i18n } = useTranslation();
  const columns = [0, 1, 2].map((c) => {
    const own = items.filter((_, i) => i % 3 === c);
    return fillColumn(own.length ? own : items);
  });

  return (
    <div className="lx-wall relative h-[380px] overflow-hidden sm:h-[460px] lg:h-[600px]" aria-hidden="true">
      <div className="grid h-full grid-cols-3 gap-3">
        {columns.map((col, c) => (
          <div key={c} className={`flex flex-col gap-3 ${c === 1 ? 'lx-fall' : 'lx-rise'}`} style={{ animationDuration: `${48 + c * 10}s` }}>
            {col.map((item, i) => (
              <Link
                key={`${item.id}-${i}`}
                to={`/product/${item.id}`}
                tabIndex={-1}
                className="group relative block aspect-[4/5] shrink-0 overflow-hidden rounded-2xl bg-[#1b1822]"
              >
                <img src={listingImage(item, 360)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute inset-x-2 bottom-2 truncate rounded-lg bg-black/70 px-2 py-1 font-mono text-[11px] font-black text-white opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100">
                  {formatEUR(displayPrice(item), i18n.language)}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#07060b] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#07060b] to-transparent" />
      <div className="pointer-events-none absolute -right-10 top-1/3 h-64 w-64 rounded-full blur-[110px]" style={{ background: mode.accent, opacity: 0.18 }} />
    </div>
  );
}

/** Empty auction floor: a spotlight on an empty pedestal that invites the first lot. */
function EmptyStage() {
  const { t } = useTranslation();
  return (
    <div className="relative flex h-[420px] items-end justify-center overflow-hidden sm:h-[520px] lg:h-[600px]">
      <div className="lx-spotlight pointer-events-none absolute inset-x-0 top-0 h-full" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-10 h-16 w-[78%] max-w-[420px] rounded-[50%] bg-[#ff5a36]/20 blur-2xl" aria-hidden="true" />
      <div className="relative mb-16 flex w-full flex-col items-center">
        <Link
          to="/create-auction"
          className="lx-float group flex aspect-[4/5] w-[62%] max-w-[260px] flex-col items-center justify-center gap-4 rounded-[28px] border-2 border-dashed border-white/25 bg-white/[0.03] text-center backdrop-blur-sm transition-colors hover:border-[#ff5a36] hover:bg-[#ff5a36]/10"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ff5a36] text-white transition-transform group-hover:scale-110">
            <Plus size={30} strokeWidth={2.6} />
          </span>
          <span className="px-4 text-lg font-black leading-tight text-white">{t('market.hub.stage_card')}</span>
        </Link>
        <div className="mt-6 h-5 w-[70%] max-w-[340px] rounded-[50%] bg-gradient-to-b from-white/15 to-transparent" aria-hidden="true" />
      </div>
    </div>
  );
}

function CategoryPortal({ category, mode, items, index }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const name = category.nameKey ? t(category.nameKey) : category.name;
  const thumbs = items.filter((i) => i.images?.length).slice(0, 3);
  const countKey = mode.isAuction ? 'market.count_auctions' : 'market.count_listings';

  return (
    <motion.div
      initial={reduceMotion ? false : { y: 30 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`${mode.base}/${category.slug}`}
        className="group relative flex min-h-[400px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0f0d14] p-6 transition-colors duration-500 md:p-8 lg:min-h-[460px]"
        style={{ '--mc-accent': mode.accent, '--mc-ink': mode.accentInk }}
      >
        <span className="lx-outline pointer-events-none absolute -bottom-6 -left-2 select-none whitespace-nowrap text-[7rem] font-black leading-none tracking-[-0.06em] md:text-[8.5rem]" aria-hidden="true">
          {category.name || name.split(' ')[0]}
        </span>
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full blur-[90px] transition-opacity duration-500 group-hover:opacity-40"
          style={{ background: mode.accent, opacity: 0.12 }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <span className="font-mono text-sm font-bold text-white/30">0{index + 1}</span>
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-white transition-all duration-300 group-hover:rotate-45 group-hover:border-transparent group-hover:bg-[color:var(--mc-accent)] group-hover:text-[color:var(--mc-ink)]">
            <ArrowUpRight size={22} />
          </span>
        </div>

        {thumbs.length ? (
          <div className="pointer-events-none relative mx-auto mt-2 h-40 w-32 md:h-48 md:w-36">
            {thumbs.map((item, i) => (
              <img
                key={item.id}
                src={listingImage(item, 300)}
                alt=""
                loading="lazy"
                className={`lx-thumb lx-thumb-${i} absolute inset-0 h-full w-full rounded-2xl border-2 border-[#0f0d14] object-cover shadow-[0_20px_40px_-15px_rgba(0,0,0,0.9)]`}
              />
            ))}
          </div>
        ) : null}

        <div className="relative mt-auto pt-6">
          <h3 className="text-3xl font-black leading-[0.95] tracking-[-0.04em] text-white md:text-4xl">{name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/55">{t(category.taglineKey)}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ background: mode.accent, color: mode.accentInk }}>
            {t(countKey, { count: items.length })}
          </p>
        </div>

      </Link>
    </motion.div>
  );
}

export default function MarketHub({ modeKey = 'listings' }) {
  const mode = MARKET_MODES[modeKey];
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const { items, loading, loadedAt } = useMarketItems(mode);
  const copy = `market.hub.${mode.key}`;

  useEffect(() => {
    document.title = `${t(`${copy}.kicker`)} | CardBrix`;
  }, [t, copy]);

  const byCategory = useMemo(() => Object.fromEntries(
    MARKET_CATEGORIES.map((c) => [c.slug, items.filter((i) => i.product_type === c.productType)]),
  ), [items]);

  const sorted = useMemo(() => [...items].sort((a, b) => (mode.isAuction
    ? new Date(a.auction_end) - new Date(b.auction_end)
    : Number(b.is_featured) - Number(a.is_featured) || new Date(b.created_at) - new Date(a.created_at))), [items, mode.isAuction]);

  const stats = useMemo(() => {
    if (mode.isAuction) {
      // Measured against when the data was loaded; each card still runs its own live clock.
      const soon = items.filter((i) => i.auction_end && new Date(i.auction_end).getTime() - loadedAt < 24 * 3600000).length;
      return [
        { value: items.length, label: t('market.hub.stat_auctions') },
        { value: items.reduce((s, i) => s + (i.bids_count || 0), 0), label: t('market.hub.stat_bids') },
        { value: soon, label: t('market.hub.stat_closing') },
      ];
    }
    const prices = items.map((i) => parseFloat(i.price)).filter((n) => !Number.isNaN(n));
    return [
      { value: items.length, label: t('market.hub.stat_listings') },
      { value: new Set(items.map((i) => i.seller_id)).size, label: t('market.hub.stat_sellers') },
      { value: prices.length ? formatEUR(Math.min(...prices), i18n.language) : '–', label: t('market.hub.stat_from') },
    ];
  }, [items, loadedAt, mode.isAuction, t, i18n.language]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search-results?q=${encodeURIComponent(q)}`);
  };

  const withImages = sorted.filter((i) => i.images?.length);

  return (
    <div className="lx-page">
      {/* HERO */}
      <section className="lx-bleed relative overflow-hidden">
        <div className="lx-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-40 top-20 h-[480px] w-[480px] rounded-full blur-[130px]" style={{ background: mode.accent, opacity: 0.13 }} aria-hidden="true" />

        <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 items-center gap-10 px-5 pb-12 pt-28 md:px-10 md:pt-36 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-16">
          <div className="min-w-0">
            <motion.p
              className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em]"
              style={{ color: mode.accent }}
              initial={reduceMotion ? false : { y: 10 }}
              animate={{ y: 0 }}
            >
              {mode.isAuction ? <Gavel size={15} /> : null}
              {t(`${copy}.kicker`)}
            </motion.p>
            <h1 className="mt-4 text-[clamp(2.8rem,10vw,6.6rem)] font-black leading-[0.88] tracking-[-0.055em] text-white lg:text-[clamp(3rem,6.4vw,6.6rem)]">
              {[t(`${copy}.title_1`), t(`${copy}.title_2`)].map((line, i) => (
                <span key={line} className="block overflow-hidden pb-[0.08em]">
                  <motion.span
                    className="block"
                    style={i === 1 ? { color: mode.accent } : undefined}
                    initial={reduceMotion ? false : { y: '105%' }}
                    animate={{ y: 0 }}
                    transition={{ delay: 0.08 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>
            <p className="mt-6 max-w-[34rem] text-base leading-relaxed text-white/60 md:text-lg">{t(`${copy}.subtitle`)}</p>

            <dl className="mt-8 grid max-w-[34rem] grid-cols-3 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col-reverse rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 md:px-4">
                  <dt className="mt-1 text-[11px] font-semibold leading-tight text-white/45">{s.label}</dt>
                  <dd className="font-mono text-xl font-black tabular-nums text-white md:text-2xl">{loading ? '–' : s.value}</dd>
                </div>
              ))}
            </dl>

            <form
              onSubmit={handleSearch}
              role="search"
              className="mt-6 flex max-w-[34rem] items-center gap-2 rounded-2xl border border-white/12 bg-[#110f17]/80 p-1.5 backdrop-blur-xl"
            >
              <Search size={18} className="ml-3 shrink-0 text-white/40" aria-hidden="true" />
              <label htmlFor="mh-search" className="sr-only">{t('landing.hero.search_label')}</label>
              <input
                id="mh-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('landing.hero.search_placeholder')}
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-white placeholder:text-white/35 focus:outline-none"
              />
              <button type="submit" className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-black transition-transform active:scale-95" style={{ background: mode.accent, color: mode.accentInk }}>
                {t('landing.hero.search_button')}
              </button>
            </form>
          </div>

          <div className="min-w-0">
            {loading ? (
              <div className="h-[380px] animate-pulse rounded-[32px] bg-white/[0.03] sm:h-[460px] lg:h-[600px]" />
            ) : withImages.length ? (
              <ImageWall items={withImages} mode={mode} />
            ) : mode.isAuction ? (
              <EmptyStage />
            ) : null}
          </div>
        </div>
      </section>

      {/* CATEGORY PORTALS */}
      <section className="lx-bleed relative py-16 md:py-24">
        <div className="mx-auto max-w-[1320px] px-5 md:px-10">
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: mode.accent }}>{t('market.hub.portals_kicker')}</p>
          <h2 className="mt-3 text-[clamp(2.2rem,5.5vw,4.2rem)] font-black leading-[0.92] tracking-[-0.045em] text-white">{t('market.hub.portals_title')}</h2>
          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {MARKET_CATEGORIES.map((c, i) => (
              <CategoryPortal key={c.slug} category={c} mode={mode} items={byCategory[c.slug] || []} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* LIVE GRID */}
      {sorted.length > 0 ? (
        <section className="lx-bleed relative py-12 md:py-16">
          <div className="mx-auto max-w-[1320px] px-5 md:px-10">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em]" style={{ color: mode.accent }}>
              {mode.isAuction ? <Timer size={14} /> : null}
              {t(`${copy}.grid_kicker`)}
            </p>
            <h2 className="mt-3 text-[clamp(2rem,5vw,3.6rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t(`${copy}.grid_title`)}</h2>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {sorted.slice(0, 8).map((item, i) => <MarketCard key={item.id} item={item} mode={mode} index={i} />)}
            </div>
          </div>
        </section>
      ) : null}

      {/* CLOSING BAND */}
      <section className="lx-bleed relative pb-24 pt-12 md:pb-32">
        <div className="mx-auto max-w-[1320px] px-5 md:px-10">
          <div className="relative overflow-hidden rounded-[36px] px-6 py-12 md:px-14 md:py-16" style={{ background: mode.accent, color: mode.accentInk }}>
            <span className="pointer-events-none absolute -right-6 -top-10 select-none text-[10rem] font-black leading-none tracking-[-0.06em] opacity-10 md:text-[16rem]" aria-hidden="true">
              {mode.isAuction ? '02:00' : '€'}
            </span>
            <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-[clamp(2rem,5vw,3.8rem)] font-black leading-[0.92] tracking-[-0.045em]">{t(`${copy}.band_title`)}</h2>
                <p className="mt-4 max-w-lg text-base font-semibold leading-relaxed opacity-75 md:text-lg">{t(`${copy}.band_desc`)}</p>
              </div>
              <Link
                to={mode.createTo}
                className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#07060b] px-7 py-4 text-[15px] font-black text-white transition-transform hover:-translate-y-0.5"
              >
                {t(`${copy}.band_cta`)} <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
