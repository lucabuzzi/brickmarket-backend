import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { apiFetch } from '../api';

const PAGE_SIZE = 20;

export default function Notifications() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = async (offset) => {
    const data = await apiFetch(`/api/notifications?limit=${PAGE_SIZE}&offset=${offset}`);
    const page = Array.isArray(data) ? data : [];
    setHasMore(page.length === PAGE_SIZE);
    return page;
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setRows(await fetchPage(0));
      } catch (e) {
        setError(e.message || t('notifications.load_error'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const next = await fetchPage(rows.length);
      setRows(prev => [...prev, ...next]);
    } catch (e) {
      setError(e.message || t('notifications.load_error'));
    } finally {
      setLoadingMore(false);
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications/all/read', { method: 'POST' });
      setRows(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      setError(e.message || t('notifications.load_error'));
    }
  };

  const markOneRead = async (id) => {
    setRows(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch {
      // Best-effort; a failed mark-as-read isn't worth surfacing an error for.
    }
  };

  const hasUnread = rows.some(n => !n.is_read);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#fff', fontSize: '1.6rem', margin: 0 }}>
          <Bell size={24} /> {t('notifications.pageTitle')}
        </h1>
        {hasUnread && (
          <button
            onClick={markAllRead}
            style={{
              background: 'none', border: '1px solid #d4af37', color: '#d4af37',
              borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.8rem',
              fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            {t('notifications.markAllRead')}
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#a8a29e' }}>{t('ui.loading')}</p>
      ) : rows.length === 0 ? (
        <p style={{ color: '#a8a29e' }}>{t('notifications.empty')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {rows.map(n => (
            <Link
              key={n.id}
              to={`/product/${n.listing_id}`}
              onClick={() => !n.is_read && markOneRead(n.id)}
              style={{ display: 'block', textDecoration: 'none' }}
            >
              <div style={{
                backgroundColor: n.is_read ? '#1c1917' : '#292524',
                padding: '1rem', borderRadius: '8px',
                borderLeft: `4px solid ${n.is_read ? '#44403c' : '#ef4444'}`,
                opacity: n.is_read ? 0.7 : 1,
              }}>
                <p style={{ margin: '0 0 0.35rem 0', color: n.is_read ? '#d6d3d1' : '#fff', fontSize: '1rem', fontWeight: n.is_read ? 400 : 600 }}>
                  {t(n.message_key, { item: n.listing_title, reason: n.reason })}
                </p>
                <span style={{ fontSize: '0.8rem', color: '#78716c' }}>
                  {new Date(n.created_at).toLocaleDateString('it-IT')} · {new Date(n.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </Link>
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                background: 'none', border: '1px solid #44403c', color: '#d6d3d1',
                borderRadius: '8px', padding: '0.6rem', fontSize: '0.85rem',
                fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem',
                opacity: loadingMore ? 0.6 : 1,
              }}
            >
              {loadingMore ? t('ui.loading') : t('notifications.loadMore')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
