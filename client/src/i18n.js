import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationIT from './locales/it.json';
import translationEN from './locales/en.json';
import translationDE from './locales/de.json';
import translationES from './locales/es.json';
import translationFR from './locales/fr.json';

const resources = {
  it: { translation: translationIT },
  en: { translation: translationEN },
  de: { translation: translationDE },
  es: { translation: translationES },
  fr: { translation: translationFR },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'it',
    // Lets the 'path' detector below tell "/login" (no locale segment -> not a supported code) apart from
    // "/it/..." or "/en/..." -> it falls through to localStorage/navigator instead of trying to load a
    // "login" translation bundle.
    supportedLngs: ['it', 'en', 'de', 'es', 'fr'],
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      // 'path' reads the first URL segment (lookupFromPathIndex: 0): on a structural page under /it or
      // /en that's authoritative over whatever was saved before (LocaleFrame keeps it in sync on client
      // navigation too — this only covers the very first load). Every other route has no locale segment,
      // so the detector finds nothing there and falls through to localStorage/navigator exactly as before.
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0,
      caches: ['localStorage'],
    }
  });

export default i18n;
