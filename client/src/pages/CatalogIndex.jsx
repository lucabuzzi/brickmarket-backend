import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { Search, BookOpen, Clock, TrendingUp, Package, ArrowRight, Loader2, Zap, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CatalogIndex() {
  const navigate = useNavigate();
  const [recentSets, setRecentSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    document.title = "Knowledge Vault - BrickMarket Catalog Terminal";
    
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

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setIsDropdownOpen(true);
      try {
        // Fetch top 5 for the live dropdown
        const data = await apiFetch(`/api/catalog/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
        setSearchResults(data);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Faster debounce for terminal-like feel

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsDropdownOpen(false);
    navigate(`/catalog/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="page catalog-index max-w-[1400px] mx-auto px-4 py-12 animate-fadeIn">
      
      {/* KNOWLEDGE VAULT TERMINAL */}
      <section className="relative mb-24 py-20 px-8 bg-[#020617] rounded-[48px] border border-white/5 shadow-2xl">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.08),transparent_50%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500/10 border border-sky-500/20 rounded-full text-sky-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8"
          >
            <Database size={14} className="animate-pulse" /> Gemini 3 Flash Powered Terminal
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black text-white mb-8 uppercase tracking-tighter leading-[0.85] italic"
          >
            Knowledge <span className="text-sky-500">Vault</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 text-lg md:text-xl mb-12 max-w-2xl mx-auto font-medium"
          >
            Ultra-fast fuzzy search across the global LEGO archive. Query by set number or name in 4 languages.
          </motion.p>

          {/* ENLARGED SEARCH TERMINAL */}
          <div className="relative max-w-3xl mx-auto" ref={dropdownRef}>
            <form onSubmit={handleSearchSubmit} className="relative z-30 group">
              <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-[28px] blur opacity-20 group-focus-within:opacity-40 transition duration-500" />
              <div className="relative flex items-center bg-[#0f172a] border-2 border-white/5 rounded-[24px] overflow-hidden focus-within:border-sky-500/50 transition-all shadow-2xl">
                <div className="pl-8 flex items-center pointer-events-none">
                  {isSearching ? (
                    <Loader2 size={32} className="text-sky-500 animate-spin" />
                  ) : (
                    <Search className="text-slate-600 group-focus-within:text-sky-400 transition-colors" size={32} strokeWidth={2.5} />
                  )}
                </div>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Query Master Database..."
                  className="w-full h-20 md:h-24 pl-6 pr-40 bg-transparent text-white text-xl md:text-2xl font-bold outline-none placeholder:text-slate-700"
                />
                <div className="absolute right-4">
                  <button 
                    type="submit" 
                    className="h-12 md:h-16 px-8 md:px-12 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-sky-900/40 active:scale-95 flex items-center gap-3"
                  >
                    Search <Zap size={18} fill="currentColor" />
                  </button>
                </div>
              </div>
            </form>

            {/* DYNAMIC STITCH DROPDOWN */}
            <AnimatePresence>
              {isDropdownOpen && searchQuery.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  className="absolute top-full left-0 right-0 mt-4 bg-[#0f172a]/95 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-[0_40px_100px_rgba(0,0,0,0.9)] overflow-hidden z-[100]"
                >
                  <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {isSearching ? 'Accessing Global Archives...' : 'Live Suggestions'}
                    </span>
                    {!isSearching && <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">{searchResults.length} Match found</span>}
                  </div>
                  
                  <div className="max-h-[480px] overflow-y-auto">
                    {searchResults.length > 0 ? (
                      searchResults.map((set, idx) => (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          key={set.set_num}
                        >
                          <Link 
                            to={`/catalog/${set.set_num}`}
                            onClick={() => setIsDropdownOpen(false)}
                            className="flex items-center gap-6 p-5 hover:bg-sky-500/10 border-b border-white/5 last:border-0 transition-all group"
                          >
                            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex-shrink-0 flex items-center justify-center p-2 border border-white/5 group-hover:border-sky-500/30 transition-all">
                              <img src={set.img_url} alt="" className="max-h-full max-w-full object-contain drop-shadow-xl" />
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] mb-1">{set.set_num}</div>
                              <div className="text-lg font-black text-white truncate group-hover:text-sky-400 transition-colors uppercase italic">{set.name}</div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs font-bold text-slate-500">{set.year}</span>
                                <div className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="text-xs font-bold text-slate-500">{set.num_parts} Parts</span>
                              </div>
                            </div>
                            <ArrowRight className="text-slate-700 group-hover:text-sky-400 transform group-hover:translate-x-2 transition-all" size={24} />
                          </Link>
                        </motion.div>
                      ))
                    ) : (
                      <div className="p-12 text-center">
                        <div className="text-slate-600 font-bold mb-2 uppercase tracking-widest">Archive scan complete: 0 entries found</div>
                        <p className="text-[10px] text-slate-700 uppercase tracking-widest mb-4">Deep Ingestion Protocol active for new assets</p>
                        <button 
                          onClick={handleSearchSubmit}
                          className="text-sky-400 text-xs font-black uppercase tracking-widest hover:underline"
                        >
                          Manual Force Scan &gt;
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {searchResults.length > 0 && (
                    <Link 
                      to={`/catalog/search?q=${encodeURIComponent(searchQuery)}`}
                      onClick={() => setIsDropdownOpen(false)}
                      className="block p-5 bg-white/5 hover:bg-white/10 text-center text-[10px] font-black text-white uppercase tracking-[0.3em] transition-all"
                    >
                      View All Search Results
                    </Link>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* RECENT ADDITIONS GRID (MINIMIZED) */}
      <section>
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Clock size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Recent Indexing</h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Master Database Sync: Live</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square bg-slate-900 rounded-[32px] animate-pulse border border-white/5" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {recentSets.map((set) => (
              <Link 
                key={set.set_num} 
                to={`/catalog/${set.set_num}`}
                className="group relative bg-[#0f172a] border border-white/5 rounded-[32px] overflow-hidden hover:border-sky-500/50 hover:-translate-y-2 transition-all duration-500 shadow-2xl"
              >
                <div className="aspect-square p-6 flex items-center justify-center relative overflow-hidden bg-slate-900/40">
                  <img 
                    src={set.img_url} 
                    alt={set.name} 
                    className="max-h-full w-auto object-contain drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-700" 
                  />
                </div>
                <div className="p-6">
                  <span className="text-[9px] font-black text-sky-500 uppercase tracking-widest block mb-1">{set.set_num}</span>
                  <h3 className="text-white font-black text-xs uppercase truncate mb-1 group-hover:text-sky-400 transition-colors">{set.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
