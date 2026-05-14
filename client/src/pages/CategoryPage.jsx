import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../api';
import Sidebar, { CATEGORIES, THEMES } from '../components/Sidebar';
import ListingCard from '../components/ListingCard';

export default function CategoryPage() {
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
        if (!cancelled) setError('Impossibile caricare i contenuti');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

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
              <div className={`w-8 h-8 rounded-full p-0.5 border-2 group-active:scale-95 transition-transform shrink-0 ${isActive ? 'border-sky-400' : 'border-[#38bdf8]'}`}>
                <img 
                  src={item.img} 
                  alt={item.name} 
                  className="w-full h-full rounded-full object-cover transition-all" 
                />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-tighter whitespace-nowrap ${isActive ? 'text-sky-400' : 'text-slate-300'}`}>{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
        <Sidebar />

        <main className="flex-1 min-w-0">
          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">
              {slug === 'sets' ? 'Esplora i Set LEGO®' : 
               slug === 'mocs' ? 'Catalogo MOCs' : 
               slug === 'minifigures' ? 'Minifigures Rare' : `Categoria: ${categoryName}`}
            </h1>
            <p className="text-slate-400 max-w-2xl">
              Sfoglia le migliori offerte della community per la categoria {categoryName}. 
              Trova pezzi rari, set iconici e creazioni uniche.
            </p>
          </header>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-[#111827] border border-[#1f2937] rounded-xl aspect-[3/4] animate-pulse" />
              ))}
            </div>
          ) : listings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {listings.map(l => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>
          ) : (
            <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-12 text-center flex flex-col items-center gap-6">
              <div className="text-5xl">📦</div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Nessun articolo trovato</h3>
                <p className="text-slate-400">Sii il primo a caricare un annuncio in questa categoria!</p>
              </div>
              <Link to="/sell" className="bg-sky-500 hover:bg-sky-600 text-slate-900 font-black px-8 py-3 rounded-lg transition-colors">
                Vendi ora
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
