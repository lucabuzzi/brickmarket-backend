import { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import { ArrowRight, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { getCatalogGame } from '../config/catalogGames';

export default function TcgCardPage({ gameSlug }) {
  const { t } = useTranslation();
  const game = getCatalogGame(gameSlug);
  const { cardId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!game) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`${game.apiBase}/${cardId}`);
        setData(res);
        document.title = `${res.name} - ${game.name} | BrickMarket`;
      } catch (err) {
        setError(t('tcg.card_load_error'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [cardId, game, t]);

  if (!game || game.status !== 'active') {
    return <Navigate to="/catalog" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold-500 mr-3" />
        {t('catalog.loading')}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">{t('tcg.card_not_found_title')}</h1>
        <p className="text-stone-400 mb-8">{error || t('tcg.card_not_found_fallback')}</p>
        <Link to={`/catalog/${game.slug}`} className="btn btn--primary">{t('catalog.back_to_catalog')}</Link>
      </div>
    );
  }

  const details = data.details || {};
  const formatDetailValue = (value) => (Array.isArray(value) ? value.join(', ') : value);
  const fields = (game.detailFields || []).filter((f) => {
    const value = details[f.key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  });
  const inlineFields = fields.filter((f) => !f.full);
  const fullFields = fields.filter((f) => f.full);

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto animate-fadeIn">
      <Link to={`/catalog/${game.slug}`} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-stone-500 hover:text-gold-400 transition-colors mb-8 w-fit">
        <ArrowLeft size={14} /> {t('tcg.back_to_catalog_game', { name: game.name })}
      </Link>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        <div className="lg:col-span-5 bg-[#120f0a] rounded-3xl border border-stone-800 p-8 flex items-center justify-center relative overflow-hidden group shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/5 to-transparent opacity-50" />
          <img
            src={data.img_url}
            alt={data.name}
            className="relative z-10 max-h-[500px] w-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform transition-transform group-hover:scale-105 duration-700"
          />
        </div>

        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-[#120f0a] rounded-3xl border border-stone-800 p-8 shadow-xl flex-1 flex flex-col justify-center">
            <span className="text-gold-400 font-black tracking-widest text-xs uppercase mb-2 block">{game.name} Catalog Reference</span>
            <h1 className="text-4xl font-black text-white leading-none tracking-tight mb-4 uppercase">{data.name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              {data.set_name && (
                <span className="px-3 py-1 bg-stone-800 rounded-full text-xs font-bold text-stone-400 uppercase tracking-widest">{data.set_name}</span>
              )}
              {data.set_code && (
                <span className="font-mono text-stone-500 font-bold uppercase">{data.set_code}</span>
              )}
              {data.rarity && (
                <span className="px-3 py-1 bg-gold-500/10 border border-gold-500/20 rounded-full text-xs font-bold text-gold-400 uppercase tracking-widest">{data.rarity}</span>
              )}
            </div>

            {inlineFields.length > 0 && (
              <div className="grid grid-cols-2 gap-y-6 mt-8 pt-6 border-t border-stone-800">
                {inlineFields.map((f) => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider">{f.label}</span>
                    <span className="text-lg font-black text-white">{f.prefix || ''}{formatDetailValue(details[f.key])}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gold-500 rounded-3xl p-8 shadow-xl shadow-gold-500/10 flex items-center justify-between group cursor-pointer overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="text-gold-950 font-black text-xl mb-1 uppercase">{t('tcg.sell_card_title')}</h3>
              <p className="text-gold-900 text-sm font-bold opacity-80">{t('tcg.sell_card_subtitle')}</p>
            </div>
            <Link
              to={`/sell?ref=${encodeURIComponent(data.name)}`}
              className="absolute inset-0 z-20"
            />
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-gold-600 shadow-lg transform transition-transform group-hover:translate-x-2">
              <ArrowRight size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Full-width text fields (card text, oracle text, effect) */}
      {fullFields.length > 0 && (
        <div className="grid grid-cols-1 gap-6 mb-8">
          {fullFields.map((f) => (
            <div key={f.key} className="bg-[#120f0a] rounded-3xl border border-stone-800 p-8 shadow-xl">
              <h3 className="text-stone-500 font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                <Sparkles size={14} /> {f.label}
              </h3>
              <p className="text-stone-300 leading-relaxed whitespace-pre-line">{formatDetailValue(details[f.key])}</p>
            </div>
          ))}
        </div>
      )}

      {/* Marketplace CTA */}
      <div className="bg-stone-900/50 rounded-3xl border-2 border-dashed border-stone-800 p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 group">
        <div>
          <h3 className="text-white font-black text-xl mb-2 leading-tight uppercase">{t('tcg.looking_for_card_title')}</h3>
          <p className="text-stone-400 text-sm leading-relaxed">
            {t('tcg.looking_for_card_desc', { name: data.name })}
          </p>
        </div>
        <Link
          to={`/search-results?q=${encodeURIComponent(data.name)}`}
          className="flex items-center justify-between gap-3 px-6 py-4 bg-stone-800 rounded-2xl text-white font-bold text-sm hover:bg-stone-700 transition-all group-hover:border-gold-500/50 border border-transparent shrink-0"
        >
          {t('tcg.view_active_listings')}
          <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <div className="mt-12 text-center text-[10px] text-stone-500 font-bold uppercase tracking-[0.2em] border-t border-stone-800 pt-8">
        {t('tcg.reference_data_credit', { source: game.source })}
      </div>
    </div>
  );
}
