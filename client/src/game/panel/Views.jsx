import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Gavel, Puzzle, Coins } from 'lucide-react';
import { formatEUR } from '../../components/landing/landingUtils';
import { normalizeImageUrl } from '../../api';
import { useAuth } from '../../auth/useAuth';
import { useLocalizedNav } from '../../routing/useLocalizedNav';
import { LISTING_ENDPOINTS } from '../../api';
import { ownListings } from '../../lib/game/sellFlow';
import {
  listingsUrl, auctionsUrl, siteCategoryPath, goodsTitleKey, runningAuctions, displayPrice, isAuction, isOwn,
  bidCount, sellerName, timeLeft, formatTimeLeft,
} from '../../lib/game/marketQueries';
import ItemList, { PanelStatus, Thumb } from './ItemList';
import { useApiData, useNow, useMoneyLocale } from './hooks';

/** A link out of the game to a real page of the site, styled as a pixel button. */
function SiteLink({ to, color, children, ghost = false }) {
  const navTo = useLocalizedNav();
  return (
    <Link to={navTo(to)} className={`cbg-btn w-full ${ghost ? 'cbg-btn--ghost' : ''}`} style={ghost ? undefined : { background: color }}>
      {children} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}

/** The goods of a merchant: real active fixed-price listings of one category. */
export function GoodsView({ query, color, onPick }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { status, data, retry } = useApiData(listingsUrl(query));
  const items = Array.isArray(data) ? data : [];
  return (
    <div className="flex flex-col gap-3 p-3">
      <h3 className="cbg-pixel text-[0.6rem] leading-relaxed" style={{ color }}>{t(goodsTitleKey(query))}</h3>
      {status === 'ready' && items.length > 0
        ? <ItemList items={items} onPick={onPick} me={user?.username} color={color} />
        : <PanelStatus status={status} empty={t('game.panel.goods_empty')} onRetry={retry} />}
      <SiteLink to={siteCategoryPath(query)} ghost>{t('game.panel.see_all')}</SiteLink>
    </div>
  );
}

/** One listing: what the API says about it, and the way to its real page (where buying / bidding happens). */
export function ProductView({ item, color }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const locale = useMoneyLocale();
  const auction = isAuction(item);
  const now = useNow(1000, auction);
  const price = displayPrice(item);
  const left = auction ? timeLeft(item.auction_end, now) : null;
  const bids = auction ? bidCount(item) : null;
  const seller = sellerName(item);
  const units = { d: t('game.panel.unit_d'), h: t('game.panel.unit_h'), m: t('game.panel.unit_m'), s: t('game.panel.unit_s') };
  const rows = [
    price.amount !== null && [t(`game.panel.price_${price.kind}`), formatEUR(price.amount, locale)],
    left && [t('game.panel.time_left'), left.ended ? t('game.panel.ended') : formatTimeLeft(left, units)],
    bids !== null && [t('game.panel.bids_label'), String(bids)],
    item.condition && [t('game.panel.condition'), item.condition],
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-3 p-3">
      <Thumb item={item} size={480} className="mx-auto aspect-square w-full max-w-[240px]" />
      <div>
        <h3 className="text-sm font-black leading-snug text-white">{item.title}</h3>
        {isOwn(item, user?.username) && <span className="cbg-badge mt-1.5 inline-block">{t('game.panel.yours_long')}</span>}
      </div>
      {rows.length > 0 && (
        <dl className="cbg-stats">
          {rows.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd style={k === rows[0][0] ? { color } : undefined}>{v}</dd></div>
          ))}
        </dl>
      )}
      {seller && (
        <p className="text-xs text-white/60">
          {t('game.panel.seller')}{' '}
          <Link to={`/game/inventario/${encodeURIComponent(seller)}`} className="font-bold text-[#22d3ee] hover:underline">{seller}</Link>
        </p>
      )}
      <SiteLink to={`/product/${encodeURIComponent(item.id)}`} color={color}>{t(auction ? 'game.panel.open_auction' : 'game.panel.open_listing')}</SiteLink>
    </div>
  );
}

/** The board of the auction house: running auctions (ending first on top) with live countdowns. */
export function AuctionsView({ color, onPick }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { status, data, retry } = useApiData(auctionsUrl());
  const now = useNow(1000, status === 'ready');
  const items = runningAuctions(data, now);
  return (
    <div className="flex flex-col gap-3 p-3">
      <h3 className="cbg-pixel inline-flex items-center gap-2 text-[0.6rem] uppercase" style={{ color }}><Gavel className="h-3.5 w-3.5" aria-hidden />{t('game.panel.auctions_title')}</h3>
      {status === 'ready' && items.length > 0
        ? <ItemList items={items} onPick={onPick} me={user?.username} now={now} color={color} />
        : <PanelStatus status={status} empty={t('game.panel.auctions_empty')} onRetry={retry} />}
      <SiteLink to="/aste" ghost>{t('game.panel.all_auctions')}</SiteLink>
    </div>
  );
}

/**
 * The Skill Zone seen from the arena: the player's credits, the open challenges and the way in. Joining, paying a
 * slot and playing happen only on the Skill Zone page; nothing here touches credits. Prizes are shown only when the
 * API says they are real (no `mock` flag), and never with a money value next to a credit cost.
 */
export function ArenaView({ color }) {
  const { t } = useTranslation();
  const { wallet } = useAuth();
  const { status, data, retry } = useApiData('/api/contest/list');
  const balance = Number(wallet?.balanceCredits);
  const contests = data && !data.mock && Array.isArray(data.contests) ? data.contests.filter((c) => c.status === 'open') : [];
  const unavailable = status === 'ready' && data?.mock;
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-sm leading-relaxed text-white/80">{t('game.panel.arena_intro')}</p>
      {Number.isFinite(balance) && (
        <p className="cbg-stats-line"><Coins className="h-4 w-4 text-[#22d3ee]" aria-hidden />{t('game.panel.your_credits', { count: balance })}</p>
      )}
      <h3 className="cbg-pixel inline-flex items-center gap-2 text-[0.6rem] uppercase" style={{ color }}><Puzzle className="h-3.5 w-3.5" aria-hidden />{t('game.panel.contests_title')}</h3>
      {status === 'ready' && contests.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {contests.map((c) => (
            <li key={c.id} className="cbg-item cbg-item--static">
              <span className="cbg-thumb h-14 w-14 shrink-0">{c.imageUrl ? <img src={normalizeImageUrl(c.imageUrl)} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-xs font-bold leading-snug text-white">{c.title}</span>
                <span className="mt-1 flex flex-wrap gap-x-2 text-[0.7rem] text-white/60">
                  {Number.isFinite(c.totalSlots) && <span>{t('game.panel.slots', { filled: c.filledSlots ?? 0, total: c.totalSlots })}</span>}
                  {Number.isFinite(c.slotCostCredits) && <span style={{ color }}>{t('game.panel.slot_cost', { count: c.slotCostCredits })}</span>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <PanelStatus status={status} empty={t(unavailable ? 'game.panel.contests_unavailable' : 'game.panel.contests_empty')} onRetry={retry} />
      )}
      <p className="text-xs leading-relaxed text-white/55">{t('game.panel.arena_rules')}</p>
      <SiteLink to="/skill-zone" color={color}>{t('game.panel.open_arena')}</SiteLink>
    </div>
  );
}

/** The player's own listings (from their shop): what is on sale first, then drafts and the rest; managed on the site. */
export function MineView({ color, onPick }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { status, data, retry } = useApiData(LISTING_ENDPOINTS.mine);
  const items = ownListings(data).map((it) => ({ ...it, seller: { username: user?.username } }));
  return (
    <div className="flex flex-col gap-3 p-3">
      <h3 className="cbg-pixel text-[0.6rem] leading-relaxed" style={{ color }}>{t('game.sell.mine_title')}</h3>
      {status === 'ready' && items.length > 0
        ? <ItemList items={items} onPick={onPick} color={color} />
        : <PanelStatus status={status} empty={t('game.sell.mine_empty')} onRetry={retry} />}
      <SiteLink to="/my-listings" ghost>{t('game.sell.manage')}</SiteLink>
    </div>
  );
}

/** Another player of the plaza: what they have on sale (public profile API), same rows as the merchants. */
export function PlayerView({ username, onPick }) {
  const { t } = useTranslation();
  const { status, code, data, retry } = useApiData(`/api/users/profile/${encodeURIComponent(username)}`);
  const items = (data?.listings?.active || []).map((it) => ({ ...it, seller: { username } }));
  return (
    <div className="flex flex-col gap-3 p-3">
      {status === 'ready' && items.length > 0
        ? <ItemList items={items} onPick={onPick} color="#c6ff3d" />
        : <PanelStatus status={code === 404 ? 'empty' : status} empty={t(code === 404 ? 'game.inventory.not_found' : 'game.inventory.empty')} onRetry={retry} />}
      <Link to={`/game/inventario/${encodeURIComponent(username)}`} className="cbg-btn cbg-btn--ghost w-full">
        {t('game.inventory.panel_full')} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
