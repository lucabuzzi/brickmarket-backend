import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '../api';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // 'idle', 'loading', 'success', 'error'
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('errors.generic'));
      }

      setStatus('success');
      setMessage(data.message || t('auth.forgot_success_default'));
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="page auth-page narrow" style={{ maxWidth: '400px', margin: '4rem auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.6rem' }}>{t('auth.forgot_title')}</h1>
      <p style={{ textAlign: 'center', color: '#d6d3d1', marginBottom: '2rem', fontSize: '0.9rem' }}>
        {t('auth.forgot_subtitle')}
      </p>

      {status === 'success' ? (
        <div style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
          <strong>{t('auth.success_title')}</strong><br />
          {message}
        </div>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          <label>
            {t('auth.email_label')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t('auth.email_placeholder')}
              autoComplete="email"
            />
          </label>

          {status === 'error' && (
            <div style={{ color: '#ef4444', backgroundColor: '#450a0a', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            className="btn btn--primary"
            disabled={status === 'loading' || !email}
            style={{ width: '100%', padding: '0.75rem', marginTop: '1rem' }}
          >
            {status === 'loading' ? t('auth.forgot_sending') : t('auth.forgot_submit')}
          </button>
        </form>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid #292524', paddingTop: '1.5rem' }}>
        <p style={{ fontSize: '0.85rem', color: '#a8a29e' }}>
          {t('auth.need_help')} <a href="mailto:support@cardbrix.com" style={{ color: '#d4af37' }}>support@cardbrix.com</a>
        </p>
      </div>
    </div>
  );
}
