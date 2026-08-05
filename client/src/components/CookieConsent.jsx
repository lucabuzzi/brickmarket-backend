import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { hasConsent, setConsent, initAnalytics, trackPageview } from '../analytics';

export default function CookieConsent() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const cookieChoiceMade = document.cookie.split('; ').some(c => c.startsWith('bm_cookie_consent='));
    if (!cookieChoiceMade) {
      setVisible(true);
    } else if (hasConsent()) {
      initAnalytics();
      trackPageview(window.location.pathname);
    }
  }, []);

  const handleAccept = () => {
    setConsent('accepted');
    setVisible(false);
    initAnalytics();
    trackPageview(window.location.pathname);
  };

  const handleReject = () => {
    setConsent('rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[110] p-4 sm:p-5 bg-[#0a0806]/95 backdrop-blur-xl border-t border-white/10 shadow-2xl shadow-black/50"
      role="dialog"
      aria-label={t('cookies.banner_title')}
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-3">
        <p className="text-sm text-stone-300 leading-relaxed">
          {t('cookies.banner_text')}{' '}
          <Link to="/norme-legali" className="text-gold-400 underline">{t('cookies.learn_more')}</Link>
        </p>
        <div className="grid grid-cols-1 sm:flex sm:justify-end gap-2">
          <button
            onClick={handleReject}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border border-white/10 text-stone-300 hover:bg-white/5 transition-colors"
          >
            {t('cookies.reject')}
          </button>
          <button
            onClick={handleAccept}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-gold-600 hover:bg-gold-500 text-white transition-colors"
          >
            {t('cookies.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
