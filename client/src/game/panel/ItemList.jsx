import { useTranslation } from 'react-i18next';
import { Gavel } from 'lucide-react';
import { listingImage, formatEUR } from '../../components/landing/landingUtils';
import { displayPrice, isAuction, isOwn, bidCount, timeLeft, formatTimeLeft } from '../../lib/game/marketQueries';
import { useMoneyLocale } from './hooks';

/** Status lines of a panel list: loading, error (with retry) or an empty message. */
export function PanelStatus({ status, empty, onRetry }) {
  const { t } = useTranslation();
  if (status === 'loading') return <p className="cbg-pixel p-4 text-center text-[0.6rem] text-white/60">{t('game.loading')}</p>;
  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 p-4 text-center">
        <p className="text-sm text-white/65">{t('game.panel.error')}</p>
        {onRetry && <button type="button" className="cbg-btn cbg-btn--ghost" onClick={onRetry}>{t('game.panel.retry')}</button>}
      </div>
    );
  }
  return <p className="p-4 text-center text-sm leading-relaxed text-white/60">{empty}</p>;
}

/** Thumbnail of a listing (blank tile when it has no picture: never a stock image). */
export function Thumb({ item, size = 160, className = '' }) {
  const img = listingImage(item, size);
  return (
    <span className={`cbg-thumb ${className}`}>
      {img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
    </span>
  );
}

/**
 * Real listings as rows of an RPG shop: picture, name, price (and for auctions the time left and the bids, when the
 * API has them). Picking one calls `onPick(item)`; `me` marks the player's own listings.
 */
export default function ItemList({ items, onPick, me, now, color = '#c6ff3d' }) {
  const { t } = useTranslation();
  const locale = useMoneyLocale();
  const units = { d: t('game.panel.unit_d'), h: t('game.panel.unit_h'), m: t('game.panel.unit_m'), s: t('game.panel.unit_s') };
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => {
        const price = displayPrice(item);
        const auction = isAuction(item);
        const left = auction ? timeLeft(item.auction_end, now) : null;
        const bids = auction ? bidCount(item) : null;
        return (
          <li key={item.id}>
            <button type="button" onClick={() => onPick(item)} className="cbg-item">
              <Thumb item={item} className="h-14 w-14 shrink-0" />
              <span className="min-w-0 flex-1 text-left">
                <span className="line-clamp-2 text-xs font-bold leading-snug text-white">{item.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.7rem]">
                  <span className="font-black" style={{ color }}>{price.amount === null ? '—' : formatEUR(price.amount, locale)}</span>
                  {auction && <span className="inline-flex items-center gap-1 text-[#ff7a5c]"><Gavel className="h-3 w-3" aria-hidden />{left && !left.ended ? formatTimeLeft(left, units) : t('game.panel.auction')}</span>}
                  {bids !== null && <span className="text-white/55">{t('game.panel.bids', { count: bids })}</span>}
                  {isOwn(item, me) && <span className="cbg-badge">{t('game.panel.yours')}</span>}
                </span>
              </span>
              <span aria-hidden className="cbg-pixel text-[0.55rem] text-white/40">▶</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
