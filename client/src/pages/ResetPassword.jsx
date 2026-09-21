import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Eye, EyeOff, Link2Off, Lock, LockKeyhole, ShieldCheck } from 'lucide-react';
import { apiUrl } from '../api';
import RecoveryShell from '../components/auth/RecoveryShell';
import { STRENGTH_LEVELS, passwordScore } from '../components/auth/passwordStrength';

const LIME = '#c6ff3d';

function PasswordField({ label, value, onChange, disabled, autoFocus }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/50">{label}</span>
      <span className="group flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 transition focus-within:border-white/45 focus-within:bg-black/60">
        <Lock className="h-5 w-5 shrink-0 text-white/35 transition group-focus-within:text-white" />
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          required
          disabled={disabled}
          autoComplete="new-password"
          autoFocus={autoFocus}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-white outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('login_page.hide_password') : t('login_page.show_password')}
          aria-pressed={visible}
          className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/10 hover:text-white"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </span>
    </label>
  );
}

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [message, setMessage] = useState('');

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

      // Straight to login with the account's email already filled in.
      setTimeout(() => {
        navigate('/login', { state: { resetEmail: data.email }, replace: true });
      }, 2500);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  const score = passwordScore(password);
  const strength = STRENGTH_LEVELS[score];
  const repeatState = confirmPassword ? (confirmPassword === password ? 'match' : 'mismatch') : null;
  const busy = status === 'loading';

  if (!token) {
    return (
      <RecoveryShell icon={Link2Off} step={1} tone="#ff5a36">
        <div className="text-center">
          <h1 className="text-[clamp(2rem,6vw,2.8rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('recover_page.missing_title')}</h1>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60">{t('recover_page.missing_desc')}</p>
          <Link
            to="/forgot-password"
            className="mt-8 flex h-14 items-center justify-center gap-2 rounded-2xl font-black text-[#10140a] transition hover:brightness-110"
            style={{ background: LIME }}
          >
            {t('recover_page.request_new')}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </RecoveryShell>
    );
  }

  if (status === 'success') {
    return (
      <RecoveryShell icon={ShieldCheck} step={3}>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: LIME }}>{t('recover_page.kicker')}</p>
          <h1 className="mt-3 text-[clamp(2rem,6vw,2.8rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('recover_page.done_title')}</h1>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60">{t('recover_page.done_desc')}</p>
          <div className="mx-auto mt-6 h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="rp-progress h-full rounded-full" style={{ background: LIME }} />
          </div>
          <p className="mt-3 text-xs text-white/40">{t('recover_page.done_redirect')}</p>
          <Link
            to="/login"
            replace
            className="mt-8 flex h-14 items-center justify-center gap-2 rounded-2xl font-black text-[#10140a] transition hover:brightness-110"
            style={{ background: LIME }}
          >
            {t('recover_page.go_login')}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell icon={LockKeyhole} step={2}>
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: LIME }}>{t('recover_page.kicker')}</p>
        <h1 className="mt-3 text-[clamp(2rem,6vw,2.8rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('recover_page.reset_title')}</h1>
        <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60">{t('recover_page.reset_desc')}</p>
      </div>

      <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
        {status === 'error' && (
          <p className="rounded-2xl border border-[#ff5a36]/40 bg-[#ff5a36]/10 px-4 py-3 text-sm font-semibold text-[#ff7a5c]" role="alert">
            {message}
          </p>
        )}

        <div>
          <PasswordField label={t('auth.new_password')} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} autoFocus />
          {strength && (
            <div className="mt-2.5" aria-live="polite">
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <span key={n} className="h-1 flex-1 rounded-full transition-colors" style={{ background: n <= score ? strength.color : 'rgba(255,255,255,0.1)' }} />
                ))}
              </div>
              <p className="mt-1.5 flex justify-between gap-3 text-xs font-bold">
                <span className="text-white/45">{password.length < 8 ? t('auth.min_chars_hint') : ' '}</span>
                <span style={{ color: strength.color }}>{t(`register_page.strength_${strength.key}`)}</span>
              </p>
            </div>
          )}
        </div>

        <div>
          <PasswordField label={t('auth.confirm_new_password')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={busy} />
          {repeatState && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold" style={{ color: repeatState === 'match' ? LIME : '#ff7a5c' }} aria-live="polite">
              {repeatState === 'match' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              {t(`register_page.passwords_${repeatState}`)}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="lx-shine relative mt-2 flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-black text-[#10140a] shadow-[0_18px_40px_-14px_rgba(198,255,61,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          style={{ background: LIME }}
        >
          {busy ? t('recover_page.saving') : t('recover_page.reset_cta')}
          {!busy && <ArrowRight className="h-5 w-5" />}
        </button>
      </form>
    </RecoveryShell>
  );
}
