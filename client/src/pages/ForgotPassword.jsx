import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, KeyRound, Mail, MailCheck, RotateCw } from 'lucide-react';
import { apiUrl } from '../api';
import RecoveryShell from '../components/auth/RecoveryShell';

const LIME = '#c6ff3d';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // 'idle', 'loading', 'success', 'error'
  const [message, setMessage] = useState('');
  const [resend, setResend] = useState(null); // null, 'loading', 'done', 'error'

  // Resends keep the "check your inbox" view on screen, so they don't touch `status`.
  const sendLink = async ({ isResend = false } = {}) => {
    if (isResend) setResend('loading');
    else setStatus('loading');
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

      if (isResend) setResend('done');
      else setStatus('success');
    } catch (err) {
      if (isResend) setResend('error');
      else setStatus('error');
      setMessage(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResend(null);
    await sendLink();
  };

  const sent = status === 'success';

  return (
    <RecoveryShell icon={sent ? MailCheck : KeyRound} step={sent ? 1 : 0}>
      {sent ? (
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: LIME }}>{t('recover_page.kicker')}</p>
          <h1 className="mt-3 text-[clamp(2rem,6vw,2.8rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('recover_page.sent_title')}</h1>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/65">
            {t('recover_page.sent_desc_before')} <span className="break-all font-bold text-white">{email.trim()}</span> {t('recover_page.sent_desc_after')}
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm text-white/45">{t('recover_page.sent_spam')}</p>
          {resend === 'error' && (
            <p className="mt-5 rounded-2xl border border-[#ff5a36]/40 bg-[#ff5a36]/10 px-4 py-3 text-sm font-semibold text-[#ff7a5c]" role="alert">{message}</p>
          )}

          <div className="mt-8 flex flex-col gap-2.5">
            <Link
              to="/login"
              className="lx-shine relative flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl font-black text-[#10140a] transition hover:brightness-110"
              style={{ background: LIME }}
            >
              {t('recover_page.back_login')}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => sendLink({ isResend: true })}
                disabled={resend === 'loading'}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 px-3 text-sm font-bold text-white transition hover:border-white/40 disabled:opacity-60"
              >
                <RotateCw className={`h-4 w-4 ${resend === 'loading' ? 'animate-spin' : ''}`} />
                {resend === 'done' ? t('recover_page.resent') : t('recover_page.resend')}
              </button>
              <button
                type="button"
                onClick={() => { setStatus(null); setResend(null); }}
                className="flex min-h-12 items-center justify-center rounded-2xl border border-white/15 px-3 text-sm font-bold text-white/75 transition hover:border-white/40 hover:text-white"
              >
                {t('recover_page.change_email')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: LIME }}>{t('recover_page.kicker')}</p>
            <h1 className="mt-3 text-[clamp(2rem,6vw,2.8rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('recover_page.forgot_title')}</h1>
            <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60">{t('recover_page.forgot_desc')}</p>
          </div>

          <form className="mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/50">{t('auth.email_label')}</span>
              <span className="group flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 transition focus-within:border-white/45 focus-within:bg-black/60">
                <Mail className="h-5 w-5 shrink-0 text-white/35 transition group-focus-within:text-white" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('auth.email_placeholder')}
                  autoComplete="email"
                  inputMode="email"
                  autoFocus
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/30"
                />
              </span>
            </label>

            {status === 'error' && (
              <p className="rounded-2xl border border-[#ff5a36]/40 bg-[#ff5a36]/10 px-4 py-3 text-sm font-semibold text-[#ff7a5c]" role="alert">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'loading' || !email}
              className="lx-shine relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-black text-[#10140a] shadow-[0_18px_40px_-14px_rgba(198,255,61,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              style={{ background: LIME }}
            >
              {status === 'loading' ? t('recover_page.sending') : t('recover_page.send_cta')}
              {status !== 'loading' && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>
        </>
      )}
    </RecoveryShell>
  );
}
