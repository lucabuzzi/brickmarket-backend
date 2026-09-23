export const SEEN_KEY = 'cardbrix_intro_seen';

/**
 * Whether the first-visit brand reveal should run for this page load. Only on the home route, only
 * once per browser (localStorage), never for crawlers/automation or reduced-motion users.
 * `?intro` forces it (handy to preview it again), `?nointro` forces it off.
 */
export function shouldPlayIntro() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.has('nointro')) return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  if (params.has('intro')) return true;
  if (window.location.pathname !== '/') return false;
  if (navigator.webdriver || /bot|crawl|spider|lighthouse|headless|prerender/i.test(navigator.userAgent)) return false;
  try {
    return !window.localStorage.getItem(SEEN_KEY);
  } catch {
    // Storage blocked: we could never remember it was played, so don't replay it on every visit.
    return false;
  }
}
