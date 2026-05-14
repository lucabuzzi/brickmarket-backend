import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(t('errors.invalid_credentials'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    /* Ho aggiunto pt-24 per evitare che l'header copra il titolo */
    <div className="page auth-page narrow pt-24">
      <h1>{t('auth.login_title')}</h1>

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
          {t('auth.password')}
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error-banner">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? t('auth.logging_in') : t('auth.login_btn')}
        </button>
      </form>
      <p className="muted">
        {t('auth.no_account')} <Link to="/register">{t('nav.register')}</Link>
      </p>
    </div>
  );
}