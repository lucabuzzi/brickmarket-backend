import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import MarketCard from '../components/market/MarketCard';
import { MARKET_CARD_GAMES, MARKET_MODES, useMarketItems } from '../components/market/marketConfig';
import { listingImage } from '../components/landing/landingUtils';

function GameTile({ game, mode, items, index }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const cover = items.find((i) => i.images?.length);
  const countKey = mode.isAuction ? 'market.count_auctions' : 'market.count_listings';

  return (
    <motion.div
      initial={reduceMotion ? false : { y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`${mode.base}/carte-collezionabili/${game.slug}`}
        className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0f0d14] p-5 transition-all duration-500 hover:-translate-y-1 sm:aspect-[5/4] md:p-7"
        style={{ '--mc-accent': mode.accent, '--mc-ink': mode.accentInk }}
      >
        {cover ? (
          <>
            <img src={listingImage(cover, 500)} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-2xl transition-opacity duration-500 group-hover:opacity-40" />
            <img
              src={listingImage(cover, 400)}
              alt=""
              loading="lazy"
              className="absolute -bottom-6 right-4 w-[42%] max-w-[170px] rotate-6 rounded-2xl border-2 border-[#0f0d14] shadow-[0_25px_50px_-15px_rgba(0,0,0,0.9)] transition-transform duration-500 group-hover:-translate-y-4 group-hover:rotate-0"
            />
          </>
        ) : (
          <span className="lx-outline pointer-events-none absolute -bottom-3 -right-2 select-none whitespace-nowrap text-[5.5rem] font-black leading-none tracking-[-0.06em]" aria-hidden="true">
            {game.name.split(' ')[0]}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f0d14]/80 via-transparent to-transparent" />

        <div className="relative flex items-start justify-between gap-3">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: items.length ? mode.accent : 'rgba(255,255,255,0.08)', color: items.length ? mode.accentInk : 'rgba(255,255,255,0.55)' }}>
            {t(countKey, { count: items.length })}
          </span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white transition-all duration-300 group-hover:rotate-45 group-hover:border-transparent group-hover:bg-[color:var(--mc-accent)] group-hover:text-[color:var(--mc-ink)]">
            <ArrowUpRight size={19} />
          </span>
        </div>
        <h3 className="relative mt-auto max-w-[60%] text-xl font-black leading-[1] tracking-[-0.03em] text-white sm:text-2xl md:text-3xl">
          {game.name}
        </h3>
      </Link>
    </motion.div>
  );
}

export default function MarketCardsHub({ modeKey = 'listings' }) {
  const mode = MARKET_MODES[modeKey];
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { items, loading } = useMarketItems(mode, { productType: 'tcg' });
  const title = t('hubs.categories.carte_name');

  useEffect(() => {
    document.title = `${title} - ${t(`market.hub.${mode.key}.kicker`)} | CardBrix`;
  }, [t, title, mode.key]);

  const byGame = useMemo(
    () => Object.fromEntries(MARKET_CARD_GAMES.map((g) => [g.slug, items.filter((i) => i.game === g.slug)])),
    [items],
  );

  const sorted = useMemo(() => [...items].sort((a, b) => (mode.isAuction
    ? new Date(a.auction_end) - new Date(b.auction_end)
    : new Date(b.created_at) - new Date(a.created_at))), [items, mode.isAuction]);

  return (
    <div className="lx-page">
      <section className="lx-bleed relative overflow-hidden">
        <div className="lx-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-32 top-10 h-[420px] w-[420px] rounded-full blur-[130px]" style={{ background: mode.accent, opacity: 0.12 }} aria-hidden="true" />
        <div className="relative mx-auto max-w-[1320px] px-5 pb-10 pt-28 md:px-10 md:pt-36">
          <Link to={mode.base} className="-my-2 inline-flex items-center gap-2 py-2 text-sm font-bold text-white/60 transition-colors hover:text-white">
            <ArrowLeft size={16} /> {t(`market.back_hub_${mode.key}`)}
          </Link>
          <motion.h1
            className="mt-6 text-[clamp(2.8rem,9vw,6.2rem)] font-black leading-[0.88] tracking-[-0.055em] text-white"
            initial={reduceMotion ? false : { y: 24 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {t('market.cards.title_1')} <span style={{ color: mode.accent }}>{t('market.cards.title_2')}</span>
          </motion.h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/60 md:text-lg">
            {t(mode.isAuction ? 'hubs.aste_cards.subtitle' : 'hubs.annunci_cards.subtitle')}
          </p>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {MARKET_CARD_GAMES.map((g, i) => (
              <GameTile key={g.slug} game={g} mode={mode} items={loading ? [] : byGame[g.slug] || []} index={i} />
            ))}
          </div>
        </div>
      </section>

      {sorted.length > 0 ? (
        <section className="lx-bleed relative pb-24 pt-10 md:pb-32">
          <div className="mx-auto max-w-[1320px] px-5 md:px-10">
            <h2 className="text-[clamp(1.8rem,4.5vw,3.2rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">
              {t(`market.cards.all_${mode.key}`)}
            </h2>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {sorted.map((item, i) => <MarketCard key={item.id} item={item} mode={mode} index={i} />)}
            </div>
          </div>
        </section>
      ) : <div className="pb-24" />}
    </div>
  );
}
