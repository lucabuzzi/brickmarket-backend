import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { ANNUNCI_CARD_GAMES } from '../config/annunciCategories';

const GLOW_STYLES = {
  blue: 'hover:border-gold-500/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]',
  purple: 'hover:border-gold-500/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]',
  amber: 'hover:border-gold-500/50 hover:shadow-[0_0_30px_rgba(191,154,46,0.15)]',
  emerald: 'hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
  rose: 'hover:border-rose-500/50 hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]',
};

export default function AnnunciCardsHub() {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = 'Carte Collezionabili - Annunci | BrickMarket';
  }, []);

  return (
    <div className="page annunci-cards-hub max-w-[1400px] mx-auto px-4 py-12 animate-fadeIn">
      <Link to="/annunci" className="inline-flex items-center gap-2 text-stone-400 hover:text-white text-xs font-bold uppercase tracking-wider mb-8 transition-colors">
        <ArrowLeft size={14} /> {t('hubs.annunci_cards.back')}
      </Link>

      <section className="relative mb-12 py-14 px-8 bg-[#050402] rounded-[48px] border border-white/5 shadow-2xl overflow-hidden text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(212,175,55,0.08),transparent_50%)]" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 uppercase tracking-tighter leading-[0.9] italic">
            {t('hubs.annunci_cards.title_pre')} <span className="text-gold-500">{t('hubs.annunci_cards.title_accent')}</span>
          </h1>
          <p className="text-stone-500 text-base md:text-lg font-medium">
            {t('hubs.annunci_cards.subtitle')}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {ANNUNCI_CARD_GAMES.map((game, idx) => (
          <motion.div
            key={game.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Link
              to={`/annunci/carte-collezionabili/${game.slug}`}
              className={`group relative flex flex-col items-center justify-center text-center gap-3 aspect-square p-6 bg-[#120f0a] border border-white/5 rounded-[32px] transition-all duration-300 ${GLOW_STYLES[game.accent] || GLOW_STYLES.blue}`}
            >
              <span className="text-5xl mb-1 group-hover:scale-110 transition-transform duration-300">{game.emoji}</span>
              <span className="text-sm font-black text-white uppercase tracking-tight leading-tight">{game.name}</span>
            </Link>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
