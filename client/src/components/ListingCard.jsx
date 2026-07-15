import React from 'react';
import { Link } from 'react-router-dom';
import { normalizeImageUrl } from '../api';
import { Star } from 'lucide-react';
import AuctionTimer from './AuctionTimer';

function listingImage(l) {
  let url = '';
  if (Array.isArray(l.images) && l.images.length) url = l.images[0];
  else if (l.image_url) url = l.image_url;
  if (!url) return 'https://picsum.photos/seed/placeholder/800/600';
  return normalizeImageUrl(url);
}

function formatPrice(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

function conditionClasses(c = '') {
  const lc = c.toLowerCase();
  if (lc === 'new' || lc === 'complete') return 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white';
  if (lc === 'good') return 'bg-gradient-to-r from-amber-500 to-orange-600 text-white';
  return 'bg-gradient-to-r from-slate-500 to-slate-600 text-slate-200';
}

export default function ListingCard({ l, isFeatured = false, isCompact = false, isMini = false }) {
  const setNumber = l.set_number || l.number || 'N/A';
  const condition = l.condition || 'used';
  const sellerName = l.seller_username || l.seller?.username || 'Sconosciuto';

  // ── Seller badge data (from API or passed directly) ────────────────────────
  const sellerData = l.seller || {};
  const isPro       = l.seller_is_pro      ?? sellerData.is_pro       ?? false;
  const isVerified  = l.seller_is_verified ?? sellerData.is_verified  ?? false;
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
    <article className="w-full h-full flex flex-col bg-[#0d1224]/40 backdrop-blur-md rounded-2xl overflow-hidden border border-white/5 hover:border-sky-500/30 hover:shadow-[0_15px_30px_-10px_rgba(56,189,248,0.12)] transition-all duration-300 group/card">

      {/* Header: Mostra il Timer solo se l'asta è ATTIVA */}
      <div className={`flex justify-between items-center px-3 py-1.5 ${isFeatured ? 'bg-amber-600/10' : 'bg-white/2'}`}>
        {isAuction && isActive ? (
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-amber-500 to-amber-600 text-black px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-sm">
              ASTA
            </span>
            <AuctionTimer endDate={l.auction_end} />
          </div>
        ) : (
          /* Se l'asta è chiusa o è un annuncio normale, mantiene lo spazio pulito */
          <div className="h-[18px]" />
        )}

        {isFeatured && (
          <Star size={14} className="fill-amber-500 text-amber-500 ml-auto" />
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
              return <span className="bg-gradient-to-r from-rose-500 to-red-600 text-white px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-md shadow-red-900/10">VENDUTO</span>;
            }
            if (l.status === 'ended' || l.status === 'closed' || l.status === 'expired') {
              if (isAuction && !(Number(l.bids_count) > 0 || Number(l.current_bid) > Number(l.auction_start))) {
                return <span className="bg-gradient-to-r from-slate-600 to-slate-700 text-slate-200 px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-sm">SCADUTO</span>;
              }
              return <span className="bg-gradient-to-r from-rose-500 to-red-600 text-white px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-md shadow-red-900/10">VENDUTO</span>;
            }
            if (!isActive) {
              return <span className="bg-gradient-to-r from-rose-500 to-red-600 text-white px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-md shadow-red-900/10">VENDUTO</span>;
            }
            return <span className={`px-2 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider shadow-sm ${condClasses}`}>{condition}</span>;
          })()}
        </div>

        <h2 className="font-bold text-slate-100 leading-snug truncate text-sm sm:text-base mt-1">
          <Link to={`/product/${l.id}`} className="hover:text-sky-400 transition-colors">
            {l.title}
          </Link>
        </h2>

        {!isMini && (
          <div className="text-[10px] text-slate-400 font-mono mb-1">
            Set N° {setNumber}
          </div>
        )}

        {/* Footer Card */}
        <div className="mt-auto flex justify-between items-end pt-2">
          <div className="flex flex-col">
            {isAuction && isActive && (
              <span className="text-[9px] text-amber-400 uppercase font-bold tracking-tighter leading-none mb-1">
                Offerta attuale
              </span>
            )}
            <p className={`font-black text-lg leading-none ${isAuction ? 'text-amber-400' : 'text-sky-400'}`}>
              {formatPrice(isAuction ? l.current_bid : l.price)}
            </p>
          </div>

          {!isMini && (
            <div className="flex flex-col items-end leading-none mb-0.5 gap-1">
              <span className="text-[10px] text-slate-300 font-medium">{sellerName}</span>
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
                    title="Legendary Seller: rating ≥ 4.8 e 10+ vendite"
                  >
                    ★ LEGENDARY
                  </span>
                )}

                {/* PRO: gold badge */}
                {isPro && !isLegendary && (
                  <span className="bg-amber-500 text-black px-1.5 py-0.5 text-[9px] rounded-md font-black uppercase">
                    PRO
                  </span>
                )}

                {/* VERIFIED: blue badge */}
                {isVerified && (
                  <span className="bg-sky-500 text-white px-1.5 py-0.5 text-[9px] rounded-md font-black uppercase">
                    ✓ ID
                  </span>
                )}

                {/* NEW USER: grey label — only shown when no other positive badge applies */}
                {isNewUser && !isPro && !isVerified && !isLegendary && (
                  <span className="bg-slate-600 text-slate-300 px-1.5 py-0.5 text-[9px] rounded-md font-semibold uppercase">
                    NUOVO
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}