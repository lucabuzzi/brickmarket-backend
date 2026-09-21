import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, Coins, Loader2, Mail, MailCheck, MailWarning, RotateCw } from 'lucide-react';
import { apiFetch } from '../api';
import { useAuth } from '../auth/useAuth';

const LIME = '#c6ff3d';

function Shell({ icon: Icon, tone = LIME, children }) {
  return (
    <div className="lx-page min-h-[calc(100vh-4rem)]">
      <div className="lx-bleed lx-grid pointer-events-none absolute inset-y-0 opacity-30" aria-hidden />
      <div className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[620px] -translate-x-1/2 rounded-full opacity-[0.13] blur-[120px]" style={{ background: tone }} aria-hidden />

      <div className="relative mx-auto flex max-w-xl flex-col items-center px-4 pb-20 pt-24 md:pt-28">
        <motion.div
          initial={{ y: 24 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full"
        >
          <div
            className="lx-arena-ring pointer-events-none absolute -inset-px rounded-[2rem]"
            style={{ background: `conic-gradient(from var(--lx-ring-angle, 0deg), ${tone}, #22d3ee, #8b5cf6, ${tone})`, opacity: 0.3 }}
            aria-hidden
          />
          <div className="relative rounded-[2rem] border border-white/10 bg-[#0d0c12]/95 px-5 pb-7 pt-14 backdrop-blur-xl sm:px-9 sm:pb-9">
            <div className="absolute -top-9 left-1/2 flex h-[72px] w-[72px] -translate-x-1/2 items-center justify-center">
              <span className="absolute inset-0 rounded-full opacity-50 blur-xl" style={{ background: tone }} />
              <span className="lx-float relative flex h-full w-full items-center justify-center rounded-full border border-white/15 bg-[#15131c]">
                <Icon className="h-8 w-8" style={{ color: tone }} strokeWidth={2} />
              </span>
            </div>
            {children}
          </div>
        </motion.div>

        <p className="mt-8 text-center text-sm text-white/45">
          {' '}
          <a href="mailto:support@cardbrix.com" className="font-bold text-white/75 underline-offset-4 hover:text-white hover:underline">support@cardbrix.com</a>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshMe, refreshWallet } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const attempted = useRef(false);

  const [status, setStatus] = useState(token ? 'verifying' : 'no-token');
  const [bonusAmount, setBonusAmount] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendState, setResendState] = useState('idle'); // idle | sending | sent | error

  useEffect(() => {
    document.title = t('verify_email_page.page_title');
  }, [t]);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const data = await apiFetch('/api/auth/verify-email', { method: 'POST', body: { token } });
        setBonusAmount(data?.bonusAmount ?? null);
        setStatus('success');
        if (user) {
          await refreshMe();
          await refreshWallet();
        }
      } catch (err) {
        setStatus('error');
        setErrorMessage(err?.data?.error || t('verify_email_page.error_desc'));
      }
    })();
  }, [token, user, refreshMe, refreshWallet, t]);

  const handleResend = async () => {
    setResendState('sending');
    try {
      await apiFetch('/api/auth/resend-verification-email', { method: 'POST' });
      setResendState('sent');
    } catch {
      setResendState('error');
    }
  };

  if (status === 'verifying') {
    return (
      <Shell icon={Mail}>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: LIME }}>{t('verify_email_page.kicker')}</p>
          <h1 className="mt-3 text-[clamp(1.8rem,5vw,2.4rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('verify_email_page.verifying_title')}</h1>
          <Loader2 className="mx-auto mt-6 h-8 w-8 animate-spin text-white/50" />
        </div>
      </Shell>
    );
  }

  if (status === 'success') {
    return (
      <Shell icon={MailCheck}>
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: LIME }}>{t('verify_email_page.kicker')}</p>
          <h1 className="mt-3 text-[clamp(1.8rem,5vw,2.4rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('verify_email_page.success_title')}</h1>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60">{t('verify_email_page.success_desc')}</p>

          {bonusAmount > 0 && (
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-6 py-3" style={{ borderColor: `${LIME}55` }}>
              <Coins className="h-5 w-5" style={{ color: LIME }} />
              <span className="font-mono text-xl font-black text-white">+{bonusAmount} CR</span>
            </div>
          )}

          <Link
            to={user ? '/crediti' : '/login'}
            className="lx-shine relative mt-8 flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-black text-[#10140a] shadow-[0_18px_40px_-14px_rgba(198,255,61,0.6)] transition hover:brightness-110"
            style={{ background: LIME }}
          >
            {user ? t('verify_email_page.goto_wallet') : t('verify_email_page.goto_login')}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </Shell>
    );
  }

  if (status === 'error') {
    return (
      <Shell icon={MailWarning} tone="#ff5a36">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: '#ff7a5c' }}>{t('verify_email_page.kicker')}</p>
          <h1 className="mt-3 text-[clamp(1.8rem,5vw,2.4rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('verify_email_page.error_title')}</h1>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60">{errorMessage}</p>

          {user && !user.email_verified && (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendState === 'sending' || resendState === 'sent'}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 text-sm font-bold text-white transition hover:border-white/40 disabled:opacity-60"
            >
              <RotateCw className={`h-4 w-4 ${resendState === 'sending' ? 'animate-spin' : ''}`} />
              {resendState === 'sent' ? t('verify_email_page.resent') : t('verify_email_page.resend')}
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate(user ? '/' : '/login', { replace: true })}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-bold text-white/60 transition hover:text-white"
          >
            {t('verify_email_page.back_home')}
          </button>
        </div>
      </Shell>
    );
  }

  // no-token: utente arrivato qui senza link (es. dalla nav) — mostra il prompt di verifica.
  return (
    <Shell icon={Mail}>
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: LIME }}>{t('verify_email_page.kicker')}</p>
        <h1 className="mt-3 text-[clamp(1.8rem,5vw,2.4rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">
          {user ? t('verify_email_page.pending_title') : t('verify_email_page.no_token_title')}
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-white/60">
          {user ? t('verify_email_page.pending_desc') : t('verify_email_page.no_token_desc')}
        </p>

        {user && !user.email_verified && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resendState === 'sending' || resendState === 'sent'}
            className="lx-shine relative mt-8 flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-black text-[#10140a] shadow-[0_18px_40px_-14px_rgba(198,255,61,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            style={{ background: LIME }}
          >
            <RotateCw className={`h-5 w-5 ${resendState === 'sending' ? 'animate-spin' : ''}`} />
            {resendState === 'sent' ? t('verify_email_page.resent') : t('verify_email_page.resend')}
          </button>
        )}

        {!user && (
          <Link
            to="/login"
            className="lx-shine relative mt-8 flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-black text-[#10140a] shadow-[0_18px_40px_-14px_rgba(198,255,61,0.6)] transition hover:brightness-110"
            style={{ background: LIME }}
          >
            {t('verify_email_page.goto_login')}
            <ArrowRight className="h-5 w-5" />
          </Link>
        )}
      </div>
    </Shell>
  );
}
