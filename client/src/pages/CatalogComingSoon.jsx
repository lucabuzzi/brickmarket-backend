import { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Clock, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCatalogGame } from '../config/catalogGames';

export default function CatalogComingSoon() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const game = getCatalogGame(slug);

  useEffect(() => {
    if (game) document.title = `${game.name} - Prossimamente | BrickMarket`;
  }, [game]);

  // Unknown slug or an already-active game landing here by mistake: bounce to the hub.
  if (!game || game.status === 'active') {
    return <Navigate to="/catalog" replace />;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-24 text-center animate-fadeIn">
      <div className="text-7xl mb-6">{game.emoji}</div>
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-stone-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6">
        <Clock size={14} /> {t('catalog.coming_soon_badge')}
      </div>
      <h1 className="text-3xl md:text-4xl font-black text-white mb-4 uppercase tracking-tight">{game.name}</h1>
      <p className="text-stone-500 mb-10 max-w-md mx-auto">
        {t('catalog.coming_soon_desc')}
      </p>
      <Link
        to="/catalog"
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#120f0a] border border-white/10 rounded-2xl text-white text-xs font-black uppercase tracking-widest hover:bg-white/5 transition-all"
      >
        <ArrowLeft size={16} /> {t('catalog.back_to_catalog')}
      </Link>
    </div>
  );
}
