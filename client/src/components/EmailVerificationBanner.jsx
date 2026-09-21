import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, X } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api';

/** Dismissible per-session only (no persistence): reappears on next page load
 * until the user actually verifies, which is the point. */
export default function EmailVerificationBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  if (!user || user.email_verified !== false || dismissed) return null;

  const handleResend = async () => {
    setStatus('sending');
    try {
      await apiFetch('/api/auth/resend-verification-email', { method: 'POST' });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="relative z-40 flex flex-wrap items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200 sm:text-sm">
      <Mail className="h-4 w-4 shrink-0" />
      <span>{t('email_verify_banner.message')}</span>
      <button
        type="button"
        onClick={handleResend}
        disabled={status === 'sending' || status === 'sent'}
        className="font-bold underline underline-offset-2 hover:text-white disabled:opacity-60"
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
        className="ml-1 text-amber-200/60 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
