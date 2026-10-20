import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Gavel, X } from 'lucide-react';
import { apiFetch } from '../../api';
import { listingImage, formatEUR } from '../../components/landing/landingUtils';
import AvatarPreview from './AvatarPreview';

/**
 * Inventory of another player of the plaza, inside the game screen: what they have on sale (public profile API).
 * `player` = { u: username, a: avatar } or null for the empty state. Items open the real product pages.
 */
export default function InventoryPanel({ player, onClose, className = '' }) {
  const { t, i18n } = useTranslation();
  const username = player?.u || null;
  const [state, setState] = useState({ for: null, status: 'idle', items: [] });

  useEffect(() => {
    if (!username) return undefined;
    let live = true;
    apiFetch(`/api/users/profile/${encodeURIComponent(username)}`)
      .then((data) => { if (live) setState({ for: username, status: 'ready', items: data?.listings?.active || [] }); })
      .catch((err) => { if (live) setState({ for: username, status: err?.status === 404 ? 'notfound' : 'error', items: [] }); });
    return () => { live = false; };
  }, [username]);

  const lang = i18n.language || 'it';
  const locale = lang === 'en' ? 'en-GB' : `${lang}-${lang.toUpperCase()}`;
  const status = !username ? 'empty' : state.for === username ? state.status : 'loading';

  return (
    <aside className={`cbg-panel flex min-h-0 flex-col ${className}`} aria-label={t('game.inventory.kicker')}>
      {status === 'empty' ? (
        <div className="flex flex-1 items-center justify-center p-5 text-center text-sm leading-relaxed text-white/55">
          {t('game.inventory.panel_empty')}
        </div>
      ) : (
        <>
          <header className="flex shrink-0 items-center gap-3 border-b-2 border-black/60 p-3">
            <div className="shrink-0 rounded-lg bg-black/40"><AvatarPreview avatar={player.a} scale={1} /></div>
            <div className="min-w-0 flex-1">
              <p className="cbg-pixel truncate text-[0.6rem] uppercase text-white">{username}</p>
              <Link to={`/game/inventario/${encodeURIComponent(username)}`} className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs font-bold text-[#22d3ee] hover:underline">
                {t('game.inventory.panel_full')} <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            <button type="button" onClick={onClose} aria-label={t('game.plaza.close')} className="flex h-11 w-11 shrink-0 items-center justify-center text-white/60 hover:text-white">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {status === 'loading' && <p className="cbg-pixel p-3 text-center text-[0.6rem] text-white/60">{t('game.loading')}</p>}
            {status === 'notfound' && <p className="p-3 text-center text-sm text-white/60">{t('game.inventory.not_found')}</p>}
            {status === 'error' && <p className="p-3 text-center text-sm text-white/60">{t('game.inventory.error')}</p>}
            {status === 'ready' && state.items.length === 0 && <p className="p-3 text-center text-sm text-white/60">{t('game.inventory.empty')}</p>}
            {status === 'ready' && state.items.length > 0 && (
              <ul className="flex flex-col gap-2">
                {state.items.map((item) => {
                  const img = listingImage(item, 160);
                  const price = item.is_auction ? (item.current_bid || item.starting_price) : item.price;
                  return (
                    <li key={item.id}>
                      <Link to={`/product/${item.id}`} className="flex items-center gap-2 border-2 border-black/60 bg-black/30 p-1.5 transition hover:bg-white/5">
                        <span className="relative block h-14 w-14 shrink-0 overflow-hidden bg-black/50">
                          {img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-xs font-bold leading-snug text-white">{item.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[0.7rem]">
                            <span className="font-black text-[#c6ff3d]">{formatEUR(price, locale)}</span>
                            {item.is_auction && <span className="inline-flex items-center gap-1 text-[#ff5a36]"><Gavel className="h-3 w-3" aria-hidden />{t('game.inventory.auction')}</span>}
                            {item.condition && <span className="text-white/50">{item.condition}</span>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
