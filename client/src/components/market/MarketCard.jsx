import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, Gavel, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { GAME_NAMES, formatEUR, listingImage, pad2, useCountdown } from '../landing/landingUtils';
import { displayPrice } from './marketConfig';

function AuctionClock({ endDate }) {
  const { t } = useTranslation();
  const { d, h, m, s, done } = useCountdown(endDate);
  if (!endDate) return null;
  const urgent = !done && d === 0 && h === 0;
  const label = done
    ? t('market.card.ended')
    : d > 0 ? `${d}${t('landing.auctions.unit_d')} ${pad2(h)}:${pad2(m)}` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`;

  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-black tabular-nums backdrop-blur-md ${
        urgent ? 'lx-ping-soft bg-[#ff5a36] text-white' : 'bg-black/70 text-white'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${urgent ? 'bg-white' : 'bg-[#ff5a36]'}`} />
      {label}
    </span>
  );
}

export default function MarketCard({ item, mode, index = 0 }) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const isAuction = mode.isAuction;
  const seller = item.seller || {};

  const subtitle = item.product_type === 'tcg'
    ? GAME_NAMES[item.game] || item.theme
    : item.set_number ? t('landing.listings.set_number', { number: item.set_number }) : item.theme;

  return (
    <motion.div
      initial={reduceMotion ? false : { y: 24 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <Link
        to={`/product/${item.id}`}
        className="group flex h-full flex-col rounded-[22px] border border-white/10 bg-[#121017] p-2 transition-all duration-300 hover:-translate-y-1.5 hover:border-[color:var(--mc-accent)]"
        style={{ '--mc-accent': mode.accent }}
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-[16px] bg-[#1b1822]">
          <img
            src={listingImage(item, 520)}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.07]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute inset-x-2 top-2 flex flex-wrap items-start justify-between gap-1.5">
            {item.condition ? (
              <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-md">
                {t(`details.condition_${item.condition.toLowerCase()}`, { defaultValue: item.condition })}
              </span>
            ) : <span />}
            {isAuction ? (
              <AuctionClock endDate={item.auction_end} />
            ) : item.is_featured ? (
              <span
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase"
                style={{ background: mode.accent, color: mode.accentInk }}
              >
                <Sparkles size={11} /> {t('landing.listings.featured')}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
          <p className="line-clamp-2 text-[14px] font-bold leading-snug text-white sm:text-[15px]">{item.title}</p>
          {subtitle ? <p className="mt-1 truncate text-xs font-medium text-white/40">{subtitle}</p> : null}

          <div className="mt-auto pt-4">
            {isAuction ? (
              <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                <Gavel size={11} />
                {item.current_bid != null ? t('landing.auctions.current_bid') : t('landing.auctions.starting_price')}
                <span className="normal-case tracking-normal">· {t('landing.auctions.bids', { count: item.bids_count || 0 })}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
              <span className="font-mono text-lg font-black tabular-nums tracking-tight text-white sm:text-xl">
                {formatEUR(displayPrice(item), i18n.language)}
              </span>
              <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-white/45">
                <span className="truncate">{seller.username}</span>
                {seller.is_verified ? <BadgeCheck size={14} className="shrink-0" style={{ color: mode.accent }} /> : null}
                {seller.is_pro ? (
                  <span className="shrink-0 rounded bg-white/10 px-1 text-[9px] font-black text-white/80">PRO</span>
                ) : null}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
