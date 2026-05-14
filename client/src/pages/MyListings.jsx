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
import ReviewModal from '../components/ReviewModal';

function formatPrice(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function MyListings() {
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
      setError(e.message || 'Impossibile caricare i tuoi annunci');
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
      alert('Errore: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare definitivamente questo annuncio?')) return;
    
    try {
      setActionLoading(id);
      await apiFetch(`/api/listings/${id}`, { method: 'DELETE' });
      // Remove from local state
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Errore durante la cancellazione: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800' }}>Gestione Annunci</h1>
          <p className="muted" style={{ marginTop: '0.25rem' }}>Controlla, modifica o sospendi i tuoi set LEGO in vendita.</p>
        </div>
        <Link to="/sell" className="btn btn--primary" style={{ borderRadius: '12px', padding: '0.75rem 1.5rem' }}>
          + Nuovo Annuncio
        </Link>
      </header>

      {/* ── Pending Reviews Banner ────────────────────── */}
      {pendingReviews.length > 0 && (
        <div style={{
          marginBottom: '2rem',
          padding: '1rem 1.25rem',
          backgroundColor: 'rgba(234,179,8,0.06)',
          border: '1px solid rgba(234,179,8,0.25)',
          borderRadius: '14px',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Star size={16} color="#eab308" fill="#eab308" />
            <span style={{ fontWeight: '700', color: '#fef08a', fontSize: '0.9rem' }}>
              {pendingReviews.length === 1
                ? 'Hai 1 transazione completata da recensire'
                : `Hai ${pendingReviews.length} transazioni completate da recensire`}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingReviews.map(order => (
              <div key={order.order_id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 0.75rem',
                backgroundColor: 'rgba(15,23,42,0.6)',
                borderRadius: '10px', gap: '1rem', flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                  <Package size={14} color="#64748b" />
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
                    <strong style={{ color: '#f1f5f9' }}>{order.counterpart_username}</strong>
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
                  <Star size={12} fill="#000" /> Lascia Feedback <ChevronRight size={12} />
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
          <p className="muted animate-pulse">Caricamento annunci...</p>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '5rem 2rem', backgroundColor: '#0f172a', borderRadius: '24px', border: '1px dashed #334155' }}>
          <Package size={64} style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
          <h3 style={{ margin: 0, color: '#94a3b8' }}>Non hai ancora creato nessun annuncio</h3>
          <p className="muted" style={{ marginTop: '0.5rem', marginBottom: '2rem' }}>Inizia a vendere i tuoi set LEGO oggi stesso.</p>
          <Link to="/sell" className="btn btn--secondary">Crea il tuo primo annuncio</Link>
        </div>
      ) : (
        <div style={{ backgroundColor: '#0f172a', borderRadius: '20px', border: '1px solid #1e293b', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#1e293b' }}>
              <tr>
                <th style={{ padding: '1.25rem 1.5rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Articolo</th>
                <th style={{ padding: '1.25rem 1.5rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Stato</th>
                <th style={{ padding: '1.25rem 1.5rem', color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Prezzo</th>
                <th style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #1e293b', transition: 'background-color 0.2s', opacity: actionLoading === item.id ? 0.6 : 1 }} className="dashboard-row">
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <span style={{ fontWeight: '700', color: '#f1f5f9', fontSize: '1rem' }}>{item.title}</span>
                      <span className="muted" style={{ fontSize: '0.8rem' }}>Set N° {item.set_number || 'N/A'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    {item.status === 'active' ? (
                      <span className="badge badge--active">ACTIVE</span>
                    ) : (
                      <span className="badge badge--inactive">INACTIVE</span>
                    )}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', fontWeight: '600', color: '#38bdf8' }}>
                    {formatPrice(item.price)}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Link 
                        to={`/product/${item.id}`} 
                        className="btn-icon" 
                        title="Vedi Pubblico"
                        style={{ color: '#94a3b8' }}
                      >
                        <ExternalLink size={18} />
                      </Link>
                      
                      <button 
                        onClick={() => handleToggleStatus(item.id, item.status)}
                        className="btn-icon" 
                        title={item.status === 'active' ? 'Sospendi' : 'Pubblica'}
                        disabled={actionLoading === item.id}
                        style={{ color: item.status === 'active' ? '#fb923c' : '#4ade80' }}
                      >
                        {item.status === 'active' ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                      </button>

                      <Link 
                        to={`/sell?edit=${item.id}`} 
                        className="btn-icon" 
                        title="Modifica"
                        style={{ color: '#38bdf8' }}
                      >
                        <Pencil size={18} />
                      </Link>

                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="btn-icon" 
                        title="Elimina"
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
        .dashboard-row:hover { background-color: rgba(30, 41, 59, 0.4); }
        .btn-icon {
          background: #1e293b;
          border: 1px solid #334155;
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
          background: #334155;
          transform: translateY(-2px);
          border-color: #475569;
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
          color: #fb923c;
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
