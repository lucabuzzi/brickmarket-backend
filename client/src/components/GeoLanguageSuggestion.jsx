import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';

// Deliberately NOT keyed on i18next's own 'i18nextLng' localStorage entry:
// i18next-browser-languagedetector writes that key on every first detection
// (navigator-based, automatic) — not only when the user explicitly picks a
// language — so it can't distinguish "explicit past choice" from "the
// library's own auto-cached guess". This dedicated flag is the only thing
// that gates the suggestion, and is set once the check has run (whatever
// the outcome), so a given browser is only ever asked once, ever.
const CHECKED_KEY = 'bm_geo_lang_checked';

const LANGUAGE_NAMES = {
  it: 'Italiano', en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français',
};

/**
 * Non-intrusive, dismissible banner suggesting a UI language based on the
 * visitor's IP-resolved country. Never auto-switches, and only ever shown
 * once per browser (see CHECKED_KEY above).
 */
export default function GeoLanguageSuggestion() {
  const { i18n, t } = useTranslation();
  const [suggestedLang, setSuggestedLang] = useState(null);

  useEffect(() => {
    if (localStorage.getItem(CHECKED_KEY)) return;

    apiFetch('/api/geo/suggest-language')
      .then((data) => {
        if (data?.suggestedLanguage && data.suggestedLanguage !== i18n.language) {
          setSuggestedLang(data.suggestedLanguage);
        }
      })
      .catch(() => {})
      .finally(() => {
        localStorage.setItem(CHECKED_KEY, '1');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!suggestedLang) return null;

  const accept = () => {
    i18n.changeLanguage(suggestedLang);
    setSuggestedLang(null);
  };

  const dismiss = () => {
    setSuggestedLang(null);
  };

  return (
    <div
      style={{
        position: 'fixed', bottom: '1rem', left: '1rem', right: '1rem', zIndex: 999,
        maxWidth: '480px', margin: '0 auto',
        backgroundColor: '#120f0a', border: '1px solid #292524', borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', padding: '1rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
      }}
    >
      <p style={{ margin: 0, color: '#e7e5e4', fontSize: '0.9rem', flex: '1 1 200px' }}>
        {t('geo_lang.question', { language: LANGUAGE_NAMES[suggestedLang] || suggestedLang })}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button onClick={accept} className="btn btn--primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          {t('geo_lang.switch')}
        </button>
        <button onClick={dismiss} className="btn btn--ghost" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          {t('geo_lang.dismiss')}
        </button>
      </div>
    </div>
  );
}
