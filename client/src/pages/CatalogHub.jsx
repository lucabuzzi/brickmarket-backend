import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Database, Lock } from 'lucide-react';
import { CATALOG_GAMES } from '../config/catalogGames';

const GLOW_STYLES = {
  blue: 'hover:border-gold-500/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]',
  purple: 'hover:border-gold-500/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]',
  amber: 'hover:border-gold-500/50 hover:shadow-[0_0_30px_rgba(191,154,46,0.15)]',
  emerald: 'hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
  rose: 'hover:border-rose-500/50 hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]',
};

function CatalogPickerDropdown() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-5 py-2 bg-white/5 border border-white/10 rounded-full text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-colors"
      >
        {t('hubs.catalog.cta')}
        <ChevronDown size={16} className={`text-gold-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="mt-3 w-full max-w-md mx-auto bg-[#120f0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2 text-left grid grid-cols-1 sm:grid-cols-2"
        >
          {CATALOG_GAMES.map((game) => {
            const isActive = game.status === 'active';
            return (
              <button
                key={game.slug}
                type="button"
                role="option"
                aria-selected="false"
                disabled={!isActive}
                onClick={() => {
                  setOpen(false);
                  navigate(`/catalog/${game.slug}`);
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-left text-sm font-bold text-white hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="text-xl leading-none">{game.emoji}</span>
                <span className="uppercase tracking-tight">{game.name}</span>
                {!isActive && (
                  <span className="ml-auto shrink-0 text-[8px] font-black uppercase tracking-widest text-stone-500">
                    {t('hubs.catalog.coming_soon')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CatalogHub() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = 'Catalogo - Scegli il tuo gioco | CardBrix';
  }, []);

  return (
    <div className="page catalog-hub max-w-[1400px] mx-auto px-4 py-12 animate-fadeIn">
      {/* HERO */}
      <section className="relative mb-16 py-20 px-8 bg-[#050402] rounded-[48px] border border-white/5 shadow-2xl overflow-hidden text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.08),transparent_50%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500/10 border border-gold-500/20 rounded-full text-gold-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8"
          >
            <Database size={14} /> {t('hubs.catalog.eyebrow')}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-white mb-6 uppercase tracking-tighter leading-[0.9] italic"
          >
            {t('hubs.catalog.title_pre')} <span className="text-gold-500">CardBrix</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-stone-500 text-base md:text-lg mb-10 max-w-xl mx-auto font-medium"
          >
            {t('hubs.catalog.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <CatalogPickerDropdown />
          </motion.div>
        </div>
      </section>

      {/* GAME GRID */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {CATALOG_GAMES.map((game, idx) => {
          const isActive = game.status === 'active';

          return (
            <motion.div
              key={game.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link
                to={`/catalog/${game.slug}`}
                className={`group relative flex flex-col items-center justify-center text-center gap-3 aspect-square p-6 bg-[#120f0a] border border-white/5 rounded-[32px] transition-all duration-300 ${GLOW_STYLES[game.accent] || GLOW_STYLES.blue}`}
              >
                {!isActive && (
                  <span className="absolute top-4 right-4 inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-stone-500 bg-black/40 border border-white/5 rounded-full px-2 py-1">
                    <Lock size={9} /> {t('hubs.catalog.coming_soon')}
                  </span>
                )}
                <span className="text-5xl mb-1 group-hover:scale-110 transition-transform duration-300">{game.emoji}</span>
                <span className="text-sm font-black text-white uppercase tracking-tight leading-tight">{game.name}</span>
                {isActive && game.taglineKey && (
                  <span className="text-[10px] text-stone-500 font-medium leading-snug px-2 hidden md:block">{t(game.taglineKey)}</span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </section>
    </div>
  );
}
