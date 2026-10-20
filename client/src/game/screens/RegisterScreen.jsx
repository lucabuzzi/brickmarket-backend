import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/useAuth';
import Turnstile from '../../components/Turnstile';
import AvatarCreator from '../components/AvatarCreator';
import { randomAvatar } from '../../lib/game/skins';

function Check({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-white/80">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-[#c6ff3d]" />
      <span>{children}</span>
    </label>
  );
}

/**
 * Sign-up from inside the game: step 1 the character, step 2 the account. It creates a normal CardBrix
 * account through the same endpoint as the site's registration (same bonuses, referral and email check).
 */
export default function RegisterScreen({ onBack }) {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [avatar, setAvatar] = useState(() => randomAvatar());
  const [form, setForm] = useState({ username: '', email: '', password: '', repeat: '', referral: searchParams.get('ref') || '' });
  const [tos, setTos] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [revocation, setRevocation] = useState(false);
  const [captcha, setCaptcha] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.repeat) return setError(t('errors.passwords_dont_match'));
    if (!tos || !privacy || !revocation) return setError(t('errors.accept_legal'));
    if (!captcha) return setError(t('errors.captcha_required'));
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('username', form.username.trim());
      fd.append('email', form.email.trim());
      fd.append('password', form.password);
      fd.append('turnstileToken', captcha);
      fd.append('sellerType', 'private');
      fd.append('avatarConfig', JSON.stringify(avatar));
      if (form.referral.trim()) fd.append('referralCode', form.referral.trim().toUpperCase());
      await register(fd);
      // GamePage reacts to `user` and moves on to the world.
    } catch (err) {
      setError(err?.data?.error || err?.message || t('errors.registration_failed'));
      setBusy(false);
    }
  }

  if (step === 1) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-24">
        <div className="cbg-panel w-full max-w-3xl p-5 sm:p-8">
          <h2 className="cbg-pixel text-base uppercase text-white sm:text-lg">{t('game.register.step_character')}</h2>
          <p className="mb-6 mt-3 text-sm text-white/60">{t('game.register.hint')}</p>
          <AvatarCreator value={avatar} onChange={setAvatar} />
          <div className="mt-8 flex flex-wrap gap-4">
            <button type="button" className="cbg-btn" onClick={() => setStep(2)}>{t('game.register.next')} ▶</button>
            <button type="button" className="cbg-btn cbg-btn--ghost" onClick={onBack}>{t('game.register.back')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-24">
      <form onSubmit={onSubmit} className="cbg-panel w-full max-w-md p-6 sm:p-8">
        <h2 className="cbg-pixel text-base uppercase text-white sm:text-lg">{t('game.register.step_account')}</h2>
        <p className="mb-6 mt-3 text-sm text-white/60">{t('game.register.same_account')}</p>
        <div className="flex flex-col gap-5">
          <label>
            <span className="cbg-label">Username</span>
            <input className="cbg-input" value={form.username} onChange={set('username')} required minLength={3} autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </label>
          <label>
            <span className="cbg-label">Email</span>
            <input className="cbg-input" type="email" value={form.email} onChange={set('email')} required autoComplete="email" inputMode="email" />
          </label>
          <label>
            <span className="cbg-label">{t('auth.password')}</span>
            <input className="cbg-input" type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
          </label>
          <label>
            <span className="cbg-label">{t('auth.password_repeat')}</span>
            <input className="cbg-input" type="password" value={form.repeat} onChange={set('repeat')} required minLength={8} autoComplete="new-password" />
          </label>
          <label>
            <span className="cbg-label">{t('game.register.referral')}</span>
            <input className="cbg-input" value={form.referral} onChange={set('referral')} maxLength={20} autoCapitalize="characters" spellCheck={false} />
          </label>
          <div className="flex flex-col gap-4">
            <Check checked={tos} onChange={setTos}>{t('auth.accept_tos')}</Check>
            <Check checked={privacy} onChange={setPrivacy}>{t('auth.accept_privacy')}</Check>
            <Check checked={revocation} onChange={setRevocation}>{t('auth.accept_revocation')}</Check>
          </div>
          <Turnstile theme="dark" onVerify={setCaptcha} onExpire={() => setCaptcha(null)} />
          {error && <p className="text-sm font-bold text-[#ff7a5c]" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-4">
            <button type="submit" className="cbg-btn" disabled={busy}>{t('game.register.submit')}</button>
            <button type="button" className="cbg-btn cbg-btn--ghost" onClick={() => setStep(1)}>{t('game.register.back')}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
