/**
 * ReviewModal.jsx
 *
 * A Bento-style fullscreen modal that pops up after a completed transaction,
 * prompting the user to leave a rating and comment for their counterpart.
 *
 * Props:
 *   order         — { order_id, listing_title, counterpart_username, counterpart_avatar, my_role }
 *   onClose()     — called on dismiss
 *   onSubmitted() — called after a successful review submission
 */

import { useState } from 'react';
import { X, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch, normalizeImageUrl } from '../api';
import BrickRating from './BrickRating';

export default function ReviewModal({ order, onClose, onSubmitted }) {
  const { t } = useTranslation();
  const [rating, setRating]     = useState(0);
  const [comment, setComment]   = useState('');
  const [status, setStatus]     = useState('idle'); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('');

  if (!order) return null;

  const { order_id, listing_title, listing_set_number, counterpart_username, counterpart_avatar } = order;

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating === 0) {
      setErrorMsg(t('review.rating_required_error'));
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({ order_id, rating, comment }),
      });
      setStatus('success');
      setTimeout(() => {
        onSubmitted?.();
        onClose();
      }, 2000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || t('review.submit_error'));
    }
  }

  const avatarSrc = counterpart_avatar ? normalizeImageUrl(counterpart_avatar) : null;

  return (
    /* Backdrop */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Modal Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '480px',
          backgroundColor: '#120f0a',
          border: '1px solid #292524',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
          overflow: 'hidden',
          animation: 'slideInUp 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #292524',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.05) 0%, transparent 100%)',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.1em', color: '#d4af37', textTransform: 'uppercase' }}>
              {t('review.title')}
            </p>
            <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.15rem', fontWeight: '800', color: '#f8fafc' }}>
              {t('review.subtitle')}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(22, 19, 14,0.8)', border: '1px solid #44403c',
              borderRadius: '8px', width: '34px', height: '34px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#a8a29e', cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>

          {/* Counterpart identity */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '1rem', borderRadius: '12px',
            backgroundColor: '#292524', border: '1px solid #44403c',
            marginBottom: '1.5rem',
          }}>
            {/* Avatar */}
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              backgroundColor: '#44403c', overflow: 'hidden', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: '700', color: '#a8a29e',
              border: '2px solid #57534e',
            }}>
              {avatarSrc
                ? <img src={avatarSrc} alt={counterpart_username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : counterpart_username?.[0]?.toUpperCase()
              }
            </div>
            {/* Info */}
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: '800', color: '#f8fafc', fontSize: '1rem' }}>
                {counterpart_username}
              </p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#78716c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {listing_set_number && <span style={{ color: '#d4af37', marginRight: '0.4rem' }}>{listing_set_number}</span>}
                {listing_title}
              </p>
            </div>
          </div>

          {/* Success state */}
          {status === 'success' && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '0.75rem', padding: '2rem 0', textAlign: 'center',
            }}>
              <CheckCircle size={48} color="#10b981" />
              <p style={{ margin: 0, fontWeight: '700', color: '#f8fafc', fontSize: '1.1rem' }}>{t('review.success_title')}</p>
              <p style={{ margin: 0, color: '#78716c', fontSize: '0.85rem' }}>{t('review.success_subtitle')}</p>
            </div>
          )}

          {status !== 'success' && (
            <>
              {/* Star Rating */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#a8a29e', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  {t('review.your_rating')}
                </label>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <BrickRating value={rating} interactive onChange={setRating} />
                </div>
                {rating > 0 && (
                  <p style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.8rem', color: rating >= 4 ? '#10b981' : rating >= 3 ? '#eab308' : '#f87171', fontWeight: '600' }}>
                    {t(`review.rating_${rating}`)}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#a8a29e', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  {t('review.comment_label')} <span style={{ color: '#57534e', fontWeight: '400', textTransform: 'none' }}>{t('review.comment_optional')}</span>
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder={t('review.comment_placeholder', { username: counterpart_username })}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '0.75rem 1rem', borderRadius: '10px',
                    backgroundColor: '#292524', border: '1px solid #44403c',
                    color: '#f8fafc', fontSize: '0.9rem', lineHeight: '1.5',
                    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#d4af37'}
                  onBlur={e => e.target.style.borderColor = '#44403c'}
                />
                <p style={{ textAlign: 'right', margin: '0.25rem 0 0 0', fontSize: '0.65rem', color: '#57534e' }}>
                  {comment.length}/1000
                </p>
              </div>

              {/* Error */}
              {(status === 'error' || errorMsg) && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1rem', borderRadius: '8px',
                  backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
                  color: '#fca5a5', fontSize: '0.8rem', marginBottom: '1rem',
                }}>
                  <AlertCircle size={14} />
                  {errorMsg}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={status === 'submitting'}
                style={{
                  width: '100%', padding: '0.9rem',
                  backgroundColor: rating > 0 ? '#d4af37' : '#292524',
                  border: `1px solid ${rating > 0 ? '#d4af37' : '#44403c'}`,
                  borderRadius: '12px', color: rating > 0 ? '#120f0a' : '#57534e',
                  fontWeight: '800', fontSize: '0.95rem', cursor: rating > 0 ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  transition: 'all 0.2s',
                  boxShadow: rating > 0 ? '0 4px 16px rgba(212,175,55,0.25)' : 'none',
                }}
              >
                {status === 'submitting' ? (
                  <span style={{ opacity: 0.7 }}>{t('review.submitting')}</span>
                ) : (
                  <><Send size={16} /> {t('review.submit_button')}</>
                )}
              </button>
            </>
          )}
        </form>
      </div>

      {/* Slide-up keyframe injected inline once */}
      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
