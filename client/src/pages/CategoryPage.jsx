import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import Sidebar, { CATEGORIES, THEMES } from '../components/Sidebar';
import ListingCard from '../components/ListingCard';

export default function CategoryPage() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const category = CATEGORIES.find(c => c.slug === slug);
  const categoryName = category ? category.name : slug;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await apiFetch(`/api/listings?category=${slug}&limit=20`);
        if (!cancelled) {
          setListings(Array.isArray(data) ? data : []);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(t('errors.unable_to_load_listings'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, t]);

  return (
    <div className="page pb-16">
      
      {/* Mobile Icon Bar (Stories Style) - Reused from Home logic */}
      <div className="md:hidden flex overflow-x-auto gap-4 pb-4 mb-8 no-scrollbar scroll-smooth px-2">
        {[...CATEGORIES, ...THEMES].map((item, idx) => {
           const isActive = item.slug === slug;
           return (
            <Link
              key={idx}
              to={item.slug ? `/category/${item.slug}` : `/search-results?q=${encodeURIComponent(item.name)}`}
              className="flex flex-col items-center gap-2 min-w-[60px] flex-shrink-0 group no-underline"
            >
              <div className={`w-8 h-8 rounded-full p-0.5 border-2 group-active:scale-95 transition-transform shrink-0 ${isActive ? 'border-gold-400' : 'border-[#d4af37]'}`}>
                <img 
                  src={item.img} 
                  alt={item.name} 
                  className="w-full h-full rounded-full object-cover transition-all" 
                />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-tighter whitespace-nowrap ${isActive ? 'text-gold-400' : 'text-stone-300'}`}>{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
        <Sidebar />

        <main className="flex-1 min-w-0">
          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
              {slug === 'sets' ? t('catalog.category_title_sets') :
               slug === 'mocs' ? t('catalog.category_title_mocs') :
               slug === 'minifigures' ? t('catalog.category_title_minifigures') : t('catalog.category_title_generic', { name: categoryName })}
            </h1>
            <p className="text-stone-400 max-w-2xl">
              {t('catalog.category_subtitle', { name: categoryName })}
            </p>
          </header>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-[#14110c] border border-[#2a2416] rounded-xl aspect-[3/4] animate-pulse" />
              ))}
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {listings.map(l => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>
          ) : (
            <div className="bg-[#14110c] border border-[#2a2416] rounded-xl p-12 text-center flex flex-col items-center gap-6">
              <div className="text-5xl">📦</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{t('catalog.category_empty_title')}</h3>
                <p className="text-stone-400">{t('catalog.category_empty_desc')}</p>
              </div>
              <Link to="/sell" className="bg-gold-500 hover:bg-gold-600 text-white font-black px-8 py-3 rounded-lg transition-colors">
                {t('home.sell_now')}
              </Link>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
