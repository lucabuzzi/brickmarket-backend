import { useTranslation } from 'react-i18next';
import { URL_LOCALES, DEFAULT_URL_LOCALE, resolveLocalizedPath } from './localizedPaths';

/**
 * -> a function that turns a canonical (Italian) path into the URL for the current UI language: /it/... or
 * /en/... for a structural page (see client/src/config/localizedRoutes.json), or the path unchanged for
 * anything else (so it's always safe to wrap a `to="/some/path"` in this). DE/ES/FR have no URL space yet,
 * so they resolve as Italian (today's URLs), matching how those languages already work everywhere else.
 */
export function useLocalizedNav() {
  const { i18n } = useTranslation();
  const urlLocale = URL_LOCALES.includes(i18n.language) ? i18n.language : DEFAULT_URL_LOCALE;
  return (canonicalPath) => resolveLocalizedPath(canonicalPath, urlLocale) || canonicalPath;
}
