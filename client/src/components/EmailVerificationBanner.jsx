import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api';

// Height of the visible banner, published as a CSS variable so Layout's <main> can push the page down by
// exactly that much (see `.main` in index.css).
const HEIGHT_VAR = '--verify-banner-h';

/** Dismissible per-session only (no persistence): reappears on next page load
 * until the user actually verifies, which is the point.
 *
 * Fixed bar right under the header. It used to be rendered inside <main>, where it got squeezed into a ~32px
 * wide column (and hidden behind the landing hero), so users never saw it. */
export default function EmailVerificationBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const barRef = useRef(null);
  const visible = Boolean(user) && user.email_verified === false && !dismissed;

  useEffect(() => {
    const root = document.documentElement;
    const bar = barRef.current;
    if (!visible || !bar) {
      root.style.removeProperty(HEIGHT_VAR);
      return undefined;
    }
    const sync = () => root.style.setProperty(HEIGHT_VAR, `${bar.offsetHeight}px`);
    sync();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null;
    ro?.observe(bar);
    return () => {
      ro?.disconnect();
      root.style.removeProperty(HEIGHT_VAR);
    };
  }, [visible]);

  if (!visible) return null;

  const handleResend = async () => {
    setStatus('sending');
    try {
      // The server gives up on the mail provider after 10s; this makes sure the button never stays on
      // "sending" forever if the request itself hangs (cold start, network).
      await apiFetch('/api/auth/resend-verification-email', { method: 'POST', signal: AbortSignal.timeout(15000) });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div
      ref={barRef}
      role="status"
      className="fixed inset-x-0 top-16 z-[55] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-400/40 bg-[#2a1d05]/95 px-4 py-2 text-center text-xs font-medium text-amber-100 shadow-lg shadow-black/30 backdrop-blur-md sm:text-sm"
    >
      <Mail className="h-4 w-4 shrink-0 text-amber-300" />
      <span>{t('email_verify_banner.message')}</span>
      <button
        type="button"
        onClick={handleResend}
        disabled={status === 'sending' || status === 'sent'}
        className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-black transition hover:bg-amber-300 disabled:opacity-60"
      >
        {status === 'sent'
          ? t('email_verify_banner.sent')
          : status === 'sending'
            ? t('email_verify_banner.sending')
            : status === 'error'
              ? t('email_verify_banner.error')
              : t('email_verify_banner.resend')}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t('email_verify_banner.close')}
        className="text-amber-200/70 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
