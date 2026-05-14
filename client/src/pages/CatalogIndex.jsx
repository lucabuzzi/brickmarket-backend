import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { Search, BookOpen, Clock, TrendingUp, Package, ArrowRight } from 'lucide-react';

export default function CatalogIndex() {
  const navigate = useNavigate();
  const [recentSets, setRecentSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    document.title = "Catalogo LEGO - Archivio Prezzi e Rarità | BrickMarket";
    
    // Set static meta description for the index
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', 'Esplora il catalogo completo dei set LEGO. Consulta i prezzi di mercato, il numero di pezzi e l\'anno di uscita di migliaia di set.');

    const fetchRecent = async () => {
      try {
        const data = await apiFetch('/api/catalog/recent');
        setRecentSets(data);
      } catch (err) {
        console.error('Error fetching recent sets:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecent();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // Redirect to the dynamic catalog page directly if it looks like a set number
    if (/^\d{4,7}(-\d+)?$/.test(searchQuery.trim())) {
      navigate(`/catalog/${searchQuery.trim()}`);
    } else {
      // Otherwise use the general search
      navigate(`/search-results?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="page catalog-index max-w-[1200px] mx-auto px-4 py-12 animate-fadeIn">
      
      {/* Hero / Search Section */}
      <section className="text-center mb-16 py-12 bg-[#0f172a] rounded-[40px] border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-50" />
        <div className="relative z-10 max-w-2xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-full text-sky-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            <BookOpen size={14} /> Knowledge Vault
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6 uppercase tracking-tight leading-none">
            Esplora il Catalogo <span className="text-sky-500">LEGO</span>
          </h1>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            L'archivio definitivo per collezionisti. Cerca set per numero o nome per scoprire valori di mercato, rarità e specifiche tecniche.
          </p>

          <form onSubmit={handleSearch} className="relative max-w-lg mx-auto group">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Inserisci numero set (es. 10281) o nome..."
              className="w-full h-16 pl-14 pr-6 bg-slate-900 border-2 border-slate-800 rounded-2xl text-white outline-none focus:border-sky-500 transition-all shadow-lg group-hover:border-slate-700"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-500 transition-colors" size={24} />
            <button type="submit" className="absolute right-3 top-3 bottom-3 px-6 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase rounded-xl transition-all shadow-lg shadow-sky-900/20 active:scale-95">
              Cerca
            </button>
          </form>
        </div>
      </section>

      {/* Recent Additions Grid */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Aggiunti di Recente</h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Ultimi set indicizzati nel vault</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-slate-900 rounded-3xl animate-pulse border border-slate-800" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {recentSets.map((set) => (
              <Link 
                key={set.set_num} 
                to={`/catalog/${set.set_num}`}
                className="group bg-[#0f172a] border border-slate-800 rounded-3xl overflow-hidden hover:border-sky-500/50 hover:scale-[1.02] transition-all duration-300 shadow-xl"
              >
                <div className="aspect-square p-6 flex items-center justify-center relative overflow-hidden bg-slate-900/50">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <img 
                    src={set.img_url} 
                    alt={set.name} 
                    className="max-h-full w-auto object-contain drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500" 
                  />
                </div>
                <div className="p-5">
                  <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest block mb-1">{set.set_num}</span>
                  <h3 className="text-white font-black text-sm uppercase line-clamp-1 mb-4 group-hover:text-sky-400 transition-colors">{set.name}</h3>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>{set.year}</span>
                    <span className="flex items-center gap-1 group-hover:text-white transition-colors">
                      Scheda <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Bottom CTA */}
      <section className="mt-20 p-10 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[40px] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 max-w-xl">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight mb-4 leading-none">Hai dei set da vendere?</h2>
          <p className="text-indigo-100 font-medium leading-relaxed">
            Usa il nostro catalogo per scoprire il valore reale del tuo set e pubblicalo sul marketplace in pochi secondi.
          </p>
        </div>
        <Link 
          to="/sell" 
          className="relative z-10 px-8 py-4 bg-white text-indigo-600 font-black text-sm uppercase rounded-2xl shadow-xl hover:bg-slate-100 transition-all active:scale-95 whitespace-nowrap"
        >
          Vendi Ora
        </Link>
      </section>

    </div>
  );
}
