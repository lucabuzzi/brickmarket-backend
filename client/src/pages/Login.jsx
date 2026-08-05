import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTranslation } from 'react-i18next';
import Turnstile from '../components/Turnstile';
import GoogleSignInButton from '../components/GoogleSignInButton';
import AppleSignInButton from '../components/AppleSignInButton';
import { StitchCard } from '../components/StitchComponents';

export default function Login() {
  const { login, loginWithGoogle, loginWithApple } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!turnstileToken) {
      setError(t('errors.captcha_required'));
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password, turnstileToken);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.data?.error || t('errors.invalid_credentials'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleCredential(credential) {
    setError('');
    setSubmitting(true);
    try {
      await loginWithGoogle(credential);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.data?.error || t('errors.oauth_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onAppleSuccess({ id_token, user }) {
    setError('');
    setSubmitting(true);
    try {
      await loginWithApple(id_token, user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.data?.error || t('errors.oauth_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* Ho aggiunto pt-24 per evitare che l'header copra il titolo */
    <div className="page auth-page narrow pt-24 px-4">
      <h1 className="text-center">{t('auth.login_title')}</h1>

      <StitchCard glowColor="blue" className="mt-6 !p-6 sm:!p-8">
        <form className="form" onSubmit={onSubmit}>
          <label>
            {t('auth.username_email')}
            <input
              type="text"
              name="email"
              placeholder={t('auth.username_email')}
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            <div className="flex items-center justify-between">
              <span>{t('auth.password')}</span>
              <Link to="/forgot-password" className="text-xs text-gold-400 hover:text-gold-300 font-normal normal-case">
                {t('auth.forgot')}
              </Link>
            </div>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <div className="flex justify-center py-1">
            <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
          </div>

          {error && <p className="error-banner">{error}</p>}
          <button type="submit" className="btn btn--primary" disabled={submitting || !turnstileToken}>
            {submitting ? t('auth.logging_in') : t('auth.login_btn')}
          </button>
        </form>

        <div className="oauth-divider my-6">{t('auth.or_divider')}</div>

        <div className="flex flex-col items-center gap-3">
          <GoogleSignInButton onCredential={onGoogleCredential} onError={() => setError(t('errors.oauth_failed'))} />
          <AppleSignInButton onSuccess={onAppleSuccess} onError={() => setError(t('errors.oauth_failed'))} />
        </div>
      </StitchCard>

      <p className="muted text-center mt-4">
        {t('auth.no_account')} <Link to="/register">{t('nav.register')}</Link>
      </p>
    </div>
  );
}