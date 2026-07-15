import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import ListingCard from '../components/ListingCard';
import { SearchX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function SectionTitle({
  title,
  dotClass = 'bg-cyan-400',
  textClass = 'text-cyan-400',
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
          className="self-start sm:self-auto text-[10px] min-[360px]:text-[11px] md:text-xs font-bold text-slate-300 hover:text-white transition-colors whitespace-nowrap bg-white/5 border border-white/5 px-3 py-1 min-[360px]:px-3.5 min-[360px]:py-1.5 rounded-full hover:bg-white/10 active-shrink"
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
            <div className="w-full overflow-hidden rounded-2xl border border-white/5 bg-[#0d1224]/40 shadow-sm">
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
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
          <SearchX size={24} />
        </div>
        <p className="text-slate-400 text-sm font-medium">{finalEmptyMessage}</p>
        <Link to="/annunci" className="mt-4 text-xs font-black text-sky-400 hover:text-sky-300 transition-colors uppercase tracking-wider">{t('home.explore_more_listings')}</Link>
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

function MobileHero() {
  const { t } = useTranslation();

  return (
    <section className="block md:hidden">
      <div className="bento-card p-5 min-[380px]:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 min-[380px]:px-3 min-[380px]:py-1 text-[9px] min-[380px]:text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
            {t('home.marketplace')}
          </div>

          <h1 className="mt-4 text-2xl min-[380px]:text-3xl font-black tracking-tight text-white leading-tight">
            {t('home.hero_title_mobile_1')} <span className="text-gradient-sky">{t('home.hero_title_mobile_2')}</span>
          </h1>

          <p className="mt-3 text-xs min-[380px]:text-sm leading-relaxed text-slate-400">
            {t('home.hero_subtitle_mobile')}
          </p>

          <div className="mt-5 flex flex-col min-[380px]:flex-row gap-3 w-full min-[380px]:w-auto">
            <Link
              to="/annunci"
              className="min-h-[40px] min-[380px]:min-h-[44px] flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2.5 min-[380px]:py-3 text-xs min-[380px]:text-sm font-bold text-slate-950 active-shrink hover-glow-accent transition-all duration-300 shadow-lg shadow-sky-500/20"
            >
              {t('home.explore')}
            </Link>
            <Link
              to="/sell"
              className="min-h-[40px] min-[380px]:min-h-[44px] flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 min-[380px]:py-3 text-xs min-[380px]:text-sm font-bold text-white active-shrink transition-all hover:bg-white/10"
            >
              {t('home.sell_now')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function DesktopHero() {
  const { t } = useTranslation();

  return (
    <section className="hidden md:block group">
      <div className="bento-card p-8 lg:p-10 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-sky-500/20 transition-colors duration-700" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-colors duration-700" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-sky-300 backdrop-blur-md">
              {t('home.welcome')}
            </div>

            <h1 className="mt-5 text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              {t('home.hero_title_desktop_1')} <span className="text-gradient-sky">{t('home.hero_title_desktop_2')}</span>
            </h1>

            <p className="mt-4 text-base text-slate-400 max-w-2xl leading-relaxed">
              {t('home.hero_subtitle_desktop')}
            </p>
          </div>

          <div className="flex flex-wrap lg:flex-col xl:flex-row gap-3 shrink-0">
            <Link
              to="/annunci"
              className="min-h-[44px] flex items-center justify-center rounded-xl border border-white/10 hover:border-sky-500/50 bg-white/5 hover:bg-white/10 px-6 py-3 text-sm font-bold text-white transition-all duration-300 active-shrink"
            >
              {t('home.search_by_category')}
            </Link>
            <Link
              to="/sell"
              className="min-h-[44px] flex items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-400 px-6 py-3 text-sm font-bold text-slate-950 transition-all duration-300 hover-glow-accent active-shrink shadow-lg shadow-sky-500/15"
            >
              {t('home.sell_now_btn')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function MainHome({ featuredFixed, featuredAuctions, recentFeed, loading }) {
  const { t } = useTranslation();

  return (
    <div className="w-full font-sans">
      <main className="flex flex-col gap-6 w-full">
        <MobileHero />
        <DesktopHero />

        {/* Annunci in evidenza */}
        <section className="bento-card p-5 lg:p-8 relative overflow-hidden group/evidenza">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none group-hover/evidenza:bg-orange-500/10 transition-colors duration-700" />
          <div className="relative z-10">
            <SectionTitle
              title={t('home.featured_listings')}
              dotClass="bg-orange-500 text-orange-500"
              textClass="text-orange-400"
              action={{ to: '/annunci', label: t('home.see_all') }}
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
              action={{ to: '/aste', label: t('home.open_auctions') }}
            />
            <div className="mt-5">
              <BentoListingGrid items={featuredAuctions} loading={loading} slots={8} emptyMessage={t('home.no_active_auctions')} />
            </div>
          </div>
        </section>

        {/* Ultimi arrivi */}
        <section className="bento-card p-5 lg:p-8 relative overflow-hidden group/arrivi">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none group-hover/arrivi:bg-indigo-500/10 transition-colors duration-700" />
          <div className="relative z-10">
            <SectionTitle
              title={t('home.recent_listings')}
              dotClass="bg-indigo-400 text-indigo-400"
              textClass="text-indigo-400"
              action={{ to: '/annunci', label: t('home.most_recent') }}
            />
            <div className="mt-5">
              <BentoListingGrid items={recentFeed} loading={loading} slots={8} emptyMessage={t('home.no_recent_listings')} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function Home() {
  const [featuredFixed, setFeaturedFixed] = useState([]);
  const [featuredAuctions, setFeaturedAuctions] = useState([]);
  const [recentFeed, setRecentFeed] = useState([]);
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
      />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
} 