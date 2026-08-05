import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Hourglass } from 'lucide-react';
import { ANNUNCI_TOP_CATEGORIES } from '../config/annunciCategories';

const GLOW_STYLES = {
  blue: 'hover:border-gold-500/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]',
  purple: 'hover:border-gold-500/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]',
  amber: 'hover:border-gold-500/50 hover:shadow-[0_0_30px_rgba(191,154,46,0.15)]',
  emerald: 'hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
  rose: 'hover:border-rose-500/50 hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]',
};

export default function AsteHub() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = 'Aste - Scegli la categoria | BrickMarket';
  }, []);

  return (
    <div className="page aste-hub max-w-[1400px] mx-auto px-4 py-12 animate-fadeIn">
      {/* HERO */}
      <section className="relative mb-16 py-20 px-8 bg-[#050402] rounded-[48px] border border-white/5 shadow-2xl overflow-hidden text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(191,154,46,0.08),transparent_50%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500/10 border border-gold-500/20 rounded-full text-gold-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8"
          >
            <Hourglass size={14} /> {t('hubs.aste.eyebrow')}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-white mb-6 uppercase tracking-tighter leading-[0.9] italic"
          >
            {t('hubs.aste.title_pre')} <span className="text-gold-500">BrickMarket</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-stone-500 text-base md:text-lg mb-10 max-w-xl mx-auto font-medium"
          >
            {t('hubs.aste.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 px-5 py-2 bg-white/5 border border-white/10 rounded-full text-white text-xs font-black uppercase tracking-[0.2em]"
          >
            {t('hubs.aste.cta')} <ChevronDown size={16} className="animate-bounce text-gold-400" />
          </motion.div>
        </div>
      </section>

      {/* CATEGORY GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {ANNUNCI_TOP_CATEGORIES.map((cat, idx) => (
          <motion.div
            key={cat.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Link
              to={`/aste/${cat.slug}`}
              className={`group relative flex flex-col items-center justify-center text-center gap-3 aspect-square p-6 bg-[#120f0a] border border-white/5 rounded-[32px] transition-all duration-300 ${GLOW_STYLES[cat.accent] || GLOW_STYLES.blue}`}
            >
              <span className="text-6xl mb-1 group-hover:scale-110 transition-transform duration-300">{cat.emoji}</span>
              <span className="text-lg font-black text-white uppercase tracking-tight leading-tight">{cat.nameKey ? t(cat.nameKey) : cat.name}</span>
              {cat.taglineKey && (
                <span className="text-xs text-stone-500 font-medium leading-snug px-2">{t(cat.taglineKey)}</span>
              )}
            </Link>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
