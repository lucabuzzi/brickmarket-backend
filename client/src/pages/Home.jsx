import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import ListingCard from '../components/ListingCard';
import {
  SearchX, Search, ShoppingCart, PackagePlus, Gamepad2,
  ShieldCheck, Star, TrendingUp, Users, ArrowRight, Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

function SectionTitle({
  title,
  dotClass = 'bg-gold-400',
  textClass = 'text-gold-400',
  action,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotClass}`} style={{ boxShadow: `0 0 10px var(--tw-shadow-color)`, '--tw-shadow-color': 'currentColor' }} />
        <h2 className={`text-xs min-[360px]:text-sm font-bold uppercase tracking-wider min-[360px]:tracking-[0.18em] ${textClass}`}>
          {title}
        </h2>
      </div>

      {action ? (
        <Link
          to={action.to}
          className="self-start sm:self-auto text-[10px] min-[360px]:text-[11px] md:text-xs font-bold text-stone-300 hover:text-white transition-colors whitespace-nowrap bg-white/5 border border-white/5 px-3 py-1 min-[360px]:px-3.5 min-[360px]:py-1.5 rounded-full hover:bg-white/10 active-shrink"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function BentoListingGrid({ items, loading, slots = 8, featured = false, emptyMessage }) {
  const { t } = useTranslation();
  const finalEmptyMessage = emptyMessage || t('home.no_listings');

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 min-[380px]:gap-3 md:gap-4">
        {Array.from({ length: Math.min(slots, 4) }).map((_, i) => (
          <div key={i} className="w-full">
            <div className="w-full overflow-hidden rounded-2xl border border-white/5 bg-[#14120b]/40 shadow-sm">
              <div className="aspect-[4/3] md:aspect-[3/2] animate-pulse bg-white/5" />
              <div className="space-y-2 p-4">
                <div className="h-2.5 w-16 rounded bg-white/10 animate-pulse" />
                <div className="h-3 w-full rounded bg-white/10 animate-pulse mt-2" />
                <div className="h-3 w-2/3 rounded bg-white/10 animate-pulse" />
                <div className="h-4 w-20 rounded bg-white/10 animate-pulse mt-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white/2 border border-white/5 border-dashed rounded-2xl">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-stone-500 mb-3 shadow-inner">
          <SearchX size={24} />
        </div>
        <p className="text-stone-400 text-sm font-medium">{finalEmptyMessage}</p>
        <Link to="/annunci/lego" className="mt-4 text-xs font-black text-gold-400 hover:text-gold-300 transition-colors uppercase tracking-wider">{t('home.explore_more_listings')}</Link>
      </div>
    );
  }

  const visibleItems = items?.slice(0, slots) || [];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 min-[380px]:gap-3 md:gap-4 items-start">
      {visibleItems?.map((item) => (
        <div key={item.id} className="w-full h-full">
          <ListingCard l={item} isFeatured={featured} />
        </div>
      ))}
    </div>
  );
}

/** Small live-activity pill shown in the hero — real counts, not marketing copy. */
function StatPill({ icon, text, loading }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-md">
      <span className="text-sm leading-none">{icon}</span>
      <span className="text-xs font-bold text-white whitespace-nowrap">
        {loading ? '…' : text}
      </span>
    </div>
  );
}

function HeroCtas() {
  const { t } = useTranslation();
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Link
        to="/annunci/lego"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-gold-500/25 active-shrink transition-all duration-200"
      >
        <Search size={15} /> {t('home.explore')}
      </Link>
      <Link
        to="/sell"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-black text-xs uppercase tracking-wider active-shrink transition-all duration-200"
      >
        <PackagePlus size={15} /> {t('home.sell_now')}
      </Link>
    </div>
  );
}

function MobileHero({ stats, statsLoading }) {
  const { t } = useTranslation();

  return (
    <section className="block md:hidden">
      <div className="bento-card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-gold-300">
            <Sparkles size={11} /> {t('home.marketplace')}
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-white leading-tight font-mono uppercase">
            {t('home.hero_title_mobile_1')} <span className="text-gradient-sky">{t('home.hero_title_mobile_2')}</span>
          </h1>

          <p className="mt-3 text-xs leading-relaxed text-stone-400">
            {t('home.hero_subtitle_mobile')}
          </p>

          <HeroCtas />

          <div className="mt-5 flex flex-wrap gap-2">
            <StatPill icon="🧱" text={t('home.stats_listings', { count: stats.listings })} loading={statsLoading} />
            <StatPill icon="⏳" text={t('home.stats_auctions', { count: stats.auctions })} loading={statsLoading} />
          </div>
        </div>
      </div>
    </section>
  );
}

function DesktopHero({ stats, statsLoading }) {
  const { t } = useTranslation();

  return (
    <section className="hidden md:block group">
      <div className="bento-card p-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-gold-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-gold-500/20 transition-colors duration-700" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-pink-500/20 transition-colors duration-700" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-gold-300 backdrop-blur-md">
            <Sparkles size={13} /> {t('home.welcome')}
          </div>

          <h1 className="mt-5 text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight font-mono">
            {t('home.hero_title_desktop_1')} <span className="text-gradient-sky">{t('home.hero_title_desktop_2')}</span>
          </h1>

          <p className="mt-4 text-sm text-stone-400 leading-relaxed max-w-xl">
            {t('home.hero_subtitle_desktop')}
          </p>

          <HeroCtas />

          <div className="mt-6 flex flex-wrap gap-3">
            <StatPill icon="🧱" text={t('home.stats_listings', { count: stats.listings })} loading={statsLoading} />
            <StatPill icon="⏳" text={t('home.stats_auctions', { count: stats.auctions })} loading={statsLoading} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** "How it works" — a scannable 4-step funnel so a first-time visitor immediately
 * understands the actions available on the site, independent of the pillar cards below. */
function HowItWorksSection() {
  const { t } = useTranslation();

  const steps = [
    { icon: <Search size={18} />, title: t('home.step1_title'), desc: t('home.step1_desc'), color: 'text-gold-400 bg-gold-500/10 border-gold-500/20' },
    { icon: <ShoppingCart size={18} />, title: t('home.step2_title'), desc: t('home.step2_desc'), color: 'text-gold-400 bg-gold-500/10 border-gold-500/20' },
    { icon: <PackagePlus size={18} />, title: t('home.step3_title'), desc: t('home.step3_desc'), color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { icon: <Gamepad2 size={18} />, title: t('home.step4_title'), desc: t('home.step4_desc'), color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  ];

  return (
    <Link
      to="/come-funziona"
      className="bento-card p-5 lg:p-8 block group/howitworks hover:border-gold-500/30 transition-colors duration-300 active-shrink"
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg lg:text-xl font-black text-white uppercase tracking-tight font-mono">
            {t('home.how_it_works_title')}
          </h2>
          <p className="text-xs text-stone-400 mt-1">{t('home.how_it_works_subtitle')}</p>
        </div>
        <ArrowRight size={18} className="shrink-0 text-stone-500 group-hover/howitworks:text-gold-400 group-hover/howitworks:translate-x-1 transition-all duration-300" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, i) => (
          <div key={i} className="relative flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/2 p-4">
            <div className="flex items-center justify-between">
              <div className={`h-9 w-9 rounded-xl border flex items-center justify-center ${step.color}`}>
                {step.icon}
              </div>
              <span className="text-[10px] font-black text-stone-600 font-mono">0{i + 1}</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{step.title}</h3>
              <p className="text-xs text-stone-400 mt-1 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}

function PillarsSection({ stats, statsLoading }) {
  const { t } = useTranslation();

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6">
      {/* Pillar 1: Marketplace */}
      <div className="bento-card p-6 flex flex-col justify-between border border-white/5 bg-[#14120b]/30 hover:border-gold-500/30 transition-all duration-300 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gold-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-gold-500/10 transition-colors" />
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 shadow-sm shadow-gold-500/10">
              <ShoppingCart size={18} />
            </div>
            {!statsLoading && (
              <span className="text-[9px] font-black uppercase tracking-wider text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2 py-1 rounded-full whitespace-nowrap">
                {t('home.pillar_marketplace_badge', { count: stats.listings })}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold font-mono text-white uppercase tracking-wider">{t('home.pillar_marketplace_title')}</h3>
          <p className="text-xs text-stone-400 mt-2 leading-relaxed">
            {t('home.pillar_marketplace_desc')}
          </p>
        </div>
        <Link
          to="/annunci/lego"
          className="mt-6 w-full flex items-center justify-center gap-1.5 py-2.5 bg-gold-500 hover:bg-gold-400 text-white rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all duration-300 shadow-md shadow-gold-500/10 active-shrink"
        >
          {t('home.pillar_marketplace_cta')} <ArrowRight size={12} />
        </Link>
      </div>

      {/* Pillar 2: Live Auctions */}
      <div className="bento-card p-6 flex flex-col justify-between border border-white/5 bg-[#14120b]/30 hover:border-gold-500/30 transition-all duration-300 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gold-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-gold-500/10 transition-colors" />
        <div>
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 shadow-sm shadow-gold-500/10">
              <span className="text-xl leading-none">⏳</span>
            </div>
            {!statsLoading && (
              <span className="text-[9px] font-black uppercase tracking-wider text-gold-400 bg-gold-500/10 border border-gold-500/20 px-2 py-1 rounded-full whitespace-nowrap">
                {t('home.pillar_auctions_badge', { count: stats.auctions })}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold font-mono text-white uppercase tracking-wider">{t('home.pillar_auctions_title')}</h3>
          <p className="text-xs text-stone-400 mt-2 leading-relaxed">
            {t('home.pillar_auctions_desc')}
          </p>
        </div>
        <Link
          to="/aste/lego"
          className="mt-6 w-full flex items-center justify-center gap-1.5 py-2.5 bg-gold-500 hover:bg-gold-400 text-white rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all duration-300 shadow-md shadow-gold-500/10 active-shrink"
        >
          {t('home.pillar_auctions_cta')} <ArrowRight size={12} />
        </Link>
      </div>

      {/* Pillar 3: Skill Zone */}
      <div className="bento-card p-6 flex flex-col justify-between border border-white/5 bg-[#14120b]/30 hover:border-pink-500/30 transition-all duration-300 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-500/10 transition-colors" />
        <div>
          <div className="h-10 w-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4 shadow-sm shadow-pink-500/10">
            <Gamepad2 size={18} />
          </div>
          <h3 className="text-base font-bold font-mono text-white uppercase tracking-wider">{t('home.pillar_skillzone_title')}</h3>
          <p className="text-xs text-stone-400 mt-2 leading-relaxed">
            {t('home.pillar_skillzone_desc')}
          </p>
        </div>
        <Link
          to="/skill-zone"
          className="mt-6 w-full flex items-center justify-center gap-1.5 py-2.5 bg-pink-500 hover:bg-pink-400 text-white rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all duration-300 shadow-md shadow-pink-500/10 active-shrink"
        >
          {t('home.pillar_skillzone_cta')} <ArrowRight size={12} />
        </Link>
      </div>
    </section>
  );
}

/** Trust strip — answers "what can I trust about this place" at a glance. */
function TrustSection() {
  const { t } = useTranslation();

  const items = [
    { icon: <ShieldCheck size={18} />, title: t('home.trust_verified_title'), desc: t('home.trust_verified_desc'), color: 'text-gold-400 bg-gold-500/10 border-gold-500/20' },
    { icon: <Star size={18} />, title: t('home.trust_reviews_title'), desc: t('home.trust_reviews_desc'), color: 'text-gold-400 bg-gold-500/10 border-gold-500/20' },
    { icon: <TrendingUp size={18} />, title: t('home.trust_pricing_title'), desc: t('home.trust_pricing_desc'), color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { icon: <Users size={18} />, title: t('home.trust_community_title'), desc: t('home.trust_community_desc'), color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  ];

  return (
    <section className="bento-card p-5 lg:p-8">
      <h2 className="text-lg lg:text-xl font-black text-white uppercase tracking-tight font-mono mb-6">
        {t('home.trust_title')}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/2 p-4">
            <div className={`h-9 w-9 rounded-xl border flex items-center justify-center ${item.color}`}>
              {item.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{item.title}</h3>
              <p className="text-xs text-stone-400 mt-1 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Final push to convert browsers into sellers. */
function CtaBanner() {
  const { t } = useTranslation();
  return (
    <section className="bento-card p-6 lg:p-10 relative overflow-hidden border border-white/5 bg-gradient-to-br from-gold-500/10 via-transparent to-gold-500/10">
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-white uppercase tracking-tight font-mono">
            {t('home.cta_banner_title')}
          </h2>
          <p className="text-sm text-stone-400 mt-2 max-w-xl">{t('home.cta_banner_subtitle')}</p>
        </div>
        <Link
          to="/sell"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-400 text-white rounded-xl font-black uppercase text-xs tracking-wider shadow-lg shadow-gold-500/20 active-shrink transition-all duration-300 shrink-0"
        >
          <PackagePlus size={16} /> {t('home.cta_banner_button')}
        </Link>
      </div>
    </section>
  );
}

function MainHome({ featuredFixed, featuredAuctions, recentFeed, loading, stats, statsLoading }) {
  const { t } = useTranslation();

  return (
    <div className="w-full font-sans">
      <main className="flex flex-col gap-6 w-full">
        <MobileHero stats={stats} statsLoading={statsLoading} />
        <DesktopHero stats={stats} statsLoading={statsLoading} />

        {/* How it works */}
        <HowItWorksSection />

        {/* Three Pillars Section */}
        <PillarsSection stats={stats} statsLoading={statsLoading} />

        {/* Annunci in evidenza */}
        <section className="bento-card p-5 lg:p-8 relative overflow-hidden group/evidenza">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/5 rounded-full blur-3xl pointer-events-none group-hover/evidenza:bg-gold-500/10 transition-colors duration-700" />
          <div className="relative z-10">
            <SectionTitle
              title={t('home.featured_listings')}
              dotClass="bg-gold-500 text-gold-500"
              textClass="text-gold-400"
              action={{ to: '/annunci/lego', label: t('home.see_all') }}
            />
            <div className="mt-5">
              <BentoListingGrid items={featuredFixed} loading={loading} slots={8} featured emptyMessage={t('home.no_featured_listings')} />
            </div>
          </div>
        </section>

        {/* Aste in evidenza */}
        <section className="bento-card p-5 lg:p-8 relative overflow-hidden group/aste">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover/aste:bg-emerald-500/10 transition-colors duration-700" />
          <div className="relative z-10">
            <SectionTitle
              title={t('home.featured_auctions')}
              dotClass="bg-emerald-400 text-emerald-400"
              textClass="text-emerald-400"
              action={{ to: '/aste/lego', label: t('home.open_auctions') }}
            />
            <div className="mt-5">
              <BentoListingGrid items={featuredAuctions} loading={loading} slots={8} emptyMessage={t('home.no_active_auctions')} />
            </div>
          </div>
        </section>

        {/* Ultimi arrivi */}
        <section className="bento-card p-5 lg:p-8 relative overflow-hidden group/arrivi">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/5 rounded-full blur-3xl pointer-events-none group-hover/arrivi:bg-gold-500/10 transition-colors duration-700" />
          <div className="relative z-10">
            <SectionTitle
              title={t('home.recent_listings')}
              dotClass="bg-gold-400 text-gold-400"
              textClass="text-gold-400"
              action={{ to: '/annunci/lego', label: t('home.most_recent') }}
            />
            <div className="mt-5">
              <BentoListingGrid items={recentFeed} loading={loading} slots={8} emptyMessage={t('home.no_recent_listings')} />
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <TrustSection />

        {/* Final sell CTA */}
        <CtaBanner />
      </main>
    </div>
  );
}

export default function Home() {
  const [featuredFixed, setFeaturedFixed] = useState([]);
  const [featuredAuctions, setFeaturedAuctions] = useState([]);
  const [recentFeed, setRecentFeed] = useState([]);
  const [stats, setStats] = useState({ listings: 0, auctions: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [ffData, faData, rfData] = await Promise.all([
          apiFetch('/api/listings?is_auction=false&is_featured=true&limit=8'),
          apiFetch('/api/listings?is_auction=true&is_featured=true&limit=8'),
          apiFetch('/api/listings?is_auction=false&limit=8'),
        ]);

        if (!cancelled) {
          setFeaturedFixed(Array.isArray(ffData) ? ffData : []);
          setFeaturedAuctions(Array.isArray(faData) ? faData : []);
          setRecentFeed(Array.isArray(rfData) ? rfData : []);
          setError('');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || t('errors.unable_to_load_listings'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  // Real activity counts for the hero/pillar stat pills — separate from the
  // capped "featured" fetches above, which only return up to 8 items each.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatsLoading(true);
        const [allFixed, allAuctions] = await Promise.all([
          apiFetch('/api/listings?is_auction=false'),
          apiFetch('/api/listings?is_auction=true'),
        ]);

        if (!cancelled) {
          const activeAuctionsCount = (Array.isArray(allAuctions) ? allAuctions : [])
            .filter((l) => l.status === 'active').length;
          setStats({
            listings: Array.isArray(allFixed) ? allFixed.length : 0,
            auctions: activeAuctionsCount,
          });
        }
      } catch {
        // Non-critical: stat pills just stay at 0 if this fails.
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page home max-w-[1500px] mx-auto px-4 md:px-6 pt-4 pb-16">
      {error ? (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
          {error}
        </div>
      ) : null}

      <MainHome
        featuredFixed={featuredFixed}
        featuredAuctions={featuredAuctions}
        recentFeed={recentFeed}
        loading={loading}
        stats={stats}
        statsLoading={statsLoading}
      />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
