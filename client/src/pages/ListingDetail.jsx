import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiFetch, API_BASE, normalizeImageUrl } from '../api';
import { MOCK_LISTINGS } from '../utils/mockData';
import { ShoppingCart, LayoutGrid, Hammer, Timer, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from 'react-i18next';
import BrickRating from '../components/BrickRating';
import { useToast } from '../context/ToastContext';

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
  const [bidError, setBidError] = useState('');
  
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
      toast.error("Numero non valido. Inserisci un importo corretto.");
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
            setError(e.message || 'Annuncio non trovato');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
    
    let text = `${days}g ${hours}h ${minutes}m ${seconds}s`;
    let color = '#fff';
    let pulse = false;
    let bold = false;
    
    if (days === 0 && hours === 0 && minutes < 5) {
       color = '#ef4444'; // Red
       pulse = true;
       bold = true;
    } else if (days === 0 && hours < 1) {
       color = '#fb923c'; // Orange
       bold = true;
    } else {
       color = '#22d3ee'; // Cyan
    }
    
    return { text, color, pulse, bold };
  };

  if (loading) return <p className="muted" style={{ padding: '2rem' }}>{t('errors.loading_error')}…</p>;
  if (error || !listing) return <p className="error-banner" style={{ margin: '2rem' }}>{error || 'Non trovato'}</p>;

  const imgs = listingImage(listing);
  const theme = listing.theme || listing.category || 'Generico';
  const setNumber = listing.set_number || 'N/A';
  
  const condition = listing.condition || 'Nuovo';
  const boxCond = listing.box_condition || (condition.includes('Nuovo') ? 'Originale' : 'Non specificata');
  const instructions = listing.instructions || (condition.includes('Nuovo') ? 'Presenti' : 'Non specificato');

  const seller = listing.seller || { username: 'Venditore Anonimo', is_pro: false, country: 'it', rating: '0 Feedback', stars: 0 };
  const isAuction = listing.is_auction || listing.type === 'auction';

  return (
    <div className="page listing-detail">
      
      {/* Breadcrumbs */}
      <nav className="breadcrumb" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', fontSize: '0.9rem', color: '#94a3b8' }}>
        <Link to="/" style={{ color: '#38bdf8' }}>Home</Link>
        <span aria-hidden>&rsaquo;</span>
        <Link to={`/theme/${theme.toLowerCase().replace(' ', '-')}`} style={{ color: '#38bdf8' }}>{theme}</Link>
        <span aria-hidden>&rsaquo;</span>
        <span style={{ color: '#e2e8f0', fontWeight: '500' }}>{listing.title}</span>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: '2.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Gallery */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155', backgroundColor: '#0f172a' }}>
            <img src={mainImage} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          
          {imgs.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {imgs.map((src, i) => (
                <div 
                   key={i} 
                   onClick={() => setMainImage(src)}
                   style={{ width: '80px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: mainImage === src ? '2px solid #38bdf8' : '2px solid #334155', cursor: 'pointer', flexShrink: 0, opacity: mainImage === src ? 1 : 0.6, transition: 'all 0.2s' }}
                >
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}

          {/* Description Section */}
          <div style={{ marginTop: '2rem', backgroundColor: '#1e293b', padding: '2rem', borderRadius: '12px', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '1.4rem', marginTop: 0, marginBottom: '1rem', color: '#fff', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>{t('details.description')}</h2>
            <p style={{ color: '#cbd5e1', lineHeight: '1.6', whiteSpace: 'pre-line' }}>{listing.description || 'Il venditore non ha fornito una descrizione dettagliata.'}</p>
          </div>
        </div>

        {/* Right Column: Interaction Card */}
        <div style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Main Purchase/Bid Card */}
          <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
            
            {/* Header: Title & Auction Badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <h1 style={{ fontSize: '1.6rem', margin: 0, lineHeight: '1.2', color: '#fff', flex: 1 }}>{listing.title}</h1>
              {isAuction && (
                <span style={{ 
                  backgroundColor: '#f59e0b', 
                  color: '#000', 
                  padding: '0.2rem 0.6rem', 
                  borderRadius: '6px', 
                  fontSize: '0.75rem', 
                  fontWeight: '900',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginLeft: '0.5rem'
                }}>
                  <Hammer size={12} />
                  {t('nav.auction')}
                  {!isEnded && listing.status === 'active' && (
                     <div style={{
                       width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%',
                       boxShadow: '0 0 4px #ef4444', animation: 'pulse 1.5s infinite'
                     }} />
                  )}
                </span>
              )}
            </div>
            <p style={{ fontFamily: 'monospace', color: '#94a3b8', margin: '0 0 1.5rem 0', fontSize: '0.9rem' }}>Set N° {setNumber}</p>
            
            {isAuction ? (
              /* Auction View */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                <div style={{ backgroundColor: '#0f172a', padding: '1rem', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{t('auction.current_bid')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8' }}>
                      <TrendingUp size={16} />
                      <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{listing.bids_count || 0} {listing.bids_count === 1 ? 'offerta' : 'offerte'}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#fff' }}>
                    {formatPrice(listing.current_bid || listing.starting_price || listing.auction_start)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: (isEnded ? '#ef4444' : '#fbbf24'), fontSize: '0.95rem', fontWeight: '600' }}>
                  <Timer size={18} />
                  {listing.auction_end && (
                    <span style={{
                      color: formatTimeInfo().color,
                      fontWeight: formatTimeInfo().bold ? 'bold' : 'normal',
                      animation: formatTimeInfo().pulse ? 'pulse 1.5s infinite' : 'none'
                    }}>
                      {isEnded ? t('auction.ended') : `${t('auction.ends_in')}: ${formatTimeInfo().text}`}
                    </span>
                  )}
                </div>

                {isEnded ? (
                   <div style={{ marginTop: '1rem', padding: '1.5rem', backgroundColor: '#052e16', border: '1px solid #10b981', borderRadius: '8px', textAlign: 'center' }}>
                     <h3 style={{ color: '#34d399', margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>{t('auction.ended')}</h3>
                     {listing.bids_count > 0 && listing.highest_bidder_username ? (
                       <p style={{ color: '#a7f3d0', margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>
                         {t('auction.winning_bid', { username: listing.highest_bidder_username, amount: formatPrice(listing.current_bid) })}
                       </p>
                     ) : (
                       <p style={{ color: '#a7f3d0', margin: 0 }}>Nessun vincitore</p>
                     )}
                   </div>
                ) : user && user.id === listing.seller_id ? (
                  <p style={{ margin: '1rem 0', textAlign: 'center', fontSize: '0.9rem', color: '#ef4444', fontWeight: 'bold' }}>
                    Non puoi fare offerte sui tuoi annunci.
                  </p>
                ) : user ? (
                <form onSubmit={handlePlaceBid} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text"
                      placeholder="0.00 €"
                      value={bidAmount}
                      onChange={e => setBidAmount(e.target.value)}
                      required
                      style={{ 
                        width: '100%', 
                        padding: '0.85rem 1rem', 
                        backgroundColor: '#0f172a', 
                        border: '2px solid #334155', 
                        borderRadius: '8px', 
                        color: '#fff',
                        fontSize: '1.1rem',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={bidLoading || listing.status !== 'active'}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#38bdf8', 
                      color: '#0f172a', 
                      border: 'none', 
                      padding: '1rem', 
                      borderRadius: '8px', 
                      fontSize: '1.1rem', 
                      fontWeight: 'bold', 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)'
                    }}
                    onMouseOver={e => !bidLoading && (e.currentTarget.style.backgroundColor = '#7dd3fc')}
                    onMouseOut={e => !bidLoading && (e.currentTarget.style.backgroundColor = '#38bdf8')}
                  >
                    {bidLoading ? 'Invio...' : t('auction.place_bid')}
                  </button>
                </form>
                ) : null}

                 {!user && !isEnded && (
                  <p style={{ margin: '0', textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
                    {t('auth.no_account')} <Link to="/login" style={{ color: '#38bdf8' }}>{t('nav.login')}</Link>
                  </p>
                )}

              </div>
            ) : (
              /* Fixed Price View */
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '1.5rem' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: '800', color: '#38bdf8' }}>{formatPrice(listing.price)}</span>
                  {listing.shipping_cost && <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>+ {formatPrice(listing.shipping_cost)} {t('shipping.cost')}</span>}
                </div>

                {listing.status === 'sold' ? (
                  <button 
                    disabled
                    style={{ width: '100%', backgroundColor: '#475569', color: '#94a3b8', border: 'none', padding: '1rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'not-allowed' }}
                  >
                    {t('status.sold').toUpperCase()}
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={handleAddToCart}
                      style={{ width: '100%', backgroundColor: '#f97316', color: '#fff', border: 'none', padding: '1rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'background-color 0.2s', boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)' }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#ea580c'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = '#f97316'}
                    >
                      <ShoppingCart size={22} />
                      {t('cart.add')}
                    </button>
                    {!user && (
                      <p style={{ margin: '0.75rem 0 0 0', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>
                        {t('auth.no_account')} <Link to="/login" style={{ color: '#38bdf8' }}>{t('nav.login')}</Link>
                      </p>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Condition Info Box */}
          <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#e2e8f0', fontSize: '1.1rem' }}>{t('details.info')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('details.condition')}</span>
                <span style={{ backgroundColor: condition.includes('Nuovo') ? '#064e3b' : '#713f12', color: condition.includes('Nuovo') ? '#34d399' : '#fef08a', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>{condition}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('details.box')}</span>
                <span style={{ backgroundColor: boxCond.includes('Originale') ? '#1e3a8a' : '#450a0a', color: boxCond.includes('Originale') ? '#93c5fd' : '#fca5a5', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>{boxCond}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{t('details.instructions')}</span>
                <span style={{ backgroundColor: instructions.includes('Presenti') ? '#1e3a8a' : '#450a0a', color: instructions.includes('Presenti') ? '#93c5fd' : '#fca5a5', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>{instructions}</span>
              </div>

            </div>
          </div>

          {/* Seller Trust Box */}
          <div style={{ backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '12px', border: '1px solid #38bdf8' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#e2e8f0', fontSize: '1.1rem' }}>{t('details.seller_info')}</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`fi fi-${seller.country}`} style={{ fontSize: '1.5rem', borderRadius: '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }}></span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>{seller.username}</span>
                    {seller.is_pro && (
                      <span style={{ backgroundColor: '#eab308', color: '#000', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>PRO</span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <BrickRating value={parseFloat(seller.rating_average) || parseFloat(seller.rating_avg) || parseFloat(seller.stars) || 0} interactive={false} />
                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: '0.2rem' }}>({seller.rating_count || 0})</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'center' }}>
               <Link to={`/user/${seller.username}`} style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: '500', textDecoration: 'none' }}>
                 {t('details.view_all_seller')} &rsaquo;
               </Link>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
