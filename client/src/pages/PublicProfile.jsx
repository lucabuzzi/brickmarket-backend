import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Calendar, ChevronDown, Crown, Gavel, MapPin,
  MessageSquare, Package, Share2, ShoppingBag, Star, Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import BrickRating from '../components/BrickRating';
import MarketCard from '../components/market/MarketCard';
import { MARKET_MODES, isLiveAuction } from '../components/market/marketConfig';
import { cldImage, formatEUR, listingImage } from '../components/landing/landingUtils';
import { useToast } from '../context/ToastContext';

const LIME = '#c6ff3d';
const EMBER = '#ff5a36';
const REVIEWS_PER_PAGE = 5;

const isAuctionItem = (l) => Boolean(l.is_auction || l.type === 'auction');

/** Two drifting rows of the seller's own photos behind the hero. */
function ShowcaseTape({ images }) {
  const reduceMotion = useReducedMotion();
  if (images.length < 3) return null;
  const row = (list) => [...list, ...list, ...list, ...list].slice(0, Math.max(16, list.length * 2));
  const rows = [images, [...images].reverse()];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, #000 20%, transparent 95%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 20%, transparent 95%)',
      }}
      aria-hidden
    >
      <div className="absolute -left-[10%] -top-10 flex w-[120%] -rotate-[5deg] flex-col gap-4 opacity-45">
        {rows.map((list, r) => {
          const items = row(list);
          return (
            <div key={r} className="overflow-hidden">
              <div
                className={`flex w-max gap-4 ${reduceMotion ? '' : 'lx-marquee'}`}
                style={r === 1 ? { animationDirection: 'reverse', animationDuration: '90s' } : undefined}
              >
                {[...items, ...items].map((src, i) => (
                  <img key={i} src={src} alt="" loading="lazy" className="h-36 w-28 shrink-0 rounded-2xl object-cover md:h-48 md:w-36" />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#07060b]/40 via-[#07060b]/70 to-[#07060b]" />
    </div>
  );
}

function StatTile({ value, label, accent, children }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
      <p className="truncate font-mono text-2xl font-black tabular-nums text-white md:text-3xl" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {children}
      <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-wider text-white/45">{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }) {
  return (
    <div className="flex flex-col items-center rounded-[1.75rem] border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
        <Icon className="h-6 w-6 text-white/50" />
      </span>
      <p className="mt-5 text-xl font-black text-white">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-white/55">{desc}</p>
    </div>
  );
}

export default function PublicProfile() {
  const { t, i18n } = useTranslation();
  const { username } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/users/profile/${username}`);
        if (!cancelled) {
          setData(res);
          setLoadedAt(Date.now());
          // Pre-populate the 5 recent reviews from the profile response
          setReviews(res.reviews || []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || t('public_profile.load_error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [username, t]);

  const loadMoreReviews = async () => {
    if (!data?.user?.id) return;
    setReviewsLoading(true);
    try {
      const all = await apiFetch(`/api/reviews/user/${data.user.id}`);
      setReviews(all);
      setReviewsPage(Math.ceil(all.length / REVIEWS_PER_PAGE));
    } catch (e) {
      console.error('Reviews load error:', e);
    } finally {
      setReviewsLoading(false);
    }
  };

  const shareProfile = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${username} | CardBrix`, url });
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Clipboard API can be denied (embedded webviews, older browsers): legacy copy fallback.
        const area = document.createElement('textarea');
        area.value = url;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        if (!copied) throw new Error('copy failed');
      }
      toast.success(t('seller_page.link_copied'));
    } catch (e) {
      if (e?.name !== 'AbortError') toast.error(t('seller_page.share_error'));
    }
  };

  if (loading) {
    return (
      <div className="lx-page min-h-[80vh]">
        <div className="mx-auto max-w-[1320px] px-4 pb-16 pt-28 md:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end">
            <div className="h-32 w-32 animate-pulse rounded-full bg-white/[0.07] md:h-40 md:w-40" />
            <div className="flex-1 space-y-4">
              <div className="h-4 w-40 animate-pulse rounded-full bg-white/[0.07]" />
              <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-white/[0.07]" />
            </div>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-[22px] bg-white/[0.05]" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="lx-page flex min-h-[80vh] items-center justify-center px-4 py-24">
        <div className="max-w-lg text-center">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <Users className="h-9 w-9 text-white/40" />
          </span>
          <h1 className="mt-6 text-3xl font-black tracking-[-0.03em] text-white md:text-4xl">{t('seller_page.not_found_title')}</h1>
          <p className="mt-3 text-white/60">{t('seller_page.not_found_desc', { username })}</p>
          <Link to="/ricerca-utente" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#c6ff3d] px-6 font-black text-[#10140a] transition hover:brightness-110">
            <ArrowLeft className="h-4 w-4" />
            {t('public_profile.back_to_search')}
          </Link>
        </div>
      </div>
    );
  }

  const { user, listings } = data;
  const seller = { username: user.username, is_verified: user.is_verified, is_pro: user.is_pro };
  const withSeller = (l) => ({ ...l, seller });

  const shop = listings.active.filter((l) => !isAuctionItem(l)).map(withSeller);
  const auctions = listings.active.filter((l) => isAuctionItem(l) && isLiveAuction(l, loadedAt)).map(withSeller);
  const sold = listings.sold.map(withSeller);

  const ratingAvg = parseFloat(user.rating_avg || 0);
  const ratingCount = parseInt(user.rating_count || 0, 10);
  const hasRating = ratingCount > 0;
  const isLegendary = ratingAvg >= 4.8 && sold.length >= 10;
  const isNewUser = ratingCount === 0 && sold.length === 0;
  const joinDate = new Date(user.created_at).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
  const shopValue = shop.reduce((sum, l) => sum + (parseFloat(l.price) || 0), 0);

  const tapeImages = [...listings.active, ...listings.sold]
    .map((l) => listingImage(l, 300))
    .filter(Boolean)
    .slice(0, 12);

  const tabs = [
    { id: 'shop', label: t('seller_page.tab_shop'), icon: Package, count: shop.length, accent: LIME },
    auctions.length > 0 && { id: 'auctions', label: t('seller_page.tab_auctions'), icon: Gavel, count: auctions.length, accent: EMBER },
    { id: 'sold', label: t('seller_page.tab_sold'), icon: ShoppingBag, count: sold.length, accent: '#ffffff' },
    { id: 'reviews', label: t('seller_page.tab_reviews'), icon: Star, count: ratingCount, accent: '#facc15' },
  ].filter(Boolean);
  const defaultTab = shop.length ? 'shop' : auctions.length ? 'auctions' : sold.length ? 'sold' : 'reviews';
  const tab = tabs.some((x) => x.id === activeTab) ? activeTab : defaultTab;
  const tabAccent = tabs.find((x) => x.id === tab)?.accent || LIME;

  const location = [user.city, user.address_country?.toUpperCase()].filter(Boolean).join(', ');
  const kicker = user.seller_type === 'professional'
    ? t('seller_page.kicker_professional')
    : user.seller_type === 'private' ? t('seller_page.kicker_private') : t('seller_page.kicker_member');

  return (
    <div className="lx-page pb-24">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="lx-bleed relative overflow-hidden">
        <ShowcaseTape images={tapeImages} />
        <div className="lx-grid pointer-events-none absolute inset-0 opacity-30" />
        <div className="pointer-events-none absolute -left-40 top-20 h-[420px] w-[420px] rounded-full opacity-20 blur-[120px]" style={{ background: LIME }} />

        <div className="relative mx-auto max-w-[1320px] px-4 pb-12 pt-24 md:px-10 md:pb-16 md:pt-32">
          <Link to="/ricerca-utente" className="mb-8 inline-flex min-h-10 items-center gap-2 text-[13px] font-semibold text-white/55 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            {t('public_profile.back_to_directory')}
          </Link>

          <div className="grid grid-cols-1 items-end gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <motion.div initial={{ y: 24 }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="min-w-0">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
                {/* avatar with spinning ring */}
                <div className="relative h-32 w-32 shrink-0 md:h-40 md:w-40">
                  <div
                    className="lx-arena-ring absolute -inset-2 rounded-full"
                    style={{ background: `conic-gradient(from var(--lx-ring-angle, 0deg), ${LIME}, #22d3ee, ${EMBER}, ${LIME})`, opacity: 0.7 }}
                  />
                  <div className="relative h-full w-full overflow-hidden rounded-full border-4 border-[#07060b] bg-[#15131c]">
                    {user.avatar_url ? (
                      <img src={cldImage(user.avatar_url, 320)} alt={user.username} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-6xl font-black uppercase md:text-7xl" style={{ color: LIME }}>
                        {user.username.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  {user.is_verified && (
                    <span className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-[#07060b] bg-[#22d3ee] text-[#07060b]" title={t('seller_page.badge_verified')}>
                      <BadgeCheck className="h-5 w-5" strokeWidth={2.5} />
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: LIME }}>{kicker}</p>
                  <h1 className="mt-2 break-words text-[clamp(2.6rem,7vw,5.5rem)] font-black leading-[0.9] tracking-[-0.05em] text-white">
                    {user.username}
                  </h1>
                  {user.company_name && <p className="mt-2 text-lg font-bold text-white/70">{user.company_name}</p>}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {isLegendary && (
                  <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-[#c6ff3d] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#07060b] shadow-[0_0_24px_rgba(198,255,61,0.35)]" title={t('details.badge_legendary_tooltip')}>
                    <Crown className="h-3.5 w-3.5" strokeWidth={3} /> {t('seller_page.badge_legendary')}
                  </span>
                )}
                {user.is_pro && (
                  <span className="flex items-center gap-1.5 rounded-full bg-[#eab308] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-black">
                    <Crown className="h-3.5 w-3.5" strokeWidth={3} /> PRO
                  </span>
                )}
                {user.is_verified && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[#22d3ee]/40 bg-[#22d3ee]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#22d3ee]">
                    <BadgeCheck className="h-3.5 w-3.5" /> {t('seller_page.badge_verified')}
                  </span>
                )}
                {isNewUser && !user.is_pro && !user.is_verified && (
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white/70">
                    {t('seller_page.badge_new')}
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-white/60">
                {location && (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {location}
                    {user.address_country && <span className={`fi fi-${user.address_country.toLowerCase()} rounded-[2px]`} />}
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('public_profile.member_since', { date: joinDate })}
                </span>
              </div>

              {user.bio && (
                <p className="mt-6 max-w-2xl whitespace-pre-line break-words text-base leading-relaxed text-white/75 md:text-lg">
                  {user.bio}
                </p>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                {shop.length + auctions.length > 0 && (
                  <a
                    href="#vetrina"
                    className="lx-shine relative inline-flex min-h-12 items-center gap-2 overflow-hidden rounded-full px-6 text-sm font-black text-[#10140a] transition hover:brightness-110"
                    style={{ background: LIME }}
                  >
                    {t('seller_page.cta_showcase')}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={shareProfile}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:border-white/40"
                >
                  <Share2 className="h-4 w-4" />
                  {t('seller_page.share')}
                </button>
              </div>
            </motion.div>

            {/* stats */}
            <motion.div
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-2 gap-3"
            >
              <StatTile value={shop.length + auctions.length} label={t('seller_page.stat_on_sale')} accent={LIME} />
              <StatTile value={sold.length} label={t('seller_page.stat_sold')} />
              <StatTile value={hasRating ? ratingAvg.toFixed(1) : '—'} label={hasRating ? t('seller_page.stat_rating', { count: ratingCount }) : t('seller_page.stat_rating_none')}>
                <div className="mt-1.5"><BrickRating value={hasRating ? ratingAvg : 0} interactive={false} /></div>
              </StatTile>
              <StatTile value={shop.length ? formatEUR(shopValue, i18n.language) : '—'} label={t('seller_page.stat_value')} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Showcase ──────────────────────────────────────── */}
      <section id="vetrina" className="relative mx-auto max-w-[1320px] scroll-mt-24 px-4 pt-6 md:px-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: tabAccent }}>{t('seller_page.showcase_kicker')}</p>
            <h2 className="mt-2 break-words text-[clamp(1.9rem,4.5vw,3.2rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">
              {t('seller_page.showcase_title', { username: user.username })}
            </h2>
          </div>
        </div>

        <div className="lx-bleed sticky top-16 z-30 mb-8 border-y border-white/10 bg-[#07060b]/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1320px] gap-2 overflow-x-auto px-4 py-3 md:px-10" role="tablist">
            {tabs.map((x) => {
              const active = x.id === tab;
              return (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(x.id)}
                  className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${
                    active ? 'text-[#07060b]' : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white'
                  }`}
                  style={active ? { background: x.accent, borderColor: x.accent } : undefined}
                >
                  <x.icon className="h-4 w-4" />
                  {x.label}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${active ? 'bg-black/15' : 'bg-white/10'}`}>{x.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {tab === 'shop' && (
          shop.length === 0 ? (
            <EmptyState icon={Package} title={t('seller_page.empty_shop_title')} desc={t('public_profile.no_active_listings')} />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
              {shop.map((item, i) => <MarketCard key={item.id} item={item} mode={MARKET_MODES.listings} index={i} />)}
            </div>
          )
        )}

        {tab === 'auctions' && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {auctions.map((item, i) => <MarketCard key={item.id} item={item} mode={MARKET_MODES.auctions} index={i} />)}
          </div>
        )}

        {tab === 'sold' && (
          sold.length === 0 ? (
            <EmptyState icon={ShoppingBag} title={t('seller_page.empty_sold_title')} desc={t('public_profile.no_sold_items')} />
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
              {sold.map((item, i) => (
                <div key={item.id} className="relative">
                  <div className="grayscale-[0.85] opacity-70 transition hover:grayscale-0 hover:opacity-100">
                    <MarketCard item={item} mode={isAuctionItem(item) ? MARKET_MODES.auctions : MARKET_MODES.listings} index={i} />
                  </div>
                  <span className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -rotate-12 rounded-lg border-2 border-white bg-[#07060b]/80 px-3 py-1 text-sm font-black uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                    {t('status.sold')}
                  </span>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'reviews' && (
          reviews.length === 0 ? (
            <EmptyState icon={Star} title={t('public_profile.no_reviews_title')} desc={t('public_profile.no_reviews_subtitle')} />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10">
              <div className="h-fit rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 lg:sticky lg:top-40">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/45">{t('seller_page.reviews_score')}</p>
                <p className="mt-2 text-7xl font-black leading-none tracking-[-0.05em] text-white">
                  {ratingAvg.toFixed(1)}
                  <span className="ml-1 text-2xl text-white/35">/5</span>
                </p>
                <div className="mt-3"><BrickRating value={ratingAvg} size={22} interactive={false} /></div>
                <p className="mt-3 text-sm font-semibold text-white/55">{t('public_profile.feedback_received', { count: ratingCount })}</p>
              </div>

              <div className="space-y-3">
                {reviews.slice(0, reviewsPage * REVIEWS_PER_PAGE).map((review) => {
                  const date = new Date(review.created_at).toLocaleDateString(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' });
                  return (
                    <article key={review.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/25">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 font-black uppercase text-white/70">
                          {review.reviewer_avatar
                            ? <img src={cldImage(review.reviewer_avatar, 80)} alt="" className="h-full w-full object-cover" />
                            : review.reviewer_username?.[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-white">{review.reviewer_username}</p>
                          <p className="text-xs text-white/40">{date}</p>
                        </div>
                        <BrickRating value={review.rating} interactive={false} />
                      </div>
                      {review.listing_title && (
                        <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-white/45">
                          <Package className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {review.listing_set_number && <span className="mr-1" style={{ color: LIME }}>{review.listing_set_number}</span>}
                            {review.listing_title}
                          </span>
                        </p>
                      )}
                      {review.comment && (
                        <p className="mt-3 flex gap-2 text-[15px] leading-relaxed text-white/80">
                          <MessageSquare className="mt-1 h-4 w-4 shrink-0 text-white/25" />
                          <span className="min-w-0 break-words">{review.comment}</span>
                        </p>
                      )}
                    </article>
                  );
                })}

                {reviews.length > reviewsPage * REVIEWS_PER_PAGE && (
                  <button
                    type="button"
                    onClick={() => setReviewsPage((p) => p + 1)}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 text-sm font-bold text-white/70 transition hover:border-white/30 hover:text-white"
                  >
                    <ChevronDown className="h-4 w-4" /> {t('public_profile.load_more_reviews')}
                  </button>
                )}

                {reviews.length <= REVIEWS_PER_PAGE && ratingCount > REVIEWS_PER_PAGE && (
                  <button
                    type="button"
                    onClick={loadMoreReviews}
                    disabled={reviewsLoading}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 text-sm font-bold transition hover:border-white/40 disabled:opacity-60"
                    style={{ color: LIME }}
                  >
                    {reviewsLoading ? t('ui.loading') : <><ChevronDown className="h-4 w-4" /> {t('public_profile.show_all_reviews', { count: ratingCount })}</>}
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </section>
    </div>
  );
}
