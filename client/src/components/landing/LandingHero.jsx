import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, Search, Swords } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatEUR } from './landingUtils';
import art from '../../assets/brand/art-1100.webp';

// The art is a rectangle of dark image; fading every edge to transparent is what lets it dissolve
// into the page instead of reading as a pasted-on box.
const BACKDROP_MASK = 'radial-gradient(ellipse 48% 48% at 50% 50%, #000 38%, transparent 100%)';

// Fan layout for the floating card stack, front card first. x/y are desktop pixels,
// multiplied by --k (smaller on mobile) so the same arrangement scales down.
const FAN = [
  { x: 0, y: 0, r: 0, s: 1, z: 50 },
  { x: -150, y: 34, r: -10, s: 0.88, z: 40 },
  { x: 150, y: 34, r: 10, s: 0.88, z: 40 },
  { x: -270, y: 86, r: -19, s: 0.76, z: 30 },
  { x: 270, y: 86, r: 19, s: 0.76, z: 30 },
];

const KIND_STYLES = {
  listing: 'bg-[#c6ff3d] text-[#10140a]',
  auction: 'bg-[#ff5a36] text-white',
  contest: 'bg-[#8b5cf6] text-white',
};

function StackCard({ item, slot, index }) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const pos = FAN[slot];

  return (
    <div
      className="absolute left-1/2 top-0 w-[var(--card-w)]"
      style={{
        zIndex: pos.z,
        transform: `translate(calc(-50% + var(--k) * ${pos.x}px), calc(var(--k) * ${pos.y}px)) rotate(${pos.r}deg) scale(${pos.s})`,
      }}
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 + index * 0.09, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <Link
          to={item.href}
          className="group block rounded-[22px] bg-[#131119] p-2 ring-1 ring-white/10 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)] transition-transform duration-500 ease-out hover:-translate-y-4 hover:ring-white/30 focus-visible:-translate-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]"
          aria-label={item.title}
        >
          <div className="relative aspect-[3/4] overflow-hidden rounded-[16px] bg-[#1c1924]">
            {item.image ? (
              <img
                src={item.image}
                alt=""
                loading={slot === 0 ? 'eager' : 'lazy'}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : null}
            <span className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${KIND_STYLES[item.kind]}`}>
              {t(`landing.hero.kind_${item.kind}`)}
            </span>
          </div>
          <div className="px-2 pb-1.5 pt-2.5">
            <p className="truncate text-[13px] font-bold text-white">{item.title}</p>
            <p className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-white/60">
              {item.kind === 'contest'
                ? t('landing.hero.prize_value', { value: formatEUR(item.value, i18n.language) })
                : formatEUR(item.value, i18n.language)}
            </p>
          </div>
        </Link>
      </motion.div>
    </div>
  );
}

export default function LandingHero({ stackItems, stats, statsLoading }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState('');

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-14, 14]), { stiffness: 120, damping: 18 });
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 120, damping: 18 });

  // Logo backdrop drifts against the card fan's tilt, which reads as depth between the two layers.
  const bx = useSpring(useTransform(mx, [-0.5, 0.5], [30, -30]), { stiffness: 60, damping: 20 });
  const by = useSpring(useTransform(my, [-0.5, 0.5], [20, -20]), { stiffness: 60, damping: 20 });

  const handlePointerMove = (e) => {
    if (reduceMotion || e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/search-results?q=${encodeURIComponent(q)}` : '/annunci');
  };

  const words = [
    { text: t('landing.hero.word_collect'), className: 'text-[#c6ff3d]' },
    { text: t('landing.hero.word_bid'), className: 'text-[#ff5a36]' },
    { text: t('landing.hero.word_win'), className: 'lx-text-arena' },
  ];

  const quickLinks = [
    { label: 'LEGO', to: '/annunci/lego' },
    { label: 'Pokémon', to: '/annunci/carte-collezionabili/pokemon' },
    { label: 'One Piece', to: '/annunci/carte-collezionabili/onepiece' },
    { label: 'Magic', to: '/annunci/carte-collezionabili/magic' },
    { label: 'Funko', to: '/annunci/funko' },
  ];

  const liveCounts = [
    { to: '/annunci', value: stats.listings, label: t('landing.hero.count_listings'), dot: 'bg-[#c6ff3d]' },
    { to: '/aste', value: stats.auctions, label: t('landing.hero.count_auctions'), dot: 'bg-[#ff5a36]' },
    { to: '/skill-zone', value: stats.contests, label: t('landing.hero.count_contests'), dot: 'bg-[#8b5cf6]' },
  ];

  return (
    <section
      className="lx-bleed lx-hero relative overflow-hidden"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => { mx.set(0); my.set(0); }}
    >
      <div className="lx-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-[#c6ff3d]/15 blur-[120px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-20 top-40 h-[560px] w-[560px] rounded-full bg-[#8b5cf6]/25 blur-[130px]" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-[-200px] left-1/3 h-[420px] w-[420px] rounded-full bg-[#ff5a36]/15 blur-[120px]" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 gap-10 px-5 pb-16 pt-28 md:px-10 md:pt-36 lg:grid-cols-[1.05fr_0.95fr] lg:gap-x-14 lg:gap-y-8 lg:pb-28">
        {/* On phones: headline + CTAs first, then the product fan, then search, so imagery and the main
            actions land within the first swipe. From lg the fan moves to its own column spanning both rows. */}
        <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:self-end">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 backdrop-blur-md"
          >
            <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white">
              <span className="relative flex h-2 w-2">
                <span className="lx-ping absolute inline-flex h-full w-full rounded-full bg-[#c6ff3d]" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c6ff3d]" />
              </span>
              {t('landing.hero.live')}
            </span>
            {liveCounts.map((c) => (
              <Link key={c.to} to={c.to} className="relative flex items-center gap-1.5 text-[12px] font-semibold text-white/60 transition-colors after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-[''] hover:text-white">
                <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                <span className="font-mono font-bold tabular-nums text-white">{statsLoading ? '–' : c.value}</span>
                {c.label}
              </Link>
            ))}
          </motion.div>

          <h1 className="mt-7 text-[clamp(3.1rem,11vw,7.4rem)] font-black leading-[0.86] tracking-[-0.055em] lg:text-[clamp(3rem,7.5vw,7.4rem)]">
            {words.map((w, i) => (
              <span key={w.text} className="block overflow-hidden pb-[0.08em]">
                <motion.span
                  className={`block ${w.className}`}
                  initial={reduceMotion ? false : { y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.1 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                  {w.text}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            className="mt-6 max-w-[34rem] text-base leading-relaxed text-white/65 md:text-lg"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.6 }}
          >
            {t('landing.hero.subtitle')}
          </motion.p>

          <div className="mt-8 flex flex-col gap-3 min-[430px]:flex-row">
            <Link
              to="/annunci"
              className="lx-shine group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white px-6 py-4 text-[15px] font-black text-[#07060b] transition-transform hover:-translate-y-0.5"
            >
              {t('landing.hero.cta_listings')}
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/skill-zone"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#8b5cf6]/50 bg-[#8b5cf6]/10 px-6 py-4 text-[15px] font-black text-white transition-all hover:-translate-y-0.5 hover:border-[#8b5cf6] hover:bg-[#8b5cf6]/25"
            >
              <Swords size={18} />
              {t('landing.hero.cta_arena')}
            </Link>
          </div>
        </div>

        <div className="relative lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
          <motion.div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.img
              src={art}
              alt=""
              width="1100"
              height="649"
              decoding="async"
              draggable="false"
              className="w-[135%] max-w-none select-none opacity-[0.4] sm:w-[125%]"
              style={{ x: reduceMotion ? 0 : bx, y: reduceMotion ? 0 : by, maskImage: BACKDROP_MASK, WebkitMaskImage: BACKDROP_MASK }}
            />
          </motion.div>
          {stackItems.length > 0 ? (
            <div className="relative mx-auto h-[340px] w-full max-w-[640px] [--card-w:170px] [--k:0.55] [perspective:1400px] min-[430px]:[--k:0.62] sm:h-[460px] sm:[--card-w:210px] md:[--k:0.8] lg:h-[540px] lg:[--card-w:220px] lg:[--k:0.6] xl:[--k:0.82] 2xl:[--card-w:240px] 2xl:[--k:1]">
              <div className="lx-float h-full w-full">
                <motion.div
                  className="relative h-full w-full pt-6 [transform-style:preserve-3d]"
                  style={reduceMotion ? undefined : { rotateX, rotateY }}
                >
                  {stackItems.slice(0, FAN.length).map((item, i) => (
                    <StackCard key={item.key} item={item} slot={i} index={i} />
                  ))}
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="h-[340px] w-full sm:h-[460px] lg:h-[540px]" />
          )}
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
          <motion.form
            onSubmit={handleSearch}
            role="search"
            className="flex max-w-[34rem] items-center gap-2 rounded-2xl border border-white/12 bg-[#110f17]/80 p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-colors focus-within:border-[#c6ff3d]/60"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
          >
            <Search size={18} className="ml-3 shrink-0 text-white/40" aria-hidden="true" />
            <label htmlFor="lx-search" className="sr-only">{t('landing.hero.search_label')}</label>
            <input
              id="lx-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('landing.hero.search_placeholder')}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-white placeholder:text-white/35 focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-[#c6ff3d] px-4 py-2.5 text-sm font-black text-[#10140a] transition-transform hover:scale-[1.03] active:scale-95"
            >
              {t('landing.hero.search_button')}
            </button>
          </motion.form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-white/40">{t('landing.hero.popular')}</span>
            {quickLinks.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="relative rounded-full border border-white/10 px-3.5 py-2 text-xs font-bold text-white/70 transition-colors after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] hover:border-[#c6ff3d]/60 hover:text-[#c6ff3d]"
              >
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
