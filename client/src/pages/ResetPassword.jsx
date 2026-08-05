import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '../api';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('auth.reset_token_missing'));
    }
  }, [token, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) return;

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage(t('errors.passwords_dont_match'));
      return;
    }

    if (password.length < 8) {
      setStatus('error');
      setMessage(t('auth.password_min_length'));
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('errors.generic'));
      }

      setStatus('success');
      setMessage(data.message || t('auth.reset_success_default'));

      // Reindirizzamento rapido auto-popolando la Quick Login
      setTimeout(() => {
        navigate('/', { state: { resetEmail: data.email }, replace: true });
      }, 2000);

    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  const calculateStrength = (pwd) => {
    if (pwd.length === 0) return 0;
    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd)) strength += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 25;
    return strength;
  };

  const strength = calculateStrength(password);
  let strengthColor = '#ef4444'; // res
  if (strength >= 50) strengthColor = '#eab308'; // yellow
  if (strength >= 75) strengthColor = '#34d399'; // green

  return (
    <div className="page auth-page narrow" style={{ maxWidth: '400px', margin: '4rem auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.6rem' }}>{t('auth.reset_title')}</h1>

      {status === 'success' ? (
        <div style={{ backgroundColor: '#064e3b', color: '#34d399', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
          <h3 style={{ marginTop: 0 }}>{t('auth.success_title')}</h3>
          <p>{message}</p>
          <p style={{ fontSize: '0.8rem', marginTop: '1rem', color: '#a7f3d0' }}>{t('auth.redirecting_home')}</p>
        </div>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          {status === 'error' && (
            <div style={{ color: '#ef4444', backgroundColor: '#450a0a', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {message}
            </div>
          )}

          <label>
            {t('auth.new_password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={!token || status === 'loading'}
            />
          </label>

          {password.length > 0 && (
            <div style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
              <div style={{ height: '4px', width: '100%', backgroundColor: '#292524', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${strength}%`, backgroundColor: strengthColor, transition: 'all 0.3s' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#a8a29e', marginTop: '4px' }}>
                <span>{password.length < 8 ? t('auth.min_chars_hint') : t('auth.strength_ok')}</span>
                <span>{strength === 100 ? t('auth.strength_strong') : strength >= 50 ? t('auth.strength_medium') : t('auth.strength_weak')}</span>
              </div>
            </div>
          )}

          <label>
            {t('auth.confirm_new_password')}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={!token || status === 'loading'}
            />
          </label>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={status === 'loading' || !token}
            style={{ width: '100%', padding: '0.75rem', marginTop: '1rem' }}
          >
            {status === 'loading' ? t('auth.saving') : t('auth.change_password_btn')}
          </button>
        </form>
      )}
    </div>
  );
}
