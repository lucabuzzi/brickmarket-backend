import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import Turnstile from '../../components/Turnstile';

/** New player / existing account choice. */
export function AccessMenu({ onNew, onLogin }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-24">
      <div className="cbg-panel w-full max-w-md p-6 text-center sm:p-8">
        <h2 className="cbg-pixel text-lg uppercase text-white">{t('game.access.title')}</h2>
        <div className="mt-8 flex flex-col gap-5">
          <button type="button" className="cbg-btn" onClick={onNew}>{t('game.access.new_player')}</button>
          <button type="button" className="cbg-btn cbg-btn--ghost" onClick={onLogin}>{t('game.access.have_account')}</button>
        </div>
        <p className="mt-6 text-sm text-white/55">{t('game.access.hint')}</p>
      </div>
    </div>
  );
}

/** Sign in with an existing CardBrix account (the same one the site uses). */
export function LoginScreen({ onBack }) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!captcha) return setError(t('errors.captcha_required'));
    setBusy(true);
    try {
      await login(identity.trim(), password, captcha);
      // GamePage reacts to `user` and moves on to the world / creator.
    } catch (err) {
      setError(err?.data?.error || err?.message || t('errors.invalid_credentials'));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-24">
      <form onSubmit={onSubmit} className="cbg-panel w-full max-w-md p-6 sm:p-8">
        <h2 className="cbg-pixel text-lg uppercase text-white">{t('game.login.title')}</h2>
        <div className="mt-6 flex flex-col gap-5">
          <label>
            <span className="cbg-label">{t('auth.username_email')}</span>
            <input className="cbg-input" value={identity} onChange={(e) => setIdentity(e.target.value)} required autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </label>
          <label>
            <span className="cbg-label">{t('auth.password')}</span>
            <input className="cbg-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
          <Turnstile theme="dark" onVerify={setCaptcha} onExpire={() => setCaptcha(null)} />
          {error && <p className="text-sm font-bold text-[#ff7a5c]" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-4">
            <button type="submit" className="cbg-btn" disabled={busy}>{t('game.login.submit')}</button>
            <button type="button" className="cbg-btn cbg-btn--ghost" onClick={onBack}>{t('game.login.back')}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
