import { useState, useEffect } from 'react';
import { useSearchParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import { Search, Loader2, ArrowLeft, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import { StitchCard, StitchPageTransition, StitchBackground } from '../components/StitchComponents';
import { getCatalogGame } from '../config/catalogGames';

export default function TcgSearchResults({ gameSlug }) {
  const { t } = useTranslation();
  const game = getCatalogGame(gameSlug);
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!game || !query) return;

    document.title = `${query} - ${game.name} | CardBrix`;

    const fetchResults = async () => {
      setLoading(true);
      try {
        const data = await apiFetch(`${game.apiBase}/search?q=${encodeURIComponent(query)}&limit=50`);
        setResults(data);
        setError(null);
      } catch (err) {
        console.error('Search results fetch error:', err);
        setError(t('tcg.search_error'));
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query, game, t]);

  if (!game || game.status !== 'active') {
    return <Navigate to="/catalog" replace />;
  }

  return (
    <StitchPageTransition>
      <StitchBackground />
      <div className="page max-w-[1400px] mx-auto px-6 py-12 min-h-screen">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
          <div>
            <Link to={`/catalog/${game.slug}`} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-stone-500 hover:text-gold-400 transition-colors mb-4">
              <ArrowLeft size={14} /> {t('tcg.back_to_catalog_game', { name: game.name })}
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[20px] bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-400 shadow-xl shadow-gold-900/20">
                <Search size={32} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic">{t('tcg.results_title_pre')} <span className="text-gold-500">{t('tcg.results_title_accent')}</span></h1>
                <p className="text-stone-500 font-bold uppercase tracking-widest text-xs mt-1">
                  {t('tcg.query_label')} <span className="text-stone-300">"{query}"</span> • {t('tcg.found_label')} <span className="text-gold-400">{t('tcg.cards_count', { count: results.length })}</span>
                </p>
              </div>
            </div>
          </div>

          <Link to={`/catalog/${game.slug}`} className="px-8 py-4 bg-[#120f0a] border border-white/5 rounded-2xl text-white text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all shadow-xl flex items-center gap-3">
            {t('tcg.new_search')} <Hash size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <Loader2 size={64} className="text-gold-500 animate-spin mb-6" />
            <p className="text-stone-500 font-black uppercase tracking-[0.4em] animate-pulse">{t('tcg.searching')}</p>
          </div>
        ) : error ? (
          <div className="p-12 bg-rose-500/10 border border-rose-500/20 rounded-[32px] text-center">
            <p className="text-rose-400 font-black uppercase tracking-widest">{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="p-24 text-center bg-[#120f0a] rounded-[48px] border border-white/5 shadow-2xl">
            <div className="text-stone-700 font-black text-6xl mb-6 uppercase tracking-tighter opacity-20 italic">{t('tcg.no_data_title')}</div>
            <p className="text-stone-500 max-w-md mx-auto mb-12 font-medium">{t('tcg.no_data_desc')}</p>
            <Link to={`/catalog/${game.slug}`} className="btn bg-gold-600 hover:bg-gold-500 text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest">{t('tcg.new_search')}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {results.map((card, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={card.external_id}
              >
                <Link to={`/catalog/${game.slug}/${card.external_id}`} className="group block h-full">
                  <StitchCard className="h-full flex flex-col p-8" glowColor="blue">
                    <div className="aspect-square bg-stone-900/50 rounded-[32px] p-6 mb-8 flex items-center justify-center relative overflow-hidden group-hover:bg-stone-900 transition-colors">
                      <div className="absolute inset-0 bg-gradient-to-t from-gold-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <img
                        src={card.img_url}
                        alt={card.name}
                        className="max-h-full w-auto object-contain drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>

                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-gold-500 uppercase tracking-[0.2em]">{card.set_code || game.name}</span>
                        {card.rarity && (
                          <div className="px-2 py-0.5 bg-stone-800 rounded text-[9px] font-black text-stone-400 uppercase tracking-widest">
                            {card.rarity}
                          </div>
                        )}
                      </div>

                      <h3 className="text-xl font-black text-white uppercase italic leading-[0.9] tracking-tighter group-hover:text-gold-400 transition-colors mb-6 line-clamp-2">
                        {card.name}
                      </h3>
                    </div>
                  </StitchCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="mt-20 text-center">
            <div className="inline-flex items-center gap-6 px-8 py-3 bg-white/5 border border-white/10 rounded-full">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-stone-500 uppercase tracking-[0.2em]">{t('tcg.source_prefix', { source: game.source })}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </StitchPageTransition>
  );
}
