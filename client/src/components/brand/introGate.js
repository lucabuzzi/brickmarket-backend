const SEEN_KEY = 'cardbrix_intro_seen';

// The user's local calendar day, e.g. "2026-09-24". Local (not UTC) so "once a day" matches what the
// person perceives as a new day. Values written by the earlier once-ever version were timestamps, which
// never equal a date string, so those browsers see the intro once more and then follow the daily rule.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Records that the intro has been shown today (called when it starts, so a reload mid-intro won't replay it). */
export function markIntroSeen() {
  try { window.localStorage.setItem(SEEN_KEY, today()); } catch { /* storage blocked: ignore */ }
}

/**
 * Whether the brand reveal should run for this page load. Only on the home route, at most once per
 * calendar day per browser (localStorage, so not per account/device), never for crawlers/automation
 * or reduced-motion users.
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
    return window.localStorage.getItem(SEEN_KEY) !== today();
  } catch {
    // Storage blocked: we could never remember it was played, so don't replay it on every visit.
    return false;
  }
}
