import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Gavel, Hammer, Timer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatEUR, listingImage, pad2, useCountdown } from './landingUtils';

function Countdown({ endDate, size = 'lg' }) {
  const { t } = useTranslation();
  const { d, h, m, s, done } = useCountdown(endDate);
  if (done) return <span className="font-mono font-black text-white/50">{t('landing.auctions.ended')}</span>;

  const units = [
    ...(d > 0 ? [{ v: d, l: t('landing.auctions.unit_d') }] : []),
    { v: pad2(h), l: t('landing.auctions.unit_h') },
    { v: pad2(m), l: t('landing.auctions.unit_m') },
    { v: pad2(s), l: t('landing.auctions.unit_s') },
  ];
  const big = size === 'lg';

  return (
    <div className={`flex ${big ? 'gap-2 md:gap-3' : 'gap-1.5'}`}>
      {units.map((u) => (
        <div key={u.l} className={`flex flex-col items-center rounded-xl bg-black/40 ring-1 ring-white/10 ${big ? 'min-w-[64px] px-3 py-2.5 md:min-w-[78px]' : 'min-w-[40px] px-1.5 py-1'}`}>
          <span className={`font-mono font-black tabular-nums text-white ${big ? 'text-3xl md:text-4xl' : 'text-base'}`}>{u.v}</span>
          <span className={`font-bold uppercase text-white/40 ${big ? 'text-[10px] tracking-widest' : 'text-[9px]'}`}>{u.l}</span>
        </div>
      ))}
    </div>
  );
}

// Scripted loop: the clock runs down to its last seconds, a bid lands, and the timer snaps back to 2:00.
const DEMO_STEPS = [7, 6, 5, 4, 3, 2, 'bid', 120, 119, 118, 117, 116];
const BID_STEP = DEMO_STEPS.indexOf('bid');

function AntiSnipingDemo() {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const id = setInterval(() => setStep((prev) => (prev + 1) % DEMO_STEPS.length), 850);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const current = reduceMotion ? 120 : DEMO_STEPS[step];
  const bid = step >= BID_STEP ? 250 : 240;
  const isBid = current === 'bid';
  const seconds = isBid ? 120 : current;
  const urgent = !isBid && seconds <= 10;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#140b0a] p-6 md:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_0%,rgba(255,90,54,0.25),transparent_60%)]" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
            {t('landing.auctions.demo_badge')}
          </span>
          <Timer size={18} className="text-[#ff5a36]" />
        </div>

        <div className="mt-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">{t('landing.auctions.ends_in')}</p>
            <motion.p
              key={isBid ? 'reset' : 'tick'}
              initial={isBid && !reduceMotion ? { scale: 1.25, color: '#c6ff3d' } : false}
              animate={{ scale: 1, color: urgent ? '#ff5a36' : '#ffffff' }}
              transition={{ duration: 0.5 }}
              className="font-mono text-5xl font-black tabular-nums tracking-tight sm:text-7xl md:text-8xl"
            >
              {pad2(Math.floor(seconds / 60))}:{pad2(seconds % 60)}
            </motion.p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">{t('landing.auctions.current_bid')}</p>
            <p className="font-mono text-2xl font-black tabular-nums text-white">{formatEUR(bid, i18n.language)}</p>
          </div>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-[#ff5a36]"
            animate={{ width: `${Math.min(100, (seconds / 120) * 100)}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>

        <div className="mt-5 h-12">
          <AnimatePresence>
            {isBid ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 rounded-2xl bg-[#c6ff3d] px-4 py-3 text-sm font-black text-[#10140a]"
              >
                <Hammer size={16} /> {t('landing.auctions.demo_bid', { value: formatEUR(bid, i18n.language) })}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function FeaturedLot({ lot }) {
  const { t, i18n } = useTranslation();
  const hasBid = lot.current_bid != null;

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-[28px] border border-white/10 bg-[#140b0a] md:grid-cols-[0.9fr_1.1fr]">
      <Link to={`/product/${lot.id}`} className="group relative block aspect-square overflow-hidden bg-black/40 md:aspect-auto">
        <img src={listingImage(lot, 800)} alt={lot.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-[#ff5a36] px-3 py-1.5 text-xs font-black uppercase text-white">
          <span className="lx-ping-soft h-2 w-2 rounded-full bg-white" /> {t('landing.auctions.live_badge')}
        </span>
      </Link>
      <div className="flex flex-col gap-6 p-6 md:p-8">
        <h3 className="text-2xl font-black leading-tight tracking-[-0.02em] text-white md:text-3xl">{lot.title}</h3>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">{t('landing.auctions.ends_in')}</p>
          <Countdown endDate={lot.auction_end} />
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-white/10 pt-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">
              {hasBid ? t('landing.auctions.current_bid') : t('landing.auctions.starting_price')}
            </p>
            <p className="font-mono text-3xl font-black tabular-nums text-white">
              {formatEUR(hasBid ? lot.current_bid : (lot.starting_price ?? lot.price), i18n.language)}
            </p>
          </div>
          <p className="text-sm font-semibold text-white/50">{t('landing.auctions.bids', { count: lot.bids_count || 0 })}</p>
        </div>
        <Link
          to={`/product/${lot.id}`}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff5a36] px-6 py-4 text-base font-black text-white transition-transform hover:-translate-y-0.5"
        >
          <Gavel size={18} /> {t('landing.auctions.bid_cta')}
        </Link>
      </div>
    </div>
  );
}

function LotRow({ lot }) {
  const { t, i18n } = useTranslation();
  return (
    <Link to={`/product/${lot.id}`} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-[#ff5a36]/60">
      <img src={listingImage(lot, 160)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{lot.title}</p>
        <p className="font-mono text-sm font-black tabular-nums text-white/60">
          {formatEUR(lot.current_bid ?? lot.starting_price ?? lot.price, i18n.language)}
        </p>
      </div>
      <div className="hidden sm:block"><Countdown endDate={lot.auction_end} size="sm" /></div>
      <ArrowUpRight size={18} className="shrink-0 text-white/40 transition-colors group-hover:text-[#ff5a36]" aria-label={t('landing.auctions.bid_cta')} />
    </Link>
  );
}

export default function LandingAuctions({ auctions, loading }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [featured, ...others] = auctions;

  return (
    <section className="lx-bleed relative overflow-hidden py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(255,90,54,0.07)_30%,rgba(255,90,54,0.07)_70%,transparent)]" />
      <div className="relative mx-auto max-w-[1320px] px-5 md:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ff5a36]">{t('landing.auctions.kicker')}</p>
            <h2 className="mt-3 text-[clamp(2.4rem,6vw,4.6rem)] font-black leading-[0.9] tracking-[-0.05em] text-white">
              {t('landing.auctions.title')}
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/60">{t('landing.auctions.antisniping_desc')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/aste" className="inline-flex items-center gap-2 rounded-xl bg-[#ff5a36] px-5 py-3 text-sm font-black text-white transition-transform hover:-translate-y-0.5">
                {t('landing.auctions.all_cta')} <ArrowUpRight size={17} />
              </Link>
              <Link to="/create-auction" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-black text-white transition-colors hover:border-[#ff5a36]">
                <Hammer size={16} /> {t('landing.auctions.create_cta')}
              </Link>
            </div>
          </motion.div>

          <div className="min-w-0">
            {loading ? (
              <div className="h-[420px] animate-pulse rounded-[28px] bg-white/[0.04]" />
            ) : featured ? (
              <div className="flex flex-col gap-4">
                <FeaturedLot lot={featured} />
                {others.slice(0, 3).map((lot) => <LotRow key={lot.id} lot={lot} />)}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <AntiSnipingDemo />
                <div className="flex flex-col gap-5 rounded-[28px] border border-dashed border-white/15 p-6 md:flex-row md:items-center md:justify-between md:p-7">
                  <div className="flex gap-4">
                    <Gavel size={26} className="mt-0.5 shrink-0 text-[#ff5a36]" />
                    <div>
                      <h3 className="text-xl font-black leading-tight tracking-[-0.02em] text-white">{t('landing.auctions.empty_title')}</h3>
                      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-white/55">{t('landing.auctions.empty_desc')}</p>
                    </div>
                  </div>
                  <Link to="/create-auction" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-[#07060b] transition-transform hover:-translate-y-0.5">
                    {t('landing.auctions.empty_cta')} <ArrowUpRight size={17} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
