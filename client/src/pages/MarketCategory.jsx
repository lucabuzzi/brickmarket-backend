import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, ArrowLeft, ArrowRight, Gavel, PackageOpen, Search, SearchX, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MarketCard from '../components/market/MarketCard';
import {
  LEGO_SUBCATEGORIES, MARKET_CARD_GAMES, MARKET_CATEGORIES, MARKET_MODES, displayPrice, useMarketItems,
} from '../components/market/marketConfig';
import { listingImage } from '../components/landing/landingUtils';

function Chip({ active, onClick, children, mode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-bold transition-all ${
        active ? 'border-transparent' : 'border-white/12 text-white/70 hover:border-white/40 hover:text-white'
      }`}
      style={active ? { background: mode.accent, color: mode.accentInk } : undefined}
    >
      {children}
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-[22px] border border-white/5 bg-white/[0.02] p-2">
          <div className="aspect-[4/5] animate-pulse rounded-[16px] bg-white/[0.05]" />
          <div className="space-y-2 p-2 pt-4">
            <div className="h-3.5 w-4/5 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.05]" />
            <div className="mt-4 h-5 w-1/3 animate-pulse rounded bg-white/[0.07]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MarketCategory({ modeKey = 'listings', productType = 'lego', game = null }) {
  const mode = MARKET_MODES[modeKey];
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { items, loading, error, reload } = useMarketItems(mode, { productType, game });

  const [search, setSearch] = useState('');
  const [sub, setSub] = useState('');
  const [sort, setSort] = useState(mode.defaultSort);

  const category = MARKET_CATEGORIES.find((c) => c.productType === productType);
  const gameInfo = productType === 'tcg' ? MARKET_CARD_GAMES.find((g) => g.slug === game) : null;
  const categoryName = category?.nameKey ? t(category.nameKey) : category?.name;
  const title = gameInfo ? gameInfo.name : categoryName;
  const back = gameInfo
    ? { to: `${mode.base}/carte-collezionabili`, label: t('hubs.categories.carte_name') }
    : { to: mode.base, label: t(`market.back_hub_${mode.key}`) };

  useEffect(() => {
    document.title = `${t(`market.hub.${mode.key}.kicker`)} ${title} | CardBrix`;
  }, [t, mode.key, title]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = items.filter((l) => (
      (!q || [l.title, l.theme, l.set_number].some((v) => v && v.toLowerCase().includes(q)))
      && (!sub || l.category === sub)
    ));
    const price = (l) => parseFloat(displayPrice(l)) || 0;
    const sorters = {
      recent: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      'price-asc': (a, b) => price(a) - price(b),
      'price-desc': (a, b) => price(b) - price(a),
      'closing-soon': (a, b) => new Date(a.auction_end) - new Date(b.auction_end),
    };
    return result.sort(sorters[sort] || sorters.recent);
  }, [items, search, sub, sort]);

  const hasFilters = Boolean(search || sub || sort !== mode.defaultSort);
  const resetFilters = () => {
    setSearch('');
    setSub('');
    setSort(mode.defaultSort);
  };

  const mosaic = items.filter((i) => i.images?.length).slice(0, 6);
  const countKey = mode.isAuction ? 'market.count_auctions' : 'market.count_listings';

  return (
    <div className="lx-page">
      {/* HEADER */}
      <section className="lx-bleed relative overflow-hidden">
        {mosaic.length ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] grid-cols-3 gap-2 opacity-30 [mask-image:linear-gradient(to_left,black,transparent)] md:grid" aria-hidden="true">
            {mosaic.map((item) => (
              <img key={item.id} src={listingImage(item, 360)} alt="" className="h-full w-full object-cover" />
            ))}
          </div>
        ) : null}
        <div className="lx-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-32 top-16 h-[400px] w-[400px] rounded-full blur-[130px]" style={{ background: mode.accent, opacity: 0.12 }} aria-hidden="true" />

        <div className="relative mx-auto max-w-[1320px] px-5 pb-10 pt-28 md:px-10 md:pb-14 md:pt-36">
          <Link to={back.to} className="-my-2 inline-flex items-center gap-2 py-2 text-sm font-bold text-white/60 transition-colors hover:text-white">
            <ArrowLeft size={16} /> {back.label}
          </Link>

          <p className="mt-6 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em]" style={{ color: mode.accent }}>
            {mode.isAuction ? <Gavel size={14} /> : null}
            {t(`market.hub.${mode.key}.kicker`)}
            {gameInfo ? <span className="text-white/40">· {categoryName}</span> : null}
          </p>
          <motion.h1
            className="mt-3 max-w-4xl text-[clamp(2.8rem,10vw,7rem)] font-black leading-[0.86] tracking-[-0.055em] text-white"
            initial={reduceMotion ? false : { y: 24 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {title}
          </motion.h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
            {t(mode.isAuction ? 'aste.subtitle' : 'annunci.subtitle', { title })}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="rounded-full px-4 py-2.5 text-sm font-black" style={{ background: mode.accent, color: mode.accentInk }}>
              {loading ? '…' : t(countKey, { count: items.length })}
            </span>
            <Link
              to={mode.createTo}
              className="group inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:border-white/40"
            >
              {t(`market.category.cta_${mode.key}`)} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* TOOLBAR */}
      <div className="lx-bleed sticky top-16 z-30 border-y border-white/10 bg-[#07060b]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-3 md:px-10 lg:flex-row lg:items-center">
          <div className="relative lg:w-[340px] lg:shrink-0">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" />
            <label htmlFor="mc-search" className="sr-only">{t(mode.isAuction ? 'aste.search_placeholder' : 'annunci.search_placeholder')}</label>
            <input
              id="mc-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('market.category.search_placeholder')}
              className="w-full rounded-full border border-white/12 bg-white/[0.04] py-2.5 pl-11 pr-11 text-[15px] text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label={t('market.category.clear_search')}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-white/50 hover:text-white"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>

          <div className="lx-rail -mx-5 flex items-center gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-1 lg:px-0">
            {productType === 'lego' ? (
              <>
                <Chip active={!sub} onClick={() => setSub('')} mode={mode}>{t('market.category.sub_all')}</Chip>
                {LEGO_SUBCATEGORIES.map((s) => (
                  <Chip key={s} active={sub === s} onClick={() => setSub(s)} mode={mode}>{t(`market.category.sub_${s}`)}</Chip>
                ))}
                <span className="mx-1 h-6 w-px shrink-0 bg-white/15" aria-hidden="true" />
              </>
            ) : null}
            {mode.sorts.map((s) => (
              <Chip key={s} active={sort === s} onClick={() => setSort(s)} mode={mode}>{t(`market.category.sort_${s.replace('-', '_')}`)}</Chip>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <span className="text-sm font-semibold text-white/50" aria-live="polite">
              {loading ? '' : t('market.category.results', { count: filtered.length })}
            </span>
            {hasFilters ? (
              <button type="button" onClick={resetFilters} className="rounded-full px-3 py-2.5 text-sm font-bold text-white/70 underline decoration-white/25 underline-offset-4 hover:text-white">
                {t('market.category.reset')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* RESULTS */}
      <section className="lx-bleed relative pb-24 pt-8 md:pb-32 md:pt-10">
        <div className="mx-auto max-w-[1320px] px-5 md:px-10">
          {error ? (
            <div className="mx-auto flex max-w-lg flex-col items-center rounded-[28px] border border-[#ff5a36]/30 bg-[#ff5a36]/5 p-10 text-center">
              <AlertCircle size={34} className="text-[#ff5a36]" />
              <h2 className="mt-4 text-xl font-black text-white">{t('errors.generic')}</h2>
              <p className="mt-2 text-sm text-white/55">{t(mode.isAuction ? 'aste.load_error' : 'errors.unable_to_load_listings')}</p>
              <button type="button" onClick={reload} className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#07060b]">
                {t('annunci.retry_button')}
              </button>
            </div>
          ) : loading ? (
            <SkeletonGrid />
          ) : items.length === 0 ? (
            <div className="relative mx-auto flex max-w-2xl flex-col items-center overflow-hidden rounded-[32px] border border-dashed border-white/15 px-6 py-14 text-center md:py-20">
              <div className="pointer-events-none absolute -top-24 h-64 w-64 rounded-full blur-[100px]" style={{ background: mode.accent, opacity: 0.18 }} aria-hidden="true" />
              {mode.isAuction ? <Gavel size={40} style={{ color: mode.accent }} /> : <PackageOpen size={40} style={{ color: mode.accent }} />}
              <h2 className="relative mt-5 text-2xl font-black tracking-[-0.02em] text-white md:text-3xl">{t(`market.category.empty_title_${mode.key}`, { title })}</h2>
              <p className="relative mt-3 max-w-md text-base text-white/55">{t(`market.category.empty_desc_${mode.key}`)}</p>
              <Link
                to={mode.createTo}
                className="relative mt-8 inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-[15px] font-black transition-transform hover:-translate-y-0.5"
                style={{ background: mode.accent, color: mode.accentInk }}
              >
                {t(`market.category.cta_${mode.key}`)} <ArrowRight size={18} />
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="mx-auto flex max-w-lg flex-col items-center rounded-[28px] border border-dashed border-white/15 p-10 text-center">
              <SearchX size={34} className="text-white/50" />
              <h2 className="mt-4 text-xl font-black text-white">{t('market.category.no_match_title')}</h2>
              <p className="mt-2 text-sm text-white/55">{t('market.category.no_match_desc')}</p>
              <button type="button" onClick={resetFilters} className="mt-6 rounded-xl px-5 py-3 text-sm font-black" style={{ background: mode.accent, color: mode.accentInk }}>
                {t('market.category.reset')}
              </button>
            </div>
          ) : (
            <motion.div layout={!reduceMotion} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              <AnimatePresence initial={false}>
                {filtered.map((item, i) => (
                  <motion.div
                    key={item.id}
                    layout={!reduceMotion}
                    exit={reduceMotion ? undefined : { opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MarketCard item={item} mode={mode} index={i} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
