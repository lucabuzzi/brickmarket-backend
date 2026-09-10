import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiFetch, API_BASE, normalizeImageUrl } from '../api';
import { MOCK_LISTINGS } from '../utils/mockData';
import { ShoppingCart, LayoutGrid, Hammer, Timer, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from 'react-i18next';
import BrickRating from '../components/BrickRating';
import { useToast } from '../context/ToastContext';
import SellerTypeBadge from '../components/SellerTypeBadge';

function listingImage(l) {
  let rawItems = [];
  if (Array.isArray(l.images) && l.images.length) rawItems = l.images;
  else if (l.gallery && l.gallery.length) rawItems = l.gallery;
  else if (l.image_url) rawItems = [l.image_url];
  
  if (rawItems.length > 0) {
    return rawItems.map(normalizeImageUrl);
  }
  
  return ['https://picsum.photos/seed/detail/800/600'];
}

function formatPrice(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function ListingDetail() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Auction state
  const [bidAmount, setBidAmount] = useState('');
  const [bidLoading, setBidLoading] = useState(false);

  const toast = useToast();
  
  const [timeLeft, setTimeLeft] = useState(null);
  const [isEnded, setIsEnded] = useState(false);

  // Gallery state
  const [mainImage, setMainImage] = useState('');

  const handleAddToCart = () => {
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }
    addToCart(listing);
  };

  const handlePlaceBid = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: location } });
      return;
    }

    const finalAmount = parseFloat(bidAmount.replace(',', '.'));

    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error(t('auction.invalid_bid_amount'));
      return;
    }

    setBidLoading(true);

    try {
      const updated = await apiFetch(`/api/listings/${id}/bid`, {
        method: 'POST',
        body: { amount: parseFloat(bidAmount.replace(',', '.')) }
      });
      setListing(updated);
      toast.success(t('auction.bid_success') || "Offerta piazzata con successo!");
      setBidAmount('');
    } catch (err) {
      toast.error(err.message || t('auction.bid_error'));
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
        if (!cancelled) {
          setListing(data);
          setMainImage(listingImage(data)[0]);
        }
      } catch (e) {
        if (!cancelled) {
          const mockMatch = MOCK_LISTINGS.find(m => m.id === id);
          if (mockMatch) {
            setListing(mockMatch);
            setMainImage(listingImage(mockMatch)[0]);
          } else {
            setError(e.message || t('details.listing_not_found'));
          }
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
    const image = listingImage(listing)[0];

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

  useEffect(() => {
    if (!listing || (listing.type !== 'auction' && !listing.is_auction) || !listing.auction_end) return;

    if (listing.status === 'expired' || listing.status === 'sold') {
       setIsEnded(true);
       setTimeLeft(0);
       return;
    }

    if (listing.status !== 'active') return;

    let intervalId;
    const calculateTimeLeft = () => {
      const remaining = new Date(listing.auction_end).getTime() - new Date().getTime();
      if (remaining <= 0) {
        setTimeLeft(0);
        setIsEnded(true);
        if (intervalId) clearInterval(intervalId);
      } else {
        setTimeLeft(remaining);
      }
    };
    calculateTimeLeft();
    intervalId = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(intervalId);
  }, [listing]);

  const formatTimeInfo = () => {
    if (timeLeft === null) return { text: t('ui.loading'), color: '#fff', pulse: false, bold: false };
    if (isEnded) return { text: t('auction.ended'), color: '#ef4444', pulse: false, bold: true };
    
    let totalSeconds = Math.floor(timeLeft / 1000);
    const days = Math.floor(totalSeconds / 86400);
    totalSeconds -= days * 86400;
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds -= hours * 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    let text = `${days}${t('auction.days_short')} ${hours}${t('auction.hours_short')} ${minutes}${t('auction.minutes_short')} ${seconds}${t('auction.seconds_short')}`;
    let color = '#fff';
    let pulse = false;
    let bold = false;
    
    if (days === 0 && hours === 0 && minutes < 5) {
       color = '#ef4444'; // Red
       pulse = true;
       bold = true;
    } else if (days === 0 && hours < 1) {
       color = '#e4c159'; // Orange
       bold = true;
    } else {
       color = '#e4c159'; // Cyan
    }
    
    return { text, color, pulse, bold };
  };

  if (loading) {
    return (
      <div className="page listing-detail" style={{ maxWidth: '1120px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 lg:gap-8 items-start" style={{ animation: 'pulse 1.5s infinite' }}>
          <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '14px', backgroundColor: '#1c1917', border: '1px solid #292524' }} />
          <div style={{ height: '420px', borderRadius: '16px', backgroundColor: '#1c1917', border: '1px solid #292524' }} />
        </div>
      </div>
    );
  }
  if (error || !listing) return <p className="error-banner" style={{ margin: '2rem' }}>{error || t('details.listing_not_found')}</p>;

  const imgs = listingImage(listing);
  const theme = listing.theme || listing.category || 'Generico';
  const setNumber = listing.set_number || 'N/A';

  const condition = listing.condition || 'Nuovo';
  const conditionLabel = t(`details.condition_${String(condition).toLowerCase()}`, { defaultValue: condition });
  const conditionIsFresh = /nuovo|^new$|near_mint/i.test(condition);
  const boxCond = listing.box_condition || null;
  const instructions = listing.instructions || null;

  const shippingCostNum = parseFloat(listing.shipping_cost);
  const hasShippingFee = Number.isFinite(shippingCostNum) && shippingCostNum > 0;

  const seller = listing.seller || { username: t('details.unknown_seller'), is_pro: false, country: 'it', rating: '0 Feedback', stars: 0 };
  const isAuction = listing.is_auction || listing.type === 'auction';
  const isLegoListing = !listing.product_type || listing.product_type === 'lego';

  const sectionStyle = { padding: '1.25rem 1.5rem', borderTop: '1px solid #3a3531' };
  const specRow = (label, node) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <span style={{ color: '#a8a29e', fontSize: '0.9rem' }}>{label}</span>
      {node}
    </div>
  );
  const pill = (text, tone) => {
    const tones = {
      good: { bg: '#3d2f0d', fg: '#e4c159' },
      fresh: { bg: '#064e3b', fg: '#34d399' },
      muted: { bg: '#292524', fg: '#a8a29e' },
    };
    const c = tones[tone] || tones.muted;
    return <span style={{ backgroundColor: c.bg, color: c.fg, padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold' }}>{text}</span>;
  };

  return (
    <div className="page listing-detail" style={{ maxWidth: '1120px', margin: '0 auto', padding: '2rem 1rem' }}>

      {/* Breadcrumbs */}
      <nav className="breadcrumb" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', fontSize: '0.85rem', color: '#a8a29e' }}>
        <Link to="/" style={{ color: '#d4af37' }}>{t('nav.home')}</Link>
        <span aria-hidden>&rsaquo;</span>
        <Link to={`/theme/${theme.toLowerCase().replace(' ', '-')}`} style={{ color: '#d4af37' }}>{theme}</Link>
        <span aria-hidden>&rsaquo;</span>
        <span style={{ color: '#e7e5e4', fontWeight: '500', overflowWrap: 'anywhere', minWidth: 0 }}>{listing.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-6 lg:gap-8 items-start">

        {/* Left: Gallery */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }}>
          <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '14px', overflow: 'hidden', border: '1px solid #44403c', backgroundColor: '#0c0a08', padding: '0.75rem' }}>
            <img src={mainImage} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>

          {imgs.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {imgs.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMainImage(src)}
                  style={{ width: '72px', height: '56px', borderRadius: '8px', overflow: 'hidden', border: mainImage === src ? '2px solid #d4af37' : '2px solid #44403c', cursor: 'pointer', flexShrink: 0, opacity: mainImage === src ? 1 : 0.55, transition: 'all 0.2s', padding: 0, background: 'none' }}
                >
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: one cohesive buy panel */}
        <div className="lg:sticky lg:top-[100px]" style={{ minWidth: 0, backgroundColor: '#292524', border: '1px solid #44403c', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.35)' }}>

          {/* Header */}
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
              <h1 style={{ fontSize: '1.5rem', margin: 0, lineHeight: '1.25', color: '#fff' }}>{listing.title}</h1>
              {isAuction && (
                <span style={{ flexShrink: 0, backgroundColor: '#bf9a2e', color: '#000', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Hammer size={12} />
                  {t('nav.auction')}
                  {!isEnded && listing.status === 'active' && (
                    <span style={{ width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%', boxShadow: '0 0 4px #ef4444', animation: 'pulse 1.5s infinite' }} />
                  )}
                </span>
              )}
            </div>
            {isLegoListing ? (
              <p style={{ fontFamily: 'monospace', color: '#a8a29e', margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>{t('details.set_number_prefix')} {setNumber}</p>
            ) : (
              <p style={{ color: '#a8a29e', margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>{theme}</p>
            )}
          </div>

          {/* Price / auction status */}
          {isAuction ? (
            <div style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ backgroundColor: '#120f0a', padding: '1rem', borderRadius: '10px', border: '1px solid #3a3531' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ color: '#a8a29e', fontSize: '0.85rem' }}>{t('auction.current_bid')}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#d4af37', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    <TrendingUp size={15} />
                    {t('auction.bids_count', { count: listing.bids_count || 0 })}
                  </span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color: '#fff' }}>
                  {formatPrice(listing.current_bid || listing.starting_price || listing.auction_start)}
                </div>
              </div>
              {listing.auction_end && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
                  <Timer size={17} color={isEnded ? '#ef4444' : '#d4af37'} />
                  <span style={{ color: formatTimeInfo().color, fontWeight: formatTimeInfo().bold ? 'bold' : 'normal', animation: formatTimeInfo().pulse ? 'pulse 1.5s infinite' : 'none' }}>
                    {isEnded ? t('auction.ended') : `${t('auction.ends_in')}: ${formatTimeInfo().text}`}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...sectionStyle, display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '2.25rem', fontWeight: '800', color: '#d4af37', lineHeight: 1 }}>{formatPrice(listing.price)}</span>
              {hasShippingFee ? (
                <span style={{ color: '#a8a29e', fontSize: '0.9rem' }}>+ {formatPrice(shippingCostNum)} {t('shipping.cost')}</span>
              ) : (
                <span style={{ color: '#34d399', fontSize: '0.9rem', fontWeight: '600' }}>{t('details.free_shipping')}</span>
              )}
            </div>
          )}

          {/* CTA */}
          <div style={sectionStyle}>
            {isAuction ? (
              isEnded ? (
                <div style={{ padding: '1.25rem', backgroundColor: '#052e16', border: '1px solid #10b981', borderRadius: '10px', textAlign: 'center' }}>
                  <h3 style={{ color: '#34d399', margin: '0 0 0.35rem 0', fontSize: '1.15rem' }}>{t('auction.ended')}</h3>
                  {listing.bids_count > 0 && listing.highest_bidder_username ? (
                    <p style={{ color: '#a7f3d0', margin: 0, fontWeight: 'bold' }}>
                      {t('auction.winning_bid', { username: listing.highest_bidder_username, amount: formatPrice(listing.current_bid) })}
                    </p>
                  ) : (
                    <p style={{ color: '#a7f3d0', margin: 0 }}>{t('auction.no_winner')}</p>
                  )}
                </div>
              ) : user && user.id === listing.seller_id ? (
                <p style={{ margin: 0, textAlign: 'center', fontSize: '0.9rem', color: '#ef4444', fontWeight: 'bold' }}>
                  {t('auction.own_listing_no_bid')}
                </p>
              ) : user ? (
                <form onSubmit={handlePlaceBid} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder={t('auction.bid_placeholder')}
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.85rem 1rem', backgroundColor: '#120f0a', border: '2px solid #44403c', borderRadius: '8px', color: '#fff', fontSize: '1.05rem', outline: 'none' }}
                  />
                  <button
                    type="submit"
                    disabled={bidLoading || listing.status !== 'active'}
                    style={{ width: '100%', backgroundColor: '#d4af37', color: '#fff', border: 'none', padding: '0.95rem', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(212,175,55,0.3)' }}
                  >
                    {bidLoading ? t('review.submitting') : t('auction.place_bid')}
                  </button>
                </form>
              ) : (
                <p style={{ margin: 0, textAlign: 'center', fontSize: '0.85rem', color: '#a8a29e' }}>
                  {t('auth.no_account')} <Link to="/login" style={{ color: '#d4af37' }}>{t('nav.login')}</Link>
                </p>
              )
            ) : listing.status === 'sold' ? (
              <button disabled style={{ width: '100%', backgroundColor: '#57534e', color: '#a8a29e', border: 'none', padding: '1rem', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'not-allowed' }}>
                {t('status.sold').toUpperCase()}
              </button>
            ) : (
              <>
                <button
                  onClick={handleAddToCart}
                  style={{ width: '100%', backgroundColor: '#a17e22', color: '#fff', border: 'none', padding: '1rem', borderRadius: '8px', fontSize: '1.05rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'background-color 0.2s', boxShadow: '0 4px 14px rgba(161,126,34,0.4)' }}
                  onMouseOver={e => (e.currentTarget.style.backgroundColor = '#7d611b')}
                  onMouseOut={e => (e.currentTarget.style.backgroundColor = '#a17e22')}
                >
                  <ShoppingCart size={20} />
                  {t('cart.add')}
                </button>
                {!user && (
                  <p style={{ margin: '0.75rem 0 0 0', textAlign: 'center', fontSize: '0.85rem', color: '#a8a29e' }}>
                    {t('auth.no_account')} <Link to="/login" style={{ color: '#d4af37' }}>{t('nav.login')}</Link>
                  </p>
                )}
              </>
            )}
          </div>

          {/* Specs */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {specRow(t('details.condition'), pill(conditionLabel, conditionIsFresh ? 'fresh' : 'good'))}
              {isLegoListing && specRow(t('details.box'), boxCond ? pill(boxCond, 'good') : pill(t('details.not_specified'), 'muted'))}
              {isLegoListing && specRow(t('details.instructions'), instructions ? pill(instructions, 'good') : pill(t('details.not_specified'), 'muted'))}
            </div>
          </div>

          {/* Seller */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className={`fi fi-${seller.country}`} style={{ fontSize: '1.5rem', borderRadius: '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.5)', flexShrink: 0 }}></span>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.05rem' }}>{seller.username}</span>
                  {seller.is_pro && (
                    <span style={{ backgroundColor: '#eab308', color: '#000', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 'bold' }}>PRO</span>
                  )}
                  <SellerTypeBadge sellerType={seller.seller_type} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
                  <BrickRating value={parseFloat(seller.rating_average) || parseFloat(seller.rating_avg) || parseFloat(seller.stars) || 0} interactive={false} />
                  <span style={{ color: '#a8a29e', fontSize: '0.8rem' }}>({seller.rating_count || 0})</span>
                </div>
              </div>
            </div>
            <Link
              to={`/user/${seller.username}`}
              style={{ display: 'block', marginTop: '1rem', padding: '0.6rem', textAlign: 'center', borderRadius: '8px', border: '1px solid #44403c', color: '#d4af37', fontSize: '0.85rem', fontWeight: '600', textDecoration: 'none' }}
            >
              {t('details.view_all_seller')} &rsaquo;
            </Link>
          </div>
        </div>
      </div>

      {/* Description — full width, below the grid */}
      <div style={{ marginTop: '2rem', backgroundColor: '#292524', padding: '1.75rem', borderRadius: '16px', border: '1px solid #44403c' }}>
        <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '1rem', color: '#fff' }}>{t('details.description')}</h2>
        <p style={{ color: '#d6d3d1', lineHeight: '1.65', whiteSpace: 'pre-line', margin: 0 }}>{listing.description || t('details.no_description')}</p>
      </div>
    </div>
  );
}
