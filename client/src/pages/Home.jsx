import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import ListingCard from '../components/ListingCard';
import { SearchX } from 'lucide-react';

function SectionTitle({
  title,
  dotClass = 'bg-cyan-400',
  textClass = 'text-cyan-400',
  action,
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-700/50 pb-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${dotClass}`} style={{ boxShadow: `0 0 10px var(--tw-shadow-color)`, '--tw-shadow-color': 'currentColor' }} />
        <h2 className={`text-sm font-black uppercase tracking-[0.18em] ${textClass}`}>
          {title}
        </h2>
      </div>

      {action ? (
        <Link
          to={action.to}
          className="text-[11px] md:text-xs font-bold text-slate-400 hover:text-white transition-colors whitespace-nowrap bg-slate-800/50 px-3 py-1.5 rounded-full hover:bg-slate-700"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

function BentoListingGrid({ items, loading, slots = 8, featured = false, emptyMessage = "Nessun annuncio disponibile al momento." }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: Math.min(slots, 4) }).map((_, i) => (
          <div key={i} className="w-full">
            <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-[#0f172a] shadow-sm">
              <div className="aspect-[4/3] md:aspect-[3/2] animate-pulse bg-slate-800/80" />
              <div className="space-y-2 p-3">
                <div className="h-2.5 w-16 rounded bg-slate-800 animate-pulse" />
                <div className="h-3 w-full rounded bg-slate-800 animate-pulse mt-2" />
                <div className="h-3 w-2/3 rounded bg-slate-800 animate-pulse" />
                <div className="h-4 w-20 rounded bg-slate-800 animate-pulse mt-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-[#0f172a]/40 border border-slate-800 border-dashed rounded-xl">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
          <SearchX size={24} />
        </div>
        <p className="text-slate-400 text-sm font-medium">{emptyMessage}</p>
        <Link to="/search-results" className="mt-4 text-xs font-black text-sky-400 hover:text-sky-300 transition-colors uppercase tracking-wider">Esplora altri annunci →</Link>
      </div>
    );
  }

  const visibleItems = items?.slice(0, slots) || [];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 items-start">
      {visibleItems?.map((item) => (
        <div key={item.id} className="w-full h-full">
          <ListingCard l={item} isFeatured={featured} />
        </div>
      ))}
    </div>
  );
}

function MobileHero() {
  return (
    <section className="block md:hidden">
      <div className="rounded-2xl border border-slate-700/50 bg-[#0f172a] p-5 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 backdrop-blur-sm">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
            Marketplace
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-white leading-none">
            Compra, vendi e scopri pezzi unici
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            Il punto d'incontro per i collezionisti di Brick.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link
              to="/search-results"
              className="min-h-[44px] flex items-center justify-center rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 active:scale-[0.98] transition-transform shadow-lg shadow-cyan-500/20"
            >
              Esplora
            </Link>
            <Link
              to="/sell"
              className="min-h-[44px] flex items-center justify-center rounded-xl border border-slate-600 bg-slate-800/80 px-4 py-3 text-sm font-bold text-white active:scale-[0.98] transition-all backdrop-blur-md"
            >
              Vendi ora
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function DesktopHero() {
  return (
    <section className="hidden md:block group">
      <div className="rounded-2xl border border-slate-700/50 bg-[#0f172a] p-6 lg:p-8 relative overflow-hidden shadow-sm hover:border-slate-500 hover:scale-[1.01] transition-all duration-500">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-colors duration-700" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-700" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 backdrop-blur-sm">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300 backdrop-blur-md">
              Welcome to Brick Market
            </div>

            <h1 className="mt-4 text-4xl lg:text-5xl font-black tracking-tight text-white leading-none">
              A place where buy, sell and trade Bricks!
            </h1>

            <p className="mt-4 text-base text-slate-300 max-w-2xl leading-7">
              La piattaforma definitiva per collezionisti. Esplora set rari, partecipa ad aste esclusive e vendi i tuoi Brick in un marketplace sicuro e verificato.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/search-results"
              className="min-h-[44px] flex items-center justify-center rounded-xl border border-slate-600 hover:border-slate-400 bg-slate-800/80 px-6 py-3 text-sm font-bold text-yellow transition-all backdrop-blur-md"
            >
              Search by Category
            </Link>
            <Link
              to="/sell"
              className="min-h-[44px] flex items-center justify-center rounded-xl border border-slate-600 hover:border-slate-400 bg-slate-800/80 px-6 py-3 text-sm font-bold text-yellow transition-all backdrop-blur-md"
            >
              Sell Now!
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function MainHome({ featuredFixed, featuredAuctions, recentFeed, loading }) {
  return (
    <div className="w-full font-sans">
      <main className="flex flex-col gap-6 w-full">
        <MobileHero />
        <DesktopHero />

        {/* Annunci in evidenza */}
        <section className="rounded-2xl border border-slate-700/50 hover:border-slate-500 bg-[#0f172a] p-4 lg:p-6 shadow-sm transition-colors duration-300">
          <SectionTitle
            title="Annunci in evidenza"
            dotClass="bg-orange-500 text-orange-500"
            textClass="text-orange-400"
            action={{ to: '/search-results?featured=1', label: 'Vedi tutti' }}
          />
          <div className="mt-5">
            <BentoListingGrid items={featuredFixed} loading={loading} slots={8} featured emptyMessage="Nessun annuncio in evidenza." />
          </div>
        </section>

        {/* Aste in evidenza */}
        <section className="rounded-2xl border border-slate-700/50 hover:border-slate-500 bg-[#0f172a] p-4 lg:p-6 shadow-sm transition-colors duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-700" />
          <div className="relative z-10">
            <SectionTitle
              title="Aste in evidenza"
              dotClass="bg-emerald-400 text-emerald-400"
              textClass="text-emerald-400"
              action={{ to: '/search-results?type=auction', label: 'Apri aste' }}
            />
            <div className="mt-5">
              <BentoListingGrid items={featuredAuctions} loading={loading} slots={8} emptyMessage="Nessun'asta attiva al momento." />
            </div>
          </div>
        </section>

        {/* Ultimi arrivi */}
        <section className="rounded-2xl border border-slate-700/50 hover:border-slate-500 bg-[#0f172a] p-4 lg:p-6 shadow-sm transition-colors duration-300">
          <SectionTitle
            title="Ultimi arrivi"
            dotClass="bg-indigo-400 text-indigo-400"
            textClass="text-indigo-400"
            action={{ to: '/search-results?sort=recent', label: 'Più recenti' }}
          />
          <div className="mt-5">
            <BentoListingGrid items={recentFeed} loading={loading} slots={8} emptyMessage="Nessun articolo recente." />
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
          setError(e.message || 'Impossibile caricare gli annunci');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page home max-w-[1500px] mx-auto px-3 md:px-4 pt-20 md:pt-24 pb-16">
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