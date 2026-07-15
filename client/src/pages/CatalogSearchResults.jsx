import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { Search, Loader2, ArrowLeft, Package, Clock, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import { StitchCard, StitchPageTransition, StitchBackground } from '../components/StitchComponents';

export default function CatalogSearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query) return;
    
    document.title = `Search: ${query} | Knowledge Vault`;
    
    const fetchResults = async () => {
      setLoading(true);
      try {
        // Request up to 50 results for the full search page
        const data = await apiFetch(`/api/catalog/search?q=${encodeURIComponent(query)}&limit=50`);
        setResults(data);
      } catch (err) {
        console.error('Search results fetch error:', err);
        setError('Failed to query the master database.');
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query]);

  return (
    <StitchPageTransition>
      <StitchBackground />
      <div className="page max-w-[1400px] mx-auto px-6 py-12 min-h-screen">
        
        {/* HEADER / BREADCRUMBS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
          <div>
            <Link to="/catalog" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 hover:text-sky-400 transition-colors mb-4">
              <ArrowLeft size={14} /> Back to Vault
            </Link>
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 rounded-[20px] bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-xl shadow-sky-900/20">
                 <Search size={32} strokeWidth={2.5} />
               </div>
               <div>
                  <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic">Deep Scan <span className="text-sky-500">Results</span></h1>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">
                    Database Query: <span className="text-slate-300">"{query}"</span> • Found: <span className="text-sky-400">{results.length} Matches</span>
                  </p>
               </div>
            </div>
          </div>

          <Link to="/catalog" className="px-8 py-4 bg-[#0f172a] border border-white/5 rounded-2xl text-white text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all shadow-xl flex items-center gap-3">
             New Query <Hash size={16} />
          </Link>
        </div>

        {/* RESULTS GRID */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Loader2 size={64} className="text-sky-500 animate-spin mb-6" />
            <p className="text-slate-500 font-black uppercase tracking-[0.4em] animate-pulse">Accessing Encrypted Archives...</p>
          </div>
        ) : error ? (
          <div className="p-12 bg-rose-500/10 border border-rose-500/20 rounded-[32px] text-center">
            <p className="text-rose-400 font-black uppercase tracking-widest">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="p-24 text-center bg-[#0f172a] rounded-[48px] border border-white/5 shadow-2xl">
             <div className="text-slate-700 font-black text-6xl mb-6 uppercase tracking-tighter opacity-20 italic">No Data Found</div>
             <p className="text-slate-500 max-w-md mx-auto mb-12 font-medium">The requested query yielded no results in the Master Archive. Check for typos or try searching by set number.</p>
             <Link to="/catalog" className="btn bg-sky-600 hover:bg-sky-500 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest">Restart Search</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {results.map((set, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={set.set_num}
              >
                <Link to={`/catalog/${set.set_num}`} className="group block h-full">
                  <StitchCard className="h-full flex flex-col p-8" glowColor="blue">
                    <div className="aspect-square bg-slate-900/50 rounded-[32px] p-6 mb-8 flex items-center justify-center relative overflow-hidden group-hover:bg-slate-900 transition-colors">
                      <div className="absolute inset-0 bg-gradient-to-t from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <img 
                        src={set.img_url} 
                        alt={set.name} 
                        className="max-h-full w-auto object-contain drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-700" 
                      />
                    </div>
                    
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em]">{set.set_num}</span>
                        <div className="px-2 py-0.5 bg-slate-800 rounded text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          {set.year}
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-black text-white uppercase italic leading-[0.9] tracking-tighter group-hover:text-sky-400 transition-colors mb-6 line-clamp-2">
                        {set.name}
                      </h3>
                      
                      <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-2 text-slate-500">
                           <Package size={14} />
                           <span className="text-[10px] font-black uppercase tracking-widest">{set.num_parts} Parts</span>
                         </div>
                         <div className="text-sky-400 group-hover:translate-x-2 transition-transform">
                           <ArrowRight size={20} />
                         </div>
                      </div>
                    </div>
                  </StitchCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
        
        {/* FOOTER STATS */}
        {!loading && results.length > 0 && (
          <div className="mt-20 text-center">
            <div className="inline-flex items-center gap-6 px-8 py-3 bg-white/5 border border-white/10 rounded-full">
               <div className="flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Source: Master Archive</span>
               </div>
               <div className="w-px h-3 bg-white/10" />
               <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Scan Engine: Gemini-3-Flash</span>
            </div>
          </div>
        )}
      </div>
    </StitchPageTransition>
  );
}
