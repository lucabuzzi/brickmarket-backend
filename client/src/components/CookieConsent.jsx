import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import legalPages from '../config/legalPages.json';
import {
  getConsentChoice, hasConsent, setConsent, gpcEnabled, initAnalytics, trackPageview, OPEN_COOKIE_SETTINGS_EVENT,
} from '../analytics';
import { useLocalizedNav } from '../routing/useLocalizedNav';

// "Reject" and "Accept" share one style on purpose: equal prominence is what EU regulators expect.
const CHOICE_BTN = 'w-full sm:w-auto px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg border border-white/30 bg-white/10 text-white hover:bg-white/20 transition-colors';

export default function CookieConsent() {
  const { t } = useTranslation();
  const navTo = useLocalizedNav();
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);
  const [stats, setStats] = useState(false);
  const gpc = gpcEnabled();

  useEffect(() => {
    const reopen = () => {
      setStats(hasConsent());
      setDetails(true);
      setVisible(true);
    };
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen);
  }, []);

  useEffect(() => {
    const choice = getConsentChoice();
    if (!choice) {
      if (gpc) setConsent('rejected', 'gpc'); // the browser already said no: honoured without nagging
      else setVisible(true);
    } else if (choice === 'accepted') {
      initAnalytics();
      trackPageview(window.location.pathname);
    }
  }, [gpc]);

  const choose = (accepted, source = 'banner') => {
    setConsent(accepted ? 'accepted' : 'rejected', source);
    setVisible(false);
    setDetails(false);
    if (accepted) {
      initAnalytics();
      trackPageview(window.location.pathname);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[110] max-h-[90vh] overflow-y-auto p-4 sm:p-5 bg-[#0a0806]/95 backdrop-blur-xl border-t border-white/10 shadow-2xl shadow-black/50"
      role="dialog"
      aria-label={t('cookies.banner_title')}
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-3 relative">
        <button
          type="button"
          onClick={() => choose(false)}
          aria-label={t('cookies.close')}
          className="absolute right-0 top-0 inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <p className="pr-10 text-sm text-stone-300 leading-relaxed">
          {t('cookies.banner_text')}{' '}
          <Link to={navTo(legalPages.published ? '/cookie-policy' : '/norme-legali')} className="text-gold-400 underline">{t('cookies.learn_more')}</Link>
        </p>

        {details && (
          <div className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-stone-300">
            <div>
              <p className="font-bold text-white">{t('cookies.necessary_title')} <span className="ml-2 text-xs font-normal text-stone-400">{t('cookies.always_on')}</span></p>
              <p className="mt-1 text-stone-400">{t('cookies.necessary_desc')}</p>
            </div>
            <div>
              <label className="flex items-center gap-3 font-bold text-white">
                <input
                  type="checkbox"
                  checked={stats}
                  onChange={(e) => setStats(e.target.checked)}
                  className="h-5 w-5 accent-[#d4af37]"
                />
                {t('cookies.stats_title')}
              </label>
              <p className="mt-1 text-stone-400">{t('cookies.stats_desc')}</p>
              {gpc && <p className="mt-1 text-xs text-stone-400">{t('cookies.gpc_notice')}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:justify-end gap-2">
          {!details && (
            <button type="button" onClick={() => { setStats(false); setDetails(true); }} className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-stone-300 underline hover:text-white">
              {t('cookies.customize')}
            </button>
          )}
          {details && (
            <button type="button" onClick={() => choose(stats, 'settings')} className={CHOICE_BTN}>
              {t('cookies.save')}
            </button>
          )}
          <button type="button" onClick={() => choose(false)} className={CHOICE_BTN}>
            {t('cookies.reject')}
          </button>
          <button type="button" onClick={() => choose(true)} className={CHOICE_BTN}>
            {t('cookies.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
