import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import {
  Pencil,
  Trash2,
  PauseCircle,
  PlayCircle,
  ExternalLink,
  Package,
  AlertCircle,
  Star,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReviewModal from '../components/ReviewModal';

function formatPrice(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function MyListings() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [activeReviewOrder, setActiveReviewOrder] = useState(null);
  const navigate = useNavigate();

  const fetchMyListings = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/listings/user/me');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || t('my_listings.load_error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingReviews = async () => {
    try {
      const data = await apiFetch('/api/reviews/pending');
      setPendingReviews(Array.isArray(data) ? data : []);
    } catch (e) {
      // Non-critical — silently ignore if the user is not logged in
      console.warn('Could not fetch pending reviews:', e.message);
    }
  };

  useEffect(() => {
    fetchMyListings();
    fetchPendingReviews();
  }, []);

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'draft' : 'active';
    try {
      setActionLoading(id);
      await apiFetch(`/api/listings/${id}`, {
        method: 'PATCH',
        body: { status: newStatus }
      });
      // Update local state instantly
      setRows(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (err) {
      alert(t('my_listings.toggle_status_error', { message: err.message }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('my_listings.confirm_delete'))) return;

    try {
      setActionLoading(id);
      await apiFetch(`/api/listings/${id}`, { method: 'DELETE' });
      // Remove from local state
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert(t('my_listings.delete_error', { message: err.message }));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800' }}>{t('my_listings.title')}</h1>
          <p className="muted" style={{ marginTop: '0.25rem' }}>{t('my_listings.subtitle')}</p>
        </div>
        <Link to="/sell" className="btn btn--primary" style={{ borderRadius: '12px', padding: '0.75rem 1.5rem' }}>
          + {t('profile.new_listing_button')}
        </Link>
      </header>

      {/* ── Pending Reviews Banner ────────────────────── */}
      {pendingReviews.length > 0 && (
        <div style={{
          marginBottom: '2rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'rgba(228,200,115,0.06)',
          border: '1px solid rgba(228,200,115,0.25)',
          borderRadius: '14px',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Star size={16} color="#eab308" fill="#eab308" />
            <span style={{ fontWeight: '700', color: '#fef08a', fontSize: '0.9rem' }}>
              {pendingReviews.length === 1
                ? t('my_listings.pending_reviews_banner_one')
                : t('my_listings.pending_reviews_banner', { count: pendingReviews.length })}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingReviews.map(order => (
              <div key={order.order_id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.75rem',
                backgroundColor: 'rgba(12, 10, 8,0.6)',
                borderRadius: '10px', gap: '1rem', flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <Package size={14} color="#78716c" />
                  <span style={{ fontSize: '0.8rem', color: '#d6d3d1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
                    <strong style={{ color: '#f5f5f4' }}>{order.counterpart_username}</strong>
                    {' · '}{order.listing_title}
                  </span>
                </div>
                <button
                  onClick={() => setActiveReviewOrder(order)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.4rem 0.9rem', borderRadius: '8px',
                    backgroundColor: '#eab308', border: 'none',
                    color: '#000', fontWeight: '700', fontSize: '0.75rem',
                    cursor: 'pointer', flexShrink: 0,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <Star size={12} fill="#000" /> {t('profile.leave_feedback_button')} <ChevronRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="error-banner" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <p className="muted animate-pulse">{t('my_listings.loading')}</p>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 2rem', backgroundColor: '#120f0a', borderRadius: '24px', border: '1px dashed #44403c' }}>
          <Package size={64} style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
          <h3 style={{ margin: 0, color: '#a8a29e' }}>{t('my_listings.empty_title')}</h3>
          <p className="muted" style={{ marginTop: '0.5rem', marginBottom: '2rem' }}>{t('my_listings.empty_subtitle')}</p>
          <Link to="/sell" className="btn btn--secondary">{t('profile.create_first_listing')}</Link>
        </div>
      ) : (
        <div style={{ backgroundColor: '#120f0a', borderRadius: '20px', border: '1px solid #292524', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#292524' }}>
              <tr>
                <th style={{ padding: '1.25rem 1.5rem', color: '#a8a29e', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>{t('my_listings.col_item')}</th>
                <th style={{ padding: '1.25rem 1.5rem', color: '#a8a29e', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>{t('my_listings.col_status')}</th>
                <th style={{ padding: '1.25rem 1.5rem', color: '#a8a29e', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>{t('my_listings.col_price')}</th>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>{t('my_listings.col_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #292524', transition: 'background-color 0.2s', opacity: actionLoading === item.id ? 0.6 : 1 }} className="dashboard-row">
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontWeight: '700', color: '#f5f5f4', fontSize: '1rem' }}>{item.title}</span>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>{t('details.set_number_prefix')} {item.set_number || 'N/A'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {item.status === 'active' ? (
                      <span className="badge badge--active">{t('my_listings.status_active')}</span>
                    ) : (
                      <span className="badge badge--inactive">{t('my_listings.status_inactive')}</span>
                    )}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', fontWeight: '600', color: '#d4af37' }}>
                    {formatPrice(item.price)}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Link
                        to={`/product/${item.id}`}
                        className="btn-icon"
                        title={t('my_listings.action_view_public')}
                        style={{ color: '#a8a29e' }}
                      >
                        <ExternalLink size={18} />
                      </Link>

                      <button
                        onClick={() => handleToggleStatus(item.id, item.status)}
                        className="btn-icon"
                        title={item.status === 'active' ? t('my_listings.action_pause') : t('my_listings.action_publish')}
                        disabled={actionLoading === item.id}
                        style={{ color: item.status === 'active' ? '#e4c159' : '#4ade80' }}
                      >
                        {item.status === 'active' ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                      </button>

                      <Link
                        to={`/sell?edit=${item.id}`}
                        className="btn-icon"
                        title={t('my_listings.action_edit')}
                        style={{ color: '#d4af37' }}
                      >
                        <Pencil size={18} />
                      </Link>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="btn-icon"
                        title={t('my_listings.action_delete')}
                        disabled={actionLoading === item.id}
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Local Styles */}
      <style>{`
        .dashboard-row:hover { background-color: rgba(22, 19, 14, 0.4); }
        .btn-icon {
          background: #292524;
          border: 1px solid #44403c;
          color: #fff;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }
        .btn-icon:hover {
          background: #44403c;
          transform: translateY(-2px);
          border-color: #57534e;
        }
        .btn-icon:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .badge {
          padding: 0.25rem 0.75rem;
          borderRadius: 20px;
          fontSize: 0.75rem;
          fontWeight: 900;
          letterSpacing: 0.5px;
          display: inline-block;
        }
        .badge--active {
          background-color: #14532d;
          color: #4ade80;
          border: 1px solid #166534;
        }
        .badge--inactive {
          background-color: #7c2d12;
          color: #e4c159;
          border: 1px solid #9a3412;
        }
      `}</style>

      {/* Review Modal */}
      {activeReviewOrder && (
        <ReviewModal
          order={activeReviewOrder}
          onClose={() => setActiveReviewOrder(null)}
          onSubmitted={() => {
            // Remove the reviewed order from the pending list
            setPendingReviews(prev => prev.filter(o => o.order_id !== activeReviewOrder.order_id));
            setActiveReviewOrder(null);
          }}
        />
      )}
    </div>
  );
}
