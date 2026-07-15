import { useEffect, useState, useMemo } from 'react';
import { apiFetch } from '../api';
import ListingCard from '../components/ListingCard';
import { Search, X, SlidersHorizontal, ArrowUpDown, Hourglass, AlertCircle, Sparkles } from 'lucide-react';

function SkeletonCard() {
  return (
    <div className="w-full rounded-2xl border border-white/5 bg-[#0d1224]/40 p-4 shadow-sm animate-pulse">
      <div className="aspect-[4/3] md:aspect-[3/2] rounded-xl bg-white/5" />
      <div className="space-y-3 mt-4">
        <div className="h-2.5 w-16 rounded bg-white/10" />
        <div className="h-4 w-full rounded bg-white/10" />
        <div className="h-3.5 w-2/3 rounded bg-white/10" />
        <div className="h-5 w-24 rounded bg-white/10 mt-6" />
      </div>
    </div>
  );
}

export default function Aste() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('closing-soon');

  useEffect(() => {
    document.title = 'Aste Attive | BrickMarket';
    let cancelled = false;

    const fetchAuctions = async () => {
      try {
        setLoading(true);
        setError('');
        // fetch listings with is_auction=true
        const data = await apiFetch('/listings?is_auction=true');
        if (!cancelled) {
          // Keep only active auctions (just in case they expired or are sold)
          const activeAuctions = (Array.isArray(data) ? data : []).filter(l => l.status === 'active');
          setAuctions(activeAuctions);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Impossibile caricare le aste.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAuctions();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleResetFilters = () => {
    setSearch('');
    setCategory('');
    setSort('closing-soon');
  };

  // Instant local filtering and sorting for maximum responsiveness
  const filteredAuctions = useMemo(() => {
    let result = [...auctions];

    // Filter by text search (title, theme, set number)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l => 
        (l.title && l.title.toLowerCase().includes(q)) ||
        (l.theme && l.theme.toLowerCase().includes(q)) ||
        (l.set_number && l.set_number.toLowerCase().includes(q))
      );
    }

    // Filter by category
    if (category) {
      result = result.filter(l => l.category === category);
    }

    // Sorting
    if (sort === 'closing-soon') {
      result.sort((a, b) => new Date(a.auction_end) - new Date(b.auction_end));
    } else if (sort === 'recent') {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    return result;
  }, [auctions, search, category, sort]);

  const hasActiveFilters = search || category || sort !== 'closing-soon';

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 animate-fadeIn">
      
      {/* ── Title Banner ── */}
      <div className="bento-card p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-400 mb-2">
              <Sparkles size={12} /> Aste live
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight uppercase tracking-tight">
              Tutte le <span className="text-gradient-orange">Aste</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Fai la tua offerta e aggiudicati set rari e vintage prima della scadenza del timer!
            </p>
          </div>
          <div className="bg-white/5 border border-white/5 px-4 py-2.5 rounded-2xl flex items-center gap-3 shrink-0">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Aste attive</span>
            <span className="text-amber-400 font-mono font-black text-lg">
              {loading ? '...' : auctions.length}
            </span>
          </div>
        </div>
      </div>

      {/* ── Filter Controls (Bento Panel) ── */}
      <div className="bento-card p-4 md:p-6 mb-8 border-white/5">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          
          {/* Text Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per titolo, tema o numero set nelle aste..."
              className="w-full pl-11 pr-10 py-3 text-sm rounded-xl border border-white/10 bg-[#0d1224]/50 text-white outline-none focus:border-sky-500 transition-all backdrop-blur-md font-medium placeholder:text-slate-500"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Dropdown Filters and actions */}
          <div className="flex flex-wrap md:flex-nowrap gap-3 items-center">
            
            {/* Category Dropdown */}
            <div className="flex items-center gap-2 bg-[#0d1224]/50 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-sky-500 transition-all flex-1 md:flex-initial">
              <SlidersHorizontal size={14} className="text-slate-500 shrink-0" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="bg-transparent text-sm text-slate-300 outline-none pr-6 cursor-pointer font-semibold py-1 w-full md:w-36 uppercase tracking-wider"
              >
                <option value="" className="bg-[#0f172a] text-slate-300">Tutte le Categorie</option>
                <option value="sets" className="bg-[#0f172a] text-slate-300">Sets</option>
                <option value="mocs" className="bg-[#0f172a] text-slate-300">MOCs</option>
                <option value="minifigures" className="bg-[#0f172a] text-slate-300">Minifigures</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 bg-[#0d1224]/50 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-sky-500 transition-all flex-1 md:flex-initial">
              <ArrowUpDown size={14} className="text-slate-500 shrink-0" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-transparent text-sm text-slate-300 outline-none pr-6 cursor-pointer font-semibold py-1 w-full md:w-44 uppercase tracking-wider"
              >
                <option value="closing-soon" className="bg-[#0f172a] text-slate-300">In scadenza</option>
                <option value="recent" className="bg-[#0f172a] text-slate-300">Più recenti</option>
              </select>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2.5 rounded-xl border border-dashed border-rose-500/30 text-rose-400 hover:bg-rose-500/10 active-shrink text-xs font-black uppercase tracking-wider transition-all duration-300 shrink-0 w-full md:w-auto"
              >
                Reset filtri
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content area ── */}
      {error && (
        <div className="bento-card border-rose-500/20 bg-rose-500/5 p-6 text-center max-w-xl mx-auto my-12">
          <AlertCircle className="mx-auto text-rose-500 mb-3" size={32} />
          <h3 className="text-lg font-bold text-white mb-1">Si è verificato un errore</h3>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-rose-500 text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider hover:bg-rose-400 active-shrink transition-colors"
          >
            Riprova
          </button>
        </div>
      )}

      {!error && (
        <>
          {loading ? (
            /* Loading Grid Skeletons */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredAuctions.length === 0 ? (
            /* Empty State Bento-style */
            <div className="bento-card p-12 text-center max-w-xl mx-auto border-dashed border-white/10 bg-white/2">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-500 mx-auto mb-4 border border-white/5 shadow-inner">
                <Hourglass size={28} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Nessuna asta attiva trovata</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Nessuna asta corrisponde ai criteri di ricerca e ai filtri correnti. Prova a modificarli o a resettarli per visualizzare le aste attive.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-widest active-shrink transition-all duration-300"
                style={{ boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)' }}
              >
                Ripristina Filtri
              </button>
            </div>
          ) : (
            /* Bento Grid of listings */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 items-stretch">
              {filteredAuctions.map((auction) => (
                <div key={auction.id} className="w-full">
                  <ListingCard l={auction} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

    </div>
  );
}
