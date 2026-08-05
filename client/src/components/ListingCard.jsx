import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { normalizeImageUrl } from '../api';
import { Star } from 'lucide-react';
import AuctionTimer from './AuctionTimer';
import SellerTypeBadge from './SellerTypeBadge';

function listingImage(l) {
  let url = '';
  if (Array.isArray(l.images) && l.images.length) url = l.images[0];
  else if (l.image_url) url = l.image_url;
  if (!url) return 'https://picsum.photos/seed/placeholder/800/600';
  return normalizeImageUrl(url);
}

function formatPrice(v, locale) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(locale || 'it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

function conditionClasses(c = '') {
  const lc = c.toLowerCase();
  if (lc === 'new' || lc === 'complete') return 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white';
  if (lc === 'good') return 'bg-gradient-to-r from-gold-500 to-gold-600 text-white';
  return 'bg-gradient-to-r from-stone-500 to-stone-600 text-stone-200';
}

function conditionLabel(c = '', t) {
  return t(`details.condition_${c.toLowerCase()}`, { defaultValue: c });
}

export default function ListingCard({ l, isFeatured = false, isCompact = false, isMini = false }) {
  const { t, i18n } = useTranslation();
  const setNumber = l.set_number || l.number || 'N/A';
  const condition = l.condition || 'used';
  const sellerName = l.seller_username || l.seller?.username || t('details.unknown_seller');

  // ── Seller badge data (from API or passed directly) ────────────────────────
  const sellerData = l.seller || {};
  const isPro       = l.seller_is_pro      ?? sellerData.is_pro       ?? false;
  const isVerified  = l.seller_is_verified ?? sellerData.is_verified  ?? false;
  const sellerType  = l.seller_seller_type ?? sellerData.seller_type  ?? null;
  const ratingAvg   = parseFloat(l.seller_rating_avg ?? sellerData.rating_avg  ?? 0);
  const salesCount  = parseInt(l.seller_sales_count  ?? sellerData.sales_count  ?? 0, 10);
  const ratingCount = parseInt(l.seller_rating_count ?? sellerData.rating_count ?? -1, 10);

  // LEGENDARY: inclusive thresholds (>= 4.8 AND >= 10 sales)
  const isLegendary = ratingAvg >= 4.8 && salesCount >= 10;
  // NEW USER: no feedback at all
  const isNewUser   = ratingCount === 0;

  const condClasses = conditionClasses(condition);

  // LOGICA DI STATO
  const isAuction = l.type === 'auction' || l.is_auction;
  const isActive = l.status === 'active';

  return (
    <article className="w-full h-full flex flex-col bg-[#14120b]/40 backdrop-blur-md rounded-2xl overflow-hidden border border-white/5 hover:border-gold-500/30 hover:shadow-[0_15px_30px_-10px_rgba(212,175,55,0.12)] transition-all duration-300 group/card">

      {/* Header: Mostra il Timer solo se l'asta è ATTIVA */}
      <div className={`flex justify-between items-center px-3 py-1.5 ${isFeatured ? 'bg-gold-600/10' : 'bg-white/2'}`}>
        {isAuction && isActive ? (
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-gold-500 to-gold-600 text-black px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-sm">
              {t('details.badge_auction')}
            </span>
            <AuctionTimer endDate={l.auction_end} />
          </div>
        ) : (
          /* Se l'asta è chiusa o è un annuncio normale, mantiene lo spazio pulito */
          <div className="h-[18px]" />
        )}

        {isFeatured && (
          <Star size={14} className="fill-gold-500 text-gold-500 ml-auto" />
        )}
      </div>

      {/* Immagine */}
      <Link to={`/product/${l.id}`} className="block w-full overflow-hidden">
        <img
          src={listingImage(l)}
          alt={l.title}
          loading="lazy"
          className="w-full aspect-[4/3] md:aspect-[3/2] object-cover group-hover/card:scale-105 transition-transform duration-500"
        />
      </Link>

      {/* Contenuto Card */}
      <div className="p-3.5 flex flex-col flex-1 gap-1">
        <div className="flex gap-1.5 items-center">
          {/* LOGICA BADGE: Gestione differenziata per aste scadute senza offerte vs vendute */}
          {(() => {
            if (l.status === 'sold') {
              return <span className="bg-gradient-to-r from-rose-500 to-red-600 text-white px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-md shadow-red-900/10">{t('details.badge_sold')}</span>;
            }
            if (l.status === 'ended' || l.status === 'closed' || l.status === 'expired') {
              if (isAuction && !(Number(l.bids_count) > 0 || Number(l.current_bid) > Number(l.auction_start))) {
                return <span className="bg-gradient-to-r from-stone-600 to-stone-700 text-stone-200 px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-sm">{t('details.badge_expired')}</span>;
              }
              return <span className="bg-gradient-to-r from-rose-500 to-red-600 text-white px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-md shadow-red-900/10">{t('details.badge_sold')}</span>;
            }
            if (!isActive) {
              return <span className="bg-gradient-to-r from-rose-500 to-red-600 text-white px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-md shadow-red-900/10">{t('details.badge_sold')}</span>;
            }
            return <span className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-sm ${condClasses}`}>{conditionLabel(condition, t)}</span>;
          })()}
        </div>

        <h2 className="font-bold text-stone-100 leading-snug truncate text-sm sm:text-base mt-1">
          <Link to={`/product/${l.id}`} className="hover:text-gold-400 transition-colors">
            {l.title}
          </Link>
        </h2>

        {!isMini && (!l.product_type || l.product_type === 'lego') && (
          <div className="text-[10px] text-stone-400 font-mono mb-1">
            {t('details.set_number_prefix')} {setNumber}
          </div>
        )}

        {/* Footer Card */}
        <div className="mt-auto flex justify-between items-end pt-2">
          <div className="flex flex-col">
            {isAuction && isActive && (
              <span className="text-[9px] text-gold-400 uppercase font-bold tracking-tighter leading-none mb-1">
                {t('auction.current_bid')}
              </span>
            )}
            <p className={`font-black text-lg leading-none ${isAuction ? 'text-gold-400' : 'text-gold-400'}`}>
              {formatPrice(isAuction ? l.current_bid : l.price, i18n.language)}
            </p>
          </div>

          {!isMini && (
            <div className="flex flex-col items-end leading-none mb-0.5 gap-1">
              <span className="text-[10px] text-stone-300 font-medium">{sellerName}</span>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {/* LEGENDARY: emerald glow — shown before other badges for impact */}
                {isLegendary && (
                  <span
                    className="px-1.5 py-0.5 text-[9px] rounded-md font-black uppercase tracking-tight"
                    style={{
                      background: 'linear-gradient(90deg, #059669, #10b981)',
                      color: '#fff',
                      boxShadow: '0 0 6px 1px rgba(16, 185, 129, 0.6)',
                    }}
                    title={t('details.badge_legendary_tooltip')}
                  >
                    {t('details.badge_legendary')}
                  </span>
                )}

                {/* PRO: gold badge */}
                {isPro && !isLegendary && (
                  <span className="bg-gold-500 text-white px-1.5 py-0.5 text-[9px] rounded-md font-black uppercase">
                    {t('details.badge_pro')}
                  </span>
                )}

                {/* VERIFIED: blue badge */}
                {isVerified && (
                  <span className="bg-gold-500 text-white px-1.5 py-0.5 text-[9px] rounded-md font-black uppercase">
                    {t('details.badge_verified_id')}
                  </span>
                )}

                {/* NEW USER: grey label — only shown when no other positive badge applies */}
                {isNewUser && !isPro && !isVerified && !isLegendary && (
                  <span className="bg-stone-600 text-stone-300 px-1.5 py-0.5 text-[9px] rounded-md font-semibold uppercase">
                    {t('details.badge_new')}
                  </span>
                )}

                <SellerTypeBadge sellerType={sellerType} />
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}