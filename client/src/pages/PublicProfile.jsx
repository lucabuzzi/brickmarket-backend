import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch, normalizeImageUrl } from '../api';
import {
  Users,
  MapPin,
  ShieldCheck,
  Calendar,
  Crown,
  ArrowLeft,
  Package,
  ShoppingBag,
  Star,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BrickRating from '../components/BrickRating';
import ListingCard from '../components/ListingCard';
import SellerTypeBadge from '../components/SellerTypeBadge';

export default function PublicProfile() {
  const { t } = useTranslation();
  const { username } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const REVIEWS_PER_PAGE = 5;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/users/profile/${username}`);
        if (!cancelled) {
          setData(res);
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
  }, [username]);

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

  if (loading) return (
    <div className="page" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <p className="muted animate-pulse">{t('public_profile.loading_profile', { username })}</p>
    </div>
  );

  if (error || !data) return (
    <div className="page" style={{ padding: '2rem', textAlign: 'center' }}>
      <div className="error-banner" style={{ display: 'inline-block', marginBottom: '2rem' }}>{error || t('public_profile.user_not_found')}</div>
      <br />
      <Link to="/ricerca-utente" className="btn btn--secondary">
        <ArrowLeft size={18} /> {t('public_profile.back_to_search')}
      </Link>
    </div>
  );

  const { user, listings } = data;
  const joinDate = new Date(user.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  // ── Dynamic badge logic (same inclusive thresholds as ListingCard) ─────────
  const ratingAvg   = parseFloat(user.rating_avg || 0);
  const salesCount  = parseInt(user.sales_count || 0, 10);
  const ratingCount = parseInt(user.rating_count || 0, 10);
  const isLegendary = ratingAvg >= 4.8 && salesCount >= 10;
  const isNewUser   = ratingCount === 0;


  return (
    <div className="page profile-page" style={{ paddingTop: '1rem' }}>
      
      {/* ── Header / Hero ───────────────────────────────────── */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '2rem',
        marginBottom: '3rem',
        backgroundColor: '#120f0a',
        padding: '2.5rem',
        borderRadius: '24px',
        border: '1px solid #292524',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <div style={{ 
              width: '140px', 
              height: '140px', 
              borderRadius: '50%', 
              overflow: 'hidden', 
              border: '4px solid #44403c',
              backgroundColor: '#292524'
            }}>
              {user.avatar_url ? (
                <img src={normalizeImageUrl(user.avatar_url)} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#44403c' }}>
                  <Users size={64} />
                </div>
              )}
            </div>
            {user.is_verified && (
              <div style={{ 
                position: 'absolute', 
                bottom: '5px', 
                right: '5px', 
                backgroundColor: '#d4af37', 
                borderRadius: '50%', 
                width: '36px', 
                height: '36px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#120f0a',
                border: '4px solid #120f0a'
              }} title="Identità Verificata">
                <ShieldCheck size={20} strokeWidth={2.5} />
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: '900', color: '#fff' }}>{user.username}</h1>

              {/* LEGENDARY badge — emerald glow, top priority */}
              {isLegendary && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  background: 'linear-gradient(90deg, #059669, #10b981)',
                  color: '#fff',
                  padding: '0.25rem 0.7rem', borderRadius: '8px',
                  fontSize: '0.8rem', fontWeight: '900', letterSpacing: '0.5px',
                  boxShadow: '0 0 14px 3px rgba(16, 185, 129, 0.45)',
                }} title="Legendary Seller: rating ≥ 4.8 e 10+ vendite">
                  <Crown size={14} strokeWidth={3} /> ★ LEGENDARY
                </div>
              )}

              {/* PRO badge — gold */}
              {user.is_pro && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  backgroundColor: '#eab308', color: '#000',
                  padding: '0.2rem 0.6rem', borderRadius: '6px',
                  fontSize: '0.8rem', fontWeight: '900', letterSpacing: '0.5px'
                }}>
                  <Crown size={14} strokeWidth={3} /> PRO
                </div>
              )}

              {/* VERIFIED badge — blue (distinct from PRO) */}
              {user.is_verified && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  backgroundColor: '#bf9a2e', color: '#fff',
                  padding: '0.2rem 0.6rem', borderRadius: '6px',
                  fontSize: '0.8rem', fontWeight: '900', letterSpacing: '0.5px'
                }} title="Identità Verificata">
                  <ShieldCheck size={14} strokeWidth={3} /> VERIFIED
                </div>
              )}

              {/* NEW USER badge — grey, only when no positive badge applies */}
              {isNewUser && !user.is_pro && !user.is_verified && !isLegendary && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  backgroundColor: '#44403c', color: '#a8a29e',
                  padding: '0.2rem 0.6rem', borderRadius: '6px',
                  fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.5px'
                }} title="Nuovo membro: nessuna transazione ancora">
                  NUOVO UTENTE
                </div>
              )}

              <SellerTypeBadge sellerType={user.seller_type} className="!text-[0.75rem] !py-1" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', color: '#a8a29e', fontSize: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MapPin size={18} />
                {user.city}, {user.address_country?.toUpperCase()}
                <span className={`fi fi-${user.address_country?.toLowerCase()}`} style={{ borderRadius: '2px', marginLeft: '0.2rem' }}></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={18} />
                {t('public_profile.member_since', { date: joinDate })}
              </div>
            </div>

            {user.bio && (
              <p style={{ marginTop: '1.5rem', color: '#d6d3d1', lineHeight: '1.6', maxWidth: '600px' }}>
                {user.bio}
              </p>
            )}
          </div>

          {/* Trust Box */}
          <div style={{ 
            backgroundColor: '#292524', 
            padding: '1.5rem 2rem', 
            borderRadius: '16px', 
            textAlign: 'center',
            border: '1px solid #44403c',
            minWidth: '200px'
          }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: '#78716c', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {t('public_profile.seller_trust_label')}
            </h4>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <BrickRating value={parseFloat(user.rating_avg) || 0} size={24} interactive={false} />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff' }}>
              {user.rating_avg} <span style={{ fontSize: '0.9rem', color: '#a8a29e', fontWeight: '400' }}>/ 5</span>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', color: '#d4af37', fontSize: '0.8rem', fontWeight: '700' }}>
              {t('public_profile.feedback_received', { count: user.rating_count })}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #292524', marginBottom: '2.5rem' }}>
        {[
          { id: 'active', label: t('public_profile.tab_active'), icon: Package, count: listings.active.length },
          { id: 'sold', label: t('public_profile.tab_sold'), icon: ShoppingBag, count: listings.sold.length },
          { id: 'reviews', label: t('public_profile.tab_reviews'), icon: Star, count: user.rating_count }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '1rem 0.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #d4af37' : '2px solid transparent',
              color: activeTab === tab.id ? '#d4af37' : '#78716c',
              fontWeight: '700',
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              transition: 'all 0.2s',
              marginBottom: '-1px'
            }}
          >
            <tab.icon size={20} />
            {tab.label}
            <span style={{ 
              fontSize: '0.75rem', 
              backgroundColor: activeTab === tab.id ? 'rgba(212,175,55,0.1)' : 'rgba(22, 19, 14, 0.5)',
              padding: '0.1rem 0.5rem',
              borderRadius: '10px'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────── */}
      <div style={{ minHeight: '300px' }}>
        {activeTab === 'active' && (
          <>
            {listings.active.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 0', color: '#57534e' }}>
                <Package size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>{t('public_profile.no_active_listings')}</p>
              </div>
            ) : (
              <ul className="cards-grid">
                {listings.active.map(l => (
                  <ListingCard key={l.id} l={{ ...l, seller_username: user.username, seller_is_pro: user.is_pro, seller_is_verified: user.is_verified, seller_rating_avg: user.rating_avg, seller_sales_count: user.sales_count, seller_rating_count: user.rating_count }} />
                ))}
              </ul>
            )}
          </>
        )}

        {activeTab === 'sold' && (
          <>
            {listings.sold.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 0', color: '#57534e' }}>
                <ShoppingBag size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>{t('public_profile.no_sold_items')}</p>
              </div>
            ) : (
              <div style={{ filter: 'grayscale(0.8)', opacity: 0.7 }}>
                <ul className="cards-grid">
                  {listings.sold.map(l => (
                    <ListingCard key={l.id} l={{ ...l, seller_username: user.username, seller_is_pro: user.is_pro, seller_is_verified: user.is_verified, seller_rating_avg: user.rating_avg, seller_sales_count: user.sales_count, seller_rating_count: user.rating_count }} />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {activeTab === 'reviews' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 0', color: '#57534e', backgroundColor: '#120f0a', borderRadius: '16px', border: '1px solid #292524' }}>
                <Star size={48} style={{ marginBottom: '1rem', color: '#ca8a04', opacity: 0.4 }} />
                <h3 style={{ color: '#e7e5e4', margin: '0 0 0.5rem 0' }}>{t('public_profile.no_reviews_title')}</h3>
                <p style={{ maxWidth: '360px', margin: '0 auto', fontSize: '0.9rem' }}>
                  {t('public_profile.no_reviews_subtitle')}
                </p>
              </div>
            ) : (
              <>
                {reviews.slice(0, reviewsPage * REVIEWS_PER_PAGE).map(review => {
                  const date = new Date(review.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
                  const avatarSrc = review.reviewer_avatar ? normalizeImageUrl(review.reviewer_avatar) : null;
                  return (
                    <div key={review.id} style={{
                      backgroundColor: '#120f0a', border: '1px solid #292524',
                      borderRadius: '16px', padding: '1.25rem 1.5rem',
                      display: 'flex', flexDirection: 'column', gap: '0.75rem',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#44403c'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#292524'}
                    >
                      {/* Row 1: reviewer identity + date */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {/* Avatar */}
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                          backgroundColor: '#292524', border: '2px solid #44403c',
                          overflow: 'hidden', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '1rem', color: '#78716c',
                        }}>
                          {avatarSrc
                            ? <img src={avatarSrc} alt={review.reviewer_username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : review.reviewer_username?.[0]?.toUpperCase()
                          }
                        </div>
                        {/* Name + date */}
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: '700', color: '#f5f5f4', fontSize: '0.95rem' }}>
                            {review.reviewer_username}
                          </span>
                          <span style={{ color: '#57534e', fontSize: '0.75rem', marginLeft: '0.75rem' }}>{date}</span>
                        </div>
                        {/* Stars */}
                        <BrickRating value={review.rating} interactive={false} />
                      </div>

                      {/* Row 2: listing context */}
                      {review.listing_title && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Package size={12} color="#57534e" />
                          <span style={{ fontSize: '0.75rem', color: '#57534e' }}>
                            {review.listing_set_number && <span style={{ color: '#d4af37', marginRight: '0.3rem' }}>{review.listing_set_number}</span>}
                            {review.listing_title}
                          </span>
                        </div>
                      )}

                      {/* Row 3: comment */}
                      {review.comment && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <MessageSquare size={14} color="#44403c" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <p style={{ margin: 0, color: '#d6d3d1', fontSize: '0.9rem', lineHeight: '1.5' }}>
                            {review.comment}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Load more button */}
                {reviews.length > reviewsPage * REVIEWS_PER_PAGE && (
                  <button
                    onClick={() => setReviewsPage(p => p + 1)}
                    style={{
                      width: '100%', padding: '0.75rem',
                      backgroundColor: 'transparent', border: '1px solid #292524',
                      borderRadius: '12px', color: '#78716c', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#44403c'; e.currentTarget.style.color = '#a8a29e'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#292524'; e.currentTarget.style.color = '#78716c'; }}
                  >
                    <ChevronDown size={16} /> {t('public_profile.load_more_reviews')}
                  </button>
                )}

                {/* Load all from API if only preview was loaded */}
                {reviews.length <= 5 && data?.user?.rating_count > 5 && (
                  <button
                    onClick={loadMoreReviews}
                    disabled={reviewsLoading}
                    style={{
                      width: '100%', padding: '0.75rem',
                      backgroundColor: 'transparent', border: '1px dashed #292524',
                      borderRadius: '12px', color: '#d4af37', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      fontSize: '0.85rem', fontWeight: '600',
                    }}
                  >
                    {reviewsLoading ? t('ui.loading') : <><ChevronDown size={16} /> {t('public_profile.show_all_reviews', { count: data.user.rating_count })}</>}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: '4rem', textAlign: 'center' }}>
        <Link to="/ricerca-utente" className="btn btn--secondary" style={{ borderRadius: '30px', padding: '0.8rem 2rem' }}>
          <ArrowLeft size={18} /> {t('public_profile.back_to_directory')}
        </Link>
      </div>

    </div>
  );
}
