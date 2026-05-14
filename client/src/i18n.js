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
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    }
  });

export default i18n;
