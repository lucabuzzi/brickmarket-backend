import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Wraps the /it and /en route subtrees: keeps i18next (and <html lang>) in sync with the URL's own
 * locale segment, so a direct link to /en/listings always shows English regardless of what the visitor
 * had picked before. Structural pages only — every other route is untouched by this.
 */
export default function LocaleFrame({ locale }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== locale) i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
  }, [locale, i18n]);

  return <Outlet />;
}
