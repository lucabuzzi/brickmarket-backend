import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { apiFetch } from '../api';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function NotificationBell({ onNewNotification }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const pollUnreadCount = async () => {
    if (!user) return;
    try {
      const { count } = await apiFetch('/api/notifications/unread-count');
      if (count > unreadCount && unreadCount !== 0) {
        // New notification arrived since the last poll — fetch it for the toast.
        try {
          const recent = await apiFetch('/api/notifications?limit=1');
          if (recent[0]) onNewNotification(recent[0]);
        } catch { /* toast is best-effort, badge count already updated below */ }
      }
      setUnreadCount(count);
    } catch (err) {
      console.error('Error polling unread count', err);
    }
  };

  useEffect(() => {
    pollUnreadCount();
    const interval = setInterval(pollUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [user, unreadCount]); // Dependency on unreadCount to detect changes

  const toggleDropdown = async () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (!opening) return;

    try {
      const data = await apiFetch('/api/notifications?limit=8');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching recent notifications', err);
    }

    if (unreadCount > 0) {
      try {
        await apiFetch('/api/notifications/all/read', { method: 'POST' });
        setUnreadCount(0);
        // Keep the items visible, just drop their unread highlight — don't refetch.
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      } catch (e) {
        console.error('Failed to mark notifications as read', e);
      }
    }
  };

  if (!user) return null;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button 
        onClick={toggleDropdown}
        style={{ 
          background: 'none', border: 'none', color: '#fff', cursor: 'pointer', 
          position: 'relative', display: 'flex', alignItems: 'center', padding: '0.4rem' 
        }}
        aria-label="Notifications"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '4px',
            width: '10px', height: '10px', backgroundColor: '#ef4444', 
            borderRadius: '50%', border: '2px solid #120f0a'
          }} />
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '45px', right: '0', width: '320px',
          backgroundColor: '#292524', border: '1px solid #44403c', borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 50, padding: '1rem',
          maxHeight: '400px', overflowY: 'auto',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#fff', borderBottom: '1px solid #44403c', paddingBottom: '0.5rem' }}>
            Notifiche
          </h4>
          {notifications.length === 0 ? (
            <p style={{ color: '#a8a29e', fontSize: '0.9rem', margin: 0 }}>{t('notifications.empty')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notifications.map(n => (
                <Link to={`/product/${n.listing_id}`} key={n.id} style={{ display: 'block', textDecoration: 'none' }} onClick={() => setIsOpen(false)}>
                  <div style={{
                    backgroundColor: n.is_read ? '#1c1917' : '#120f0a',
                    padding: '0.75rem', borderRadius: '6px',
                    borderLeft: `4px solid ${n.is_read ? '#44403c' : '#ef4444'}`,
                    opacity: n.is_read ? 0.65 : 1,
                  }}>
                    <p style={{ margin: '0 0 0.25rem 0', color: n.is_read ? '#d6d3d1' : '#fff', fontSize: '0.95rem', fontWeight: n.is_read ? 400 : 600 }}>
                      {t(n.message_key, { item: n.listing_title, reason: n.reason })}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: '#78716c' }}>
                      {new Date(n.created_at).toLocaleDateString('it-IT')} · {new Date(n.created_at).toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Link
            to="/notifications"
            onClick={() => setIsOpen(false)}
            style={{
              display: 'block', textAlign: 'center', marginTop: '1rem', paddingTop: '0.75rem',
              borderTop: '1px solid #44403c', color: '#d4af37', fontSize: '0.8rem',
              fontWeight: 'bold', textDecoration: 'none',
            }}
          >
            {t('notifications.viewAll')}
          </Link>
        </div>
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
