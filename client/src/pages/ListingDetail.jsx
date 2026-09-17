import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Expand, Eye, Gavel, MapPin,
  ShieldCheck, ShoppingCart, Sparkles, Timer, Trophy, Truck, X,
} from 'lucide-react';
import { apiFetch, normalizeImageUrl } from '../api';
import { MOCK_LISTINGS } from '../utils/mockData';
import { useCart } from '../context/CartContext';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from 'react-i18next';
import BrickRating from '../components/BrickRating';
import { useToast } from '../context/ToastContext';
import SellerTypeBadge from '../components/SellerTypeBadge';
import MarketCard from '../components/market/MarketCard';
import { MARKET_CARD_GAMES, MARKET_MODES, useMarketItems } from '../components/market/marketConfig';
import { GAME_NAMES, cldImage, formatEUR, pad2, useCountdown } from '../components/landing/landingUtils';

function listingImages(l) {
  let rawItems = [];
  if (Array.isArray(l.images) && l.images.length) rawItems = l.images;
  else if (l.gallery && l.gallery.length) rawItems = l.gallery;
  else if (l.image_url) rawItems = [l.image_url];

  if (rawItems.length > 0) return rawItems.map(normalizeImageUrl);
  return ['https://picsum.photos/seed/detail/800/600'];
}

function formatPrice(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

const toNumber = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

const CATEGORY_SLUGS = { lego: 'lego', tcg: 'carte-collezionabili', funko: 'funko' };

/* ------------------------------------------------------------------ gallery */

function Lightbox({ images, index, title, onClose, onMove }) {
  const { t } = useTranslation();
  const touchX = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onMove(1);
      if (e.key === 'ArrowLeft') onMove(-1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onMove]);

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) onMove(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('product.gallery_close')}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={cldImage(images[index], 2000)}
        alt={title}
        className="max-h-[86vh] max-w-[92vw] select-none object-contain"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMove(-1); }}
            aria-label={t('product.gallery_prev')}
            className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMove(1); }}
            aria-label={t('product.gallery_next')}
            className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 font-mono text-sm text-white/60">
            {index + 1} / {images.length}
          </p>
        </>
      )}
    </motion.div>
  );
}

function Gallery({ images, title, accent, badge }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const stageRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const move = (step) => setIndex((i) => (i + step + images.length) % images.length);

  // Mouse-only 3D tilt, written straight to CSS vars so it never re-renders.
  const onPointerMove = (e) => {
    if (reduceMotion || e.pointerType !== 'mouse' || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    stageRef.current.style.setProperty('--rx', `${(-y * 7).toFixed(2)}deg`);
    stageRef.current.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
    stageRef.current.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
    stageRef.current.style.setProperty('--gy', `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const onPointerLeave = () => {
    if (!stageRef.current) return;
    stageRef.current.style.setProperty('--rx', '0deg');
    stageRef.current.style.setProperty('--ry', '0deg');
  };

  return (
    <div className="min-w-0">
      <div className="relative [perspective:1400px]">
        <div
          className="pointer-events-none absolute -inset-6 rounded-[2.5rem] opacity-40 blur-3xl"
          style={{ background: `radial-gradient(60% 60% at 50% 45%, ${accent}55, transparent 70%)` }}
        />
        <div
          ref={stageRef}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          className="pd-stage group relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d0c12] sm:aspect-[4/3] lg:aspect-[5/6]"
        >
          <img
            src={cldImage(images[index], 60)}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-2xl"
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={images[index]}
              src={cldImage(images[index], 1400)}
              alt={title}
              initial={{ opacity: 0.4, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0.4, scale: 1.01 }}
              transition={{ duration: 0.25 }}
              className="relative z-[1] h-full w-full object-contain p-5 drop-shadow-[0_30px_40px_rgba(0,0,0,0.6)] sm:p-8"
              draggable={false}
            />
          </AnimatePresence>
          <div
            className="pointer-events-none absolute inset-0 z-[2] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: 'radial-gradient(420px circle at var(--gx,50%) var(--gy,50%), rgba(255,255,255,0.12), transparent 60%)' }}
          />

          {badge && <div className="absolute left-4 top-4 z-[3]">{badge}</div>}

          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label={t('product.gallery_zoom')}
            className="absolute right-4 top-4 z-[3] flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
          >
            <Expand className="h-4.5 w-4.5" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label={t('product.gallery_prev')}
                className="absolute left-3 top-1/2 z-[3] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label={t('product.gallery_next')}
                className="absolute right-3 top-1/2 z-[3] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <span className="absolute bottom-4 right-4 z-[3] rounded-full bg-black/60 px-3 py-1 font-mono text-xs font-bold text-white backdrop-blur-md">
                {pad2(index + 1)} / {pad2(images.length)}
              </span>
            </>
          )}
        </div>
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1} / ${images.length}`}
              aria-current={i === index}
              className={`relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border-2 bg-[#0d0c12] transition ${
                i === index ? 'opacity-100' : 'border-white/10 opacity-50 hover:opacity-90'
              }`}
              style={i === index ? { borderColor: accent } : undefined}
            >
              <img src={cldImage(src, 200)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {zoomed && <Lightbox images={images} index={index} title={title} onClose={() => setZoomed(false)} onMove={move} />}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ auction */

function CountdownBlocks({ endDate, accent }) {
  const { t } = useTranslation();
  const { d, h, m, s, done } = useCountdown(endDate);
  if (!endDate || done) return null;
  const urgent = d === 0 && h === 0 && m < 5;
  const units = [
    [d, t('product.unit_days')],
    [h, t('product.unit_hours')],
    [m, t('product.unit_minutes')],
    [s, t('product.unit_seconds')],
  ];

  return (
    <div>
      <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-white/50">
        <Timer className="h-3.5 w-3.5" style={{ color: accent }} />
        {t('product.closes_in')}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {units.map(([value, label]) => (
          <div
            key={label}
            className={`rounded-2xl border px-1 py-3 text-center ${urgent ? 'lx-ping-soft border-[#ff5a36]/60 bg-[#ff5a36]/15' : 'border-white/10 bg-white/[0.04]'}`}
          >
            <span className="block font-mono text-[1.65rem] font-black leading-none tabular-nums text-white sm:text-3xl">{pad2(value)}</span>
            <span className="mt-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BidBox({ listing, user, accent, ended, onBid, bidLoading, inputRef }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [amount, setAmount] = useState('');

  const bidsCount = listing.bids_count || 0;
  const current = toNumber(listing.current_bid);
  const start = toNumber(listing.starting_price) ?? toNumber(listing.auction_start) ?? 0;
  const minBid = bidsCount === 0 || current == null ? start : current + 1;
  const chips = [minBid, minBid + 5, minBid + 10].map((v) => Math.round(v * 100) / 100);
  const parsed = parseFloat(String(amount).replace(',', '.'));
  const valid = Number.isFinite(parsed) && parsed >= minBid;
  const isLeader = user && listing.highest_bidder_username && listing.highest_bidder_username === user.username;

  const fmt = (v) => formatEUR(v, i18n.language);

  const submit = async (e) => {
    e.preventDefault();
    const ok = await onBid(amount);
    if (ok) setAmount('');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/50">
            {bidsCount > 0 ? t('auction.current_bid') : t('product.starting_price')}
          </p>
          <p className="mt-1 break-words text-[clamp(2.4rem,6vw,3.4rem)] font-black leading-none tracking-[-0.04em] text-white">
            {fmt(bidsCount > 0 ? current : start)}
          </p>
        </div>
        <span className="mb-1 flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-white/80">
          <Gavel className="h-3.5 w-3.5" style={{ color: accent }} />
          {t('auction.bids_count', { count: bidsCount })}
        </span>
      </div>

      {listing.highest_bidder_username && (
        <p className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${isLeader ? 'border-[#c6ff3d]/40 bg-[#c6ff3d]/10 text-[#c6ff3d]' : 'border-white/10 bg-white/[0.03] text-white/75'}`}>
          <Trophy className="h-4 w-4 shrink-0" />
          {isLeader ? t('auction.winning') : t('product.leader', { username: listing.highest_bidder_username })}
        </p>
      )}

      {ended ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
          <p className="text-lg font-black text-white">{t('auction.ended')}</p>
          <p className="mt-1 text-sm text-white/60">
            {bidsCount > 0 && listing.highest_bidder_username
              ? t('auction.winning_bid', { username: listing.highest_bidder_username, amount: fmt(current) })
              : t('auction.no_winner')}
          </p>
        </div>
      ) : user && user.id === listing.seller_id ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center text-sm font-bold text-white/70">
          {t('auction.own_listing_no_bid')}
        </p>
      ) : user ? (
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {chips.map((v, i) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(String(v))}
                className={`min-h-11 rounded-2xl border px-2 text-sm font-black tabular-nums transition ${
                  parsed === v ? 'text-white' : 'border-white/10 bg-white/[0.04] text-white/80 hover:border-white/25'
                }`}
                style={parsed === v ? { borderColor: accent, background: `${accent}22` } : undefined}
              >
                {i === 0 ? fmt(v) : `+${i === 1 ? 5 : 10} €`}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t('product.min_bid', { amount: fmt(minBid) })}
              aria-label={t('auction.place_bid')}
              required
              className="h-14 w-full rounded-2xl border border-white/12 bg-black/40 px-5 pr-12 text-lg font-bold text-white outline-none transition placeholder:text-sm placeholder:font-medium placeholder:text-white/35 focus:border-white/40"
            />
            <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-bold text-white/40">€</span>
          </div>
          <button
            type="submit"
            disabled={bidLoading || listing.status !== 'active'}
            className="lx-shine relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-black text-white shadow-[0_18px_40px_-12px_rgba(255,90,54,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: accent }}
          >
            <Gavel className="h-5 w-5" />
            {bidLoading ? t('review.submitting') : valid ? t('product.bid_cta', { amount: fmt(parsed) }) : t('auction.place_bid')}
          </button>
          <p className="text-center text-xs text-white/45">{t('product.anti_snipe')}</p>
        </form>
      ) : (
        <Link
          to="/login"
          state={{ from: location }}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black text-white transition hover:brightness-110"
          style={{ background: accent }}
        >
          {t('product.login_to_bid')}
          <ArrowRight className="h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ related */

function Related({ listing, mode }) {
  const { t } = useTranslation();
  const productType = listing.product_type || 'lego';
  const { items } = useMarketItems(mode, { productType });
  const others = items.filter((i) => i.id !== listing.id).slice(0, 4);
  if (others.length === 0) return null;
  const allTo = `${mode.base}/${CATEGORY_SLUGS[productType] || ''}`;

  return (
    <section className="mx-auto max-w-[1320px] px-4 pb-24 pt-8 md:px-10 md:pb-28">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: mode.accent }}>
            {t(`product.related_kicker_${mode.key}`)}
          </p>
          <h2 className="mt-2 text-[clamp(1.9rem,4.5vw,3.2rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">
            {t(`product.related_title_${mode.key}`)}
          </h2>
        </div>
        <Link to={allTo} className="flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-bold text-white transition hover:border-white/40">
          {t('product.related_cta')}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
        {others.map((item, i) => <MarketCard key={item.id} item={item} mode={mode} index={i} />)}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ page */

export default function ListingDetail() {
  const { id } = useParams();
  const { cart, addToCart } = useCart();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const bidInputRef = useRef(null);
  const bidPanelRef = useRef(null);

  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [bidLoading, setBidLoading] = useState(false);

  const countdown = useCountdown(listing?.auction_end);

  const handleAddToCart = () => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    addToCart(listing);
  };

  const handlePlaceBid = async (rawAmount) => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return false;
    }
    const finalAmount = parseFloat(String(rawAmount).replace(',', '.'));
    if (Number.isNaN(finalAmount) || finalAmount <= 0) {
      toast.error(t('auction.invalid_bid_amount'));
      return false;
    }

    setBidLoading(true);
    try {
      const updated = await apiFetch(`/api/listings/${id}/bid`, {
        method: 'POST',
        body: { amount: finalAmount },
      });
      // The bid endpoint returns the bare listing row: keep the joined seller info.
      setListing((prev) => ({ ...prev, ...updated, seller: prev.seller, highest_bidder_username: user.username }));
      toast.success(t('auction.bid_success'));
      return true;
    } catch (err) {
      toast.error(err.message || t('auction.bid_error'));
      return false;
    } finally {
      setBidLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await apiFetch(`/api/listings/${id}`);
        if (!cancelled) setListing(data);
      } catch (e) {
        if (!cancelled) {
          const mockMatch = MOCK_LISTINGS.find((m) => m.id === id);
          if (mockMatch) setListing(mockMatch);
          else setError(e.message || t('details.listing_not_found'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  // Server-side rendering already sets correct title/OG tags on first load (see
  // src/services/seoMeta.js) for bots and link unfurlers, but client-side SPA navigation between
  // listings doesn't reload the page, so the tags need updating here too for the browser tab
  // title and for the meta tags Google reads after executing the client JS.
  useEffect(() => {
    if (!listing) return;

    const effectivePrice = listing.type === 'auction' ? (listing.current_bid ?? listing.auction_start) : listing.price;
    const priceText = effectivePrice != null ? formatPrice(effectivePrice) : '';
    const title = `${listing.title} | CardBrix`;
    const description = (
      listing.description || `${listing.title}${priceText ? ` a ${priceText}` : ''} su CardBrix. Compra o fai un'offerta in sicurezza.`
    ).slice(0, 160);
    const image = listingImages(listing)[0];

    document.title = title;

    const setMeta = (selector, content) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', content);
    };
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:image"]', image);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[name="twitter:image"]', image);
  }, [listing]);

  if (loading) {
    return (
      <div className="lx-page min-h-[80vh]">
        <div className="mx-auto grid max-w-[1320px] grid-cols-1 gap-8 px-4 pb-16 pt-24 md:px-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pt-28">
          <div className="aspect-[4/5] animate-pulse rounded-[1.75rem] bg-white/[0.05] sm:aspect-[4/3] lg:aspect-[5/6]" />
          <div className="space-y-4">
            <div className="h-4 w-32 animate-pulse rounded-full bg-white/[0.07]" />
            <div className="h-16 w-4/5 animate-pulse rounded-2xl bg-white/[0.07]" />
            <div className="h-14 w-1/2 animate-pulse rounded-2xl bg-white/[0.07]" />
            <div className="h-56 animate-pulse rounded-[1.75rem] bg-white/[0.05]" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="lx-page flex min-h-[80vh] items-center justify-center px-4 py-24">
        <div className="relative max-w-lg text-center">
          <p className="lx-outline select-none text-[clamp(6rem,22vw,11rem)] font-black leading-none tracking-[-0.06em]">404</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.03em] text-white md:text-4xl">{t('product.not_found_title')}</h1>
          <p className="mt-3 text-white/60">{t('product.not_found_desc')}</p>
          <Link to="/annunci" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#c6ff3d] px-6 font-black text-[#10140a] transition hover:brightness-110">
            {t('product.not_found_cta')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const imgs = listingImages(listing);
  const isAuction = Boolean(listing.is_auction || listing.type === 'auction');
  const mode = isAuction ? MARKET_MODES.auctions : MARKET_MODES.listings;
  const accent = mode.accent;
  const productType = listing.product_type || 'lego';
  const isLegoListing = productType === 'lego';
  const categorySlug = CATEGORY_SLUGS[productType];
  const game = productType === 'tcg' ? MARKET_CARD_GAMES.find((g) => g.slug === listing.game) : null;
  const categoryName = productType === 'tcg' ? t('hubs.categories.carte_name') : productType === 'funko' ? 'Funko Pop!' : 'LEGO';

  const ended = isAuction && (listing.status === 'expired' || listing.status === 'sold' || (listing.auction_end && countdown.done));
  const isSold = listing.status === 'sold';
  const inCart = cart.some((item) => item.id === listing.id);

  const condition = listing.condition || null;
  const conditionLabel = condition ? t(`details.condition_${String(condition).toLowerCase()}`, { defaultValue: condition }) : null;

  const shippingCostNum = parseFloat(listing.shipping_cost);
  const hasShippingFee = Number.isFinite(shippingCostNum) && shippingCostNum > 0;

  const seller = listing.seller || { username: t('details.unknown_seller'), is_pro: false, country: 'it' };
  const sellerRating = parseFloat(seller.rating_average) || parseFloat(seller.rating_avg) || parseFloat(seller.stars) || 0;
  const fmt = (v) => formatEUR(v, i18n.language);

  const subtitle = productType === 'tcg'
    ? GAME_NAMES[listing.game] || game?.name || listing.theme
    : isLegoListing && listing.set_number
      ? `${t('details.set_number_prefix')} ${listing.set_number}${listing.theme ? ` · ${listing.theme}` : ''}`
      : listing.theme;

  const dims = [listing.length_cm, listing.width_cm, listing.height_cm].map(toNumber);
  const weight = toNumber(listing.weight_kg);
  const specs = [
    conditionLabel && [t('details.condition'), conditionLabel, true],
    isLegoListing && listing.set_number && [t('product.spec_set'), listing.set_number],
    listing.theme && productType !== 'tcg' && [t('product.spec_theme'), listing.theme],
    game && [t('product.spec_game'), GAME_NAMES[listing.game] || game.name],
    listing.year && [t('product.spec_year'), listing.year],
    toNumber(listing.pieces) && [t('product.spec_pieces'), new Intl.NumberFormat(i18n.language).format(toNumber(listing.pieces))],
    isLegoListing && [t('details.box'), listing.box_condition || t('details.not_specified')],
    isLegoListing && [t('details.instructions'), listing.instructions || t('details.not_specified')],
    dims.every(Boolean) && [
      t('product.spec_package'),
      `${dims.map((n) => new Intl.NumberFormat(i18n.language).format(n)).join(' × ')} cm${weight ? ` · ${new Intl.NumberFormat(i18n.language).format(weight)} kg` : ''}`,
    ],
  ].filter(Boolean);

  const badge = isAuction ? (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${ended ? 'bg-white/15 text-white' : 'bg-[#ff5a36] text-white'}`}>
      {!ended && <span className="lx-ping h-1.5 w-1.5 rounded-full bg-white" />}
      {ended ? t('auction.ended') : t('product.kicker_live')}
    </span>
  ) : isSold ? (
    <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white">{t('status.sold')}</span>
  ) : listing.is_featured ? (
    <span className="flex items-center gap-1.5 rounded-full bg-[#c6ff3d] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#10140a]">
      <Sparkles className="h-3 w-3" />
      {t('landing.listings.featured')}
    </span>
  ) : null;

  const focusBid = () => {
    bidPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => bidInputRef.current?.focus({ preventScroll: true }), 450);
  };

  const buyButton = isSold ? (
    <button type="button" disabled className="flex h-14 w-full items-center justify-center rounded-2xl bg-white/10 text-base font-black uppercase text-white/50">
      {t('status.sold')}
    </button>
  ) : inCart ? (
    <Link to="/cart" className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 text-base font-black text-white transition hover:bg-white/5" style={{ borderColor: accent }}>
      <ShoppingCart className="h-5 w-5" style={{ color: accent }} />
      {t('product.in_cart')}
      <ArrowRight className="h-4 w-4" />
    </Link>
  ) : (
    <button
      type="button"
      onClick={handleAddToCart}
      className="lx-shine relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-black shadow-[0_18px_40px_-14px_rgba(198,255,61,0.65)] transition hover:brightness-110"
      style={{ background: accent, color: mode.accentInk }}
    >
      <ShoppingCart className="h-5 w-5" />
      {user ? t('cart.add') : t('product.login_to_buy')}
    </button>
  );

  return (
    <div className="lx-page pb-20 lg:pb-0">
      {/* ambient backdrop from the product photo */}
      <div
        className="lx-bleed pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden"
        style={{ maskImage: 'linear-gradient(to bottom, #000 55%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, #000 55%, transparent)' }}
        aria-hidden
      >
        <img src={cldImage(imgs[0], 80)} alt="" className="h-full w-full scale-110 object-cover opacity-[0.22] blur-[90px] saturate-150" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#07060b]/60 to-[#07060b]" />
        <div className="lx-grid absolute inset-0 opacity-40" />
      </div>

      <div className="relative mx-auto max-w-[1320px] px-4 pt-20 md:px-10 lg:pt-24">
        {/* breadcrumb */}
        <nav className="mb-4 flex flex-wrap items-center gap-x-2 text-[13px] font-semibold text-white/50" aria-label="breadcrumb">
          <Link to={mode.base} className="inline-flex min-h-10 items-center transition hover:text-white">{t(isAuction ? 'nav.auctions' : 'nav.listings')}</Link>
          {categorySlug && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-white/25" />
              <Link to={`${mode.base}/${categorySlug}`} className="inline-flex min-h-10 items-center transition hover:text-white">{categoryName}</Link>
            </>
          )}
          {game && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-white/25" />
              <Link to={`${mode.base}/${categorySlug}/${game.slug}`} className="inline-flex min-h-10 items-center transition hover:text-white">{GAME_NAMES[game.slug] || game.name}</Link>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <motion.div initial={{ y: 24 }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="min-w-0">
            <Gallery images={imgs} title={listing.title} accent={accent} badge={badge} />
          </motion.div>

          <div className="min-w-0 lg:sticky lg:top-24">
            <motion.div initial={{ y: 24 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}>
              <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: accent }}>
                {isAuction ? t('product.kicker_auction') : t('product.kicker_listing')}
                {subtitle ? <span className="text-white/45"> · {subtitle}</span> : null}
              </p>
              <h1 className="mt-3 break-words text-[clamp(2.1rem,5.2vw,4rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">
                {listing.title}
              </h1>

              {/* action card */}
              <div ref={bidPanelRef} className="relative mt-7 overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6">
                <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: accent }} />
                <div className="relative space-y-6">
                  {isAuction ? (
                    <>
                      <CountdownBlocks endDate={listing.status === 'active' ? listing.auction_end : null} accent={accent} />
                      <BidBox
                        listing={listing}
                        user={user}
                        accent={accent}
                        ended={ended}
                        onBid={handlePlaceBid}
                        bidLoading={bidLoading}
                        inputRef={bidInputRef}
                      />
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/50">{t('product.price')}</p>
                        <p className="mt-1 break-words text-[clamp(2.6rem,6.5vw,3.8rem)] font-black leading-none tracking-[-0.045em]" style={{ color: accent }}>
                          {fmt(listing.price)}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white/60">
                          {hasShippingFee ? t('product.shipping_plus', { price: fmt(shippingCostNum) }) : (
                            <span className="text-[#c6ff3d]">{t('details.free_shipping')}</span>
                          )}
                        </p>
                      </div>
                      {buyButton}
                    </>
                  )}

                  <ul className="grid grid-cols-1 gap-2 border-t border-white/10 pt-5 text-sm text-white/65 sm:grid-cols-2">
                    <li className="flex items-center gap-2.5">
                      <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: accent }} />
                      {t('product.trust_payment')}
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Truck className="h-4 w-4 shrink-0" style={{ color: accent }} />
                      {listing.shipping_method || t('product.trust_shipping')}
                    </li>
                    {listing.location && (
                      <li className="flex items-center gap-2.5">
                        <MapPin className="h-4 w-4 shrink-0" style={{ color: accent }} />
                        {t('product.ships_from', { place: listing.location })}
                      </li>
                    )}
                    {listing.views_count > 0 && (
                      <li className="flex items-center gap-2.5">
                        <Eye className="h-4 w-4 shrink-0" style={{ color: accent }} />
                        {t('product.views', { count: listing.views_count })}
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* seller */}
              <Link
                to={`/user/${seller.username}`}
                className="group mt-4 flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.06]"
              >
                {seller.avatar_url ? (
                  <img src={cldImage(seller.avatar_url, 120)} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-black uppercase" style={{ background: `${accent}22`, color: accent }}>
                    {String(seller.username || '?').slice(0, 1)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">{t('product.seller')}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-base font-black text-white">{seller.company_name || seller.username}</span>
                    {seller.is_verified && <BadgeCheck className="h-4 w-4 text-[#22d3ee]" />}
                    {seller.is_pro && <span className="rounded bg-[#eab308] px-1.5 py-0.5 text-[10px] font-black text-black">PRO</span>}
                    <SellerTypeBadge sellerType={seller.seller_type} />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <BrickRating value={sellerRating} interactive={false} />
                    {seller.rating_count ? <span className="text-xs text-white/45">({seller.rating_count})</span> : null}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </Link>
            </motion.div>
          </div>
        </div>

        {/* details */}
        <div className="grid grid-cols-1 gap-6 py-16 md:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <section className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: accent }}>{t('product.story_kicker')}</p>
            <h2 className="mt-2 text-[clamp(1.9rem,4.5vw,3.2rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('details.description')}</h2>
            <p className="mt-6 whitespace-pre-line break-words text-base leading-relaxed text-white/70 md:text-lg">
              {listing.description || t('details.no_description')}
            </p>
          </section>

          {specs.length > 0 && (
            <section className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: accent }}>{t('product.specs_kicker')}</p>
              <h2 className="mt-2 text-[clamp(1.9rem,4.5vw,3.2rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('product.specs_title')}</h2>
              <dl className="mt-6 grid grid-cols-2 gap-2.5">
                {specs.map(([label, value, highlight]) => (
                  <div key={label} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-white/40">{label}</dt>
                    <dd className="mt-1.5 break-words text-[15px] font-black text-white" style={highlight ? { color: accent } : undefined}>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>

      <Related listing={listing} mode={mode} />

      {/* mobile action bar */}
      {!(isAuction && ended) && !isSold && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07060b]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold uppercase tracking-wider text-white/45">
                {isAuction ? (listing.bids_count > 0 ? t('auction.current_bid') : t('product.starting_price')) : t('product.price')}
              </p>
              <p className="truncate text-xl font-black leading-tight text-white">
                {isAuction ? fmt(listing.bids_count > 0 ? listing.current_bid : (listing.starting_price ?? listing.auction_start)) : fmt(listing.price)}
              </p>
            </div>
            {isAuction ? (
              <button
                type="button"
                onClick={user ? focusBid : () => navigate('/login', { state: { from: location } })}
                className="flex h-12 shrink-0 items-center gap-2 rounded-2xl px-5 text-sm font-black text-white"
                style={{ background: accent }}
              >
                <Gavel className="h-4 w-4" />
                {user ? t('auction.place_bid') : t('nav.login')}
              </button>
            ) : inCart ? (
              <Link to="/cart" className="flex h-12 shrink-0 items-center gap-2 rounded-2xl border-2 px-5 text-sm font-black text-white" style={{ borderColor: accent }}>
                {t('product.in_cart')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleAddToCart}
                className="flex h-12 shrink-0 items-center gap-2 rounded-2xl px-5 text-sm font-black"
                style={{ background: accent, color: mode.accentInk }}
              >
                <ShoppingCart className="h-4 w-4" />
                {user ? t('product.add_short') : t('nav.login')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
