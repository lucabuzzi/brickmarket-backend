import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, Gavel, Star } from 'lucide-react';
import { apiFetch } from '../api';
import { listingImage, formatEUR } from '../components/landing/landingUtils';
import AvatarPreview from './components/AvatarPreview';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/press-start-2p/latin-ext-400.css';
import './game.css';

/** One listing as a pixel-framed card; it opens the real product page of the site. */
function ItemCard({ item, lang }) {
  const { t } = useTranslation();
  const img = listingImage(item, 400);
  const price = item.is_auction ? (item.current_bid || item.starting_price) : item.price;
  return (
    <li className="min-w-0">
      <Link to={`/product/${item.id}`} className="cbg-panel flex h-full flex-col overflow-hidden transition hover:brightness-110">
        <div className="relative aspect-square bg-black/40">
          {img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
          {item.is_auction && (
            <span className="cbg-pixel absolute left-2 top-2 inline-flex items-center gap-1 border-2 border-black bg-[#ff5a36] px-1.5 py-1 text-[0.5rem] uppercase text-black">
              <Gavel className="h-3 w-3" aria-hidden /> {t('game.inventory.auction')}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-white">{item.title}</p>
          <p className="cbg-pixel mt-auto text-[0.65rem] text-[#c6ff3d]">
            {item.is_auction && item.current_bid ? `${t('game.inventory.current_bid')} ` : ''}{formatEUR(price, lang)}
          </p>
        </div>
      </Link>
    </li>
  );
}

/**
 * "Inventario" of a player of the plaza (/game/inventario/:username): what they have on sale, from the same public
 * profile API the site uses. Part of the game shell (outside the site Layout); every item links to the site.
 */
export default function InventoryPage() {
  const { t, i18n } = useTranslation();
  const { username } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${username} · CardBrix the game!`;
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => { document.title = prevTitle; robots.remove(); };
  }, [username]);

  useEffect(() => {
    let live = true;
    apiFetch(`/api/users/profile/${encodeURIComponent(username)}`)
      .then((data) => { if (live) setState({ status: 'ready', data }); })
      .catch((err) => { if (live) setState({ status: err?.status === 404 ? 'notfound' : 'error', data: null }); });
    return () => { live = false; };
  }, [username]);

  const backToPlaza = () => navigate('/game', { state: { resume: true } });
  const user = state.data?.user;
  const items = state.data?.listings?.active || [];
  const locale = i18n.language === 'en' ? 'en-GB' : `${i18n.language || 'it'}-${(i18n.language || 'it').toUpperCase()}`;

  return (
    <div className="cbg-root">
      <div className="mx-auto max-w-[1000px] px-4 pb-16 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={backToPlaza} className="cbg-btn cbg-btn--ghost">
            <ArrowLeft className="h-4 w-4" aria-hidden /> {t('game.inventory.back')}
          </button>
          {user && (
            <Link to={`/user/${encodeURIComponent(user.username)}`} className="cbg-btn cbg-btn--ghost">
              {t('game.inventory.full_profile')} <ExternalLink className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>

        {state.status === 'loading' && <p className="cbg-pixel mt-16 text-center text-xs text-white/70">{t('game.loading')}</p>}
        {state.status === 'notfound' && <p className="mt-16 text-center text-white/70">{t('game.inventory.not_found')}</p>}
        {state.status === 'error' && <p className="mt-16 text-center text-white/70">{t('game.inventory.error')}</p>}

        {user && (
          <>
            <header className="cbg-panel mt-6 flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:text-left">
              <div className="shrink-0 rounded-xl bg-black/40 px-2 pt-1">
                <AvatarPreview avatar={user.avatar_config} walking scale={3} label={user.username} />
              </div>
              <div className="min-w-0">
                <h1 className="cbg-pixel break-words text-lg uppercase text-white sm:text-xl">{t('game.inventory.title', { username: user.username })}</h1>
                {Number(user.rating_count) > 0 && (
                  <p className="mt-2 inline-flex items-center gap-1 text-sm text-white/70">
                    <Star className="h-4 w-4 fill-current text-[#ffd23f]" aria-hidden /> {Number(user.rating_avg).toFixed(1)} ({user.rating_count})
                  </p>
                )}
              </div>
            </header>

            <section className="mt-8">
              <h2 className="cbg-pixel text-sm uppercase text-white">
                {t('game.inventory.selling')} <span className="text-white/50">({items.length})</span>
              </h2>
              {items.length === 0 ? (
                <p className="mt-4 text-white/60">{t('game.inventory.empty')}</p>
              ) : (
                <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((item) => <ItemCard key={item.id} item={item} lang={locale} />)}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
