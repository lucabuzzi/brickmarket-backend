import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { apiFetch } from '../api';
import { useAuth } from '../auth/AuthContext';
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

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const data = await apiFetch('/api/notifications/unread');
      if (Array.isArray(data)) {
        if (data.length > unreadCount && unreadCount !== 0) {
          // Trigger toast passed down from Layout
          const newNotif = data[0];
          onNewNotification(newNotif);
        } else if (data.length > 0 && unreadCount === 0 && onNewNotification && data.length === 1) {
          // Edge case start up notification vs polling
          // For now, only show toast strictly when the count increases or is fresh.
          // We rely on polling delta for toasts.
        }
        setNotifications(data);
        setUnreadCount(data.length);
      }
    } catch (err) {
      console.error('Error fetching notifications limit', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [user, unreadCount]); // Dependency on unreadCount to detect changes

  const toggleDropdown = async () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // mark all as read when opening dropdown
      try {
        await apiFetch('/api/notifications/all/read', { method: 'POST' });
        setUnreadCount(0);
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
            borderRadius: '50%', border: '2px solid #0f172a'
          }} />
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '45px', right: '0', width: '320px',
          backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 50, padding: '1rem',
          maxHeight: '400px', overflowY: 'auto',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#fff', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
            Notifiche
          </h4>
          {notifications.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>Nessuna nuova notifica.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notifications.map(n => (
                <Link to={`/product/${n.listing_id}`} key={n.id} style={{ display: 'block', textDecoration: 'none' }} onClick={() => setIsOpen(false)}>
                  <div style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '6px', borderLeft: '4px solid #ef4444' }}>
                    <p style={{ margin: '0 0 0.25rem 0', color: '#fff', fontSize: '0.95rem' }}>
                      {t(n.message_key, { item: n.listing_title })}
                    </p>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
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
