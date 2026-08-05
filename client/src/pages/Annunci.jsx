import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import ListingCard from '../components/ListingCard';
import { Search, X, SlidersHorizontal, ArrowUpDown, Tag, AlertCircle, Sparkles, ArrowLeft } from 'lucide-react';
import { ANNUNCI_TOP_CATEGORIES, getAnnunciCardGame } from '../config/annunciCategories';

function SkeletonCard() {
  return (
    <div className="w-full rounded-2xl border border-white/5 bg-[#14120b]/40 p-4 shadow-sm animate-pulse">
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

export default function Annunci({ productType = 'lego', game = null }) {
  const { t } = useTranslation();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('recent');

  const topCategory = ANNUNCI_TOP_CATEGORIES.find(c =>
    productType === 'tcg' ? c.slug === 'carte-collezionabili' : c.slug === productType
  );
  const gameInfo = productType === 'tcg' ? getAnnunciCardGame(game) : null;
  const pageTitle = gameInfo ? gameInfo.name : (topCategory?.name || t('annunci.default_title'));
  const backTo = productType === 'tcg' ? '/annunci/carte-collezionabili' : '/annunci';

  useEffect(() => {
    document.title = `Annunci ${pageTitle} | BrickMarket`;
    let cancelled = false;

    const fetchListings = async () => {
      try {
        setLoading(true);
        setError('');
        setCategory('');
        setSearch('');
        let url = `/listings?is_auction=false&product_type=${productType}`;
        if (productType === 'tcg' && game) url += `&game=${game}`;
        const data = await apiFetch(url);
        if (!cancelled) {
          setListings(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || t('errors.unable_to_load_listings'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchListings();
    return () => {
      cancelled = true;
    };
  }, [productType, game, t]);

  const handleResetFilters = () => {
    setSearch('');
    setCategory('');
    setSort('recent');
  };

  // Instant local filtering and sorting for maximum responsiveness
  const filteredListings = useMemo(() => {
    let result = [...listings];

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
    if (sort === 'recent') {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sort === 'price-asc') {
      result.sort((a, b) => parseFloat(a.price || 0) - parseFloat(b.price || 0));
    } else if (sort === 'price-desc') {
      result.sort((a, b) => parseFloat(b.price || 0) - parseFloat(a.price || 0));
    }

    return result;
  }, [listings, search, category, sort]);

  const hasActiveFilters = search || category || sort !== 'recent';

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 animate-fadeIn">

      <Link to={backTo} className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-xs font-bold uppercase tracking-wider mb-4 transition-colors">
        <ArrowLeft size={14} /> {productType === 'tcg' ? t('hubs.categories.carte_name') : t('annunci.back_categories')}
      </Link>

      {/* ── Title Banner ── */}
      <div className="bento-card p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/20 bg-gold-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gold-400 mb-2">
              <Sparkles size={12} /> {t('annunci.badge_fixed_price')}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight uppercase tracking-tight">
              {t('annunci.title_prefix')} <span className="text-gradient-sky">{pageTitle}</span>
            </h1>
            <p className="text-stone-400 text-sm mt-1 max-w-xl">
              {t('annunci.subtitle', { title: pageTitle })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3 shrink-0">
            <div className="bg-white/5 border border-white/5 px-4 py-2.5 rounded-2xl flex items-center gap-3">
              <span className="text-stone-400 text-xs font-semibold uppercase tracking-wider">{t('annunci.active_count_label')}</span>
              <span className="text-gold-400 font-mono font-black text-lg">
                {loading ? '...' : listings.length}
              </span>
            </div>
            <Link
              to="/sell"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 active:scale-95 text-stone-400 text-xs font-semibold uppercase tracking-wider transition-all duration-200"
            >
              {t('home.cta_banner_button')}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Filter Controls (Bento Panel) ── */}
      <div className="bento-card p-4 md:p-6 mb-8 border-white/5">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          
          {/* Text Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('annunci.search_placeholder')}
              className="w-full pl-11 pr-10 py-3 text-sm rounded-xl border border-white/10 bg-[#14120b]/50 text-white outline-none focus:border-gold-500 transition-all backdrop-blur-md font-medium placeholder:text-stone-500"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Dropdown Filters and actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-nowrap gap-2 md:gap-3 items-center">

            {/* Category Dropdown (solo LEGO: sets/MOCs/minifigures) */}
            {productType === 'lego' && (
              <div className="flex items-center gap-2 bg-[#14120b]/50 border border-white/10 rounded-xl px-2.5 md:px-3 py-1.5 focus-within:border-gold-500 transition-all min-w-0 md:flex-initial">
                <SlidersHorizontal size={14} className="text-stone-500 shrink-0" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-transparent text-xs md:text-sm text-stone-300 outline-none pr-4 md:pr-6 cursor-pointer font-semibold py-1 w-full md:w-36 uppercase tracking-wider min-w-0 truncate"
                >
                  <option value="" className="bg-[#120f0a] text-stone-300">{t('annunci.all_categories')}</option>
                  <option value="sets" className="bg-[#120f0a] text-stone-300">{t('annunci.category_sets')}</option>
                  <option value="mocs" className="bg-[#120f0a] text-stone-300">{t('annunci.category_mocs')}</option>
                  <option value="minifigures" className="bg-[#120f0a] text-stone-300">{t('annunci.category_minifigures')}</option>
                </select>
              </div>
            )}

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 bg-[#14120b]/50 border border-white/10 rounded-xl px-2.5 md:px-3 py-1.5 focus-within:border-gold-500 transition-all min-w-0 md:flex-initial">
              <ArrowUpDown size={14} className="text-stone-500 shrink-0" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="bg-transparent text-xs md:text-sm text-stone-300 outline-none pr-4 md:pr-6 cursor-pointer font-semibold py-1 w-full md:w-44 uppercase tracking-wider min-w-0 truncate"
              >
                <option value="recent" className="bg-[#120f0a] text-stone-300">{t('home.most_recent')}</option>
                <option value="price-asc" className="bg-[#120f0a] text-stone-300">{t('annunci.sort_price_asc')}</option>
                <option value="price-desc" className="bg-[#120f0a] text-stone-300">{t('annunci.sort_price_desc')}</option>
              </select>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="sm:col-span-2 md:col-span-1 px-4 py-2.5 rounded-xl border border-dashed border-rose-500/30 text-rose-400 hover:bg-rose-500/10 active-shrink text-xs font-black uppercase tracking-wider transition-all duration-300 shrink-0 w-full md:w-auto"
              >
                {t('annunci.reset_filters')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content area ── */}
      {error && (
        <div className="bento-card border-rose-500/20 bg-rose-500/5 p-6 text-center max-w-xl mx-auto my-12">
          <AlertCircle className="mx-auto text-rose-500 mb-3" size={32} />
          <h3 className="text-lg font-bold text-white mb-1">{t('errors.generic')}</h3>
          <p className="text-stone-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-rose-500 text-stone-950 font-bold rounded-lg text-xs uppercase tracking-wider hover:bg-rose-400 active-shrink transition-colors"
          >
            {t('annunci.retry_button')}
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
          ) : filteredListings.length === 0 ? (
            /* Empty State Bento-style */
            <div className="bento-card p-12 text-center max-w-xl mx-auto border-dashed border-white/10 bg-white/2">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-stone-500 mx-auto mb-4 border border-white/5 shadow-inner">
                <Tag size={28} className="text-stone-400" />
              </div>
              <h3 className="text-xl font-bold text-stone-100 mb-2">{t('annunci.no_results_title')}</h3>
              <p className="text-stone-400 text-sm leading-relaxed mb-6">
                {t('annunci.no_results_desc')}
              </p>
              <button
                onClick={handleResetFilters}
                className="px-5 py-2.5 bg-gold-500 hover:bg-gold-400 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover-glow-accent active-shrink transition-all duration-300"
              >
                {t('annunci.restore_filters')}
              </button>
            </div>
          ) : (
            /* Bento Grid of listings */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 items-stretch">
              {filteredListings.map((listing) => (
                <div key={listing.id} className="w-full">
                  <ListingCard l={listing} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

    </div>
  );
}
