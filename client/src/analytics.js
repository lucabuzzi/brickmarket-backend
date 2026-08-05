import { apiFetch } from './api';

const CONSENT_COOKIE = 'bm_cookie_consent';
const SESSION_STORAGE_KEY = 'bm_session_id';
const HEARTBEAT_INTERVAL_MS = 30000;

let heartbeatTimer = null;
let listenersRegistered = false;

export function hasConsent() {
  return document.cookie.split('; ').some(c => c === `${CONSENT_COOKIE}=accepted`);
}

export function setConsent(value) {
  document.cookie = `${CONSENT_COOKIE}=${value}; max-age=31536000; path=/; samesite=lax`;
}

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  }
  return id;
}

function sendHeartbeat() {
  if (!hasConsent()) return;
  const body = JSON.stringify({ session_id: getSessionId() });
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/heartbeat', new Blob([body], { type: 'application/json' }));
  } else {
    apiFetch('/api/analytics/heartbeat', { method: 'POST', body: { session_id: getSessionId() } }).catch(() => {});
  }
}

function handleGlobalClick(e) {
  if (!hasConsent()) return;
  const el = e.target.closest('a, button, [role="button"]');
  if (!el) return;

  const rawLabel = el.getAttribute('aria-label') || el.textContent || '';
  const label = rawLabel.trim().replace(/\s+/g, ' ').slice(0, 150) || null;
  const isLink = el.tagName === 'A';

  apiFetch('/api/analytics/click', {
    method: 'POST',
    body: {
      session_id: getSessionId(),
      path: window.location.pathname,
      target_label: label,
      target_type: isLink ? 'link' : 'button',
      target_href: isLink ? el.getAttribute('href') : null,
    },
  }).catch(() => {});
}

export function initAnalytics() {
  if (!hasConsent() || heartbeatTimer) return;

  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

  if (!listenersRegistered) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') sendHeartbeat();
    });
    window.addEventListener('pagehide', sendHeartbeat);
    document.addEventListener('click', handleGlobalClick);
    listenersRegistered = true;
  }
}

export function trackPageview(path) {
  if (!hasConsent()) return;
  apiFetch('/api/analytics/pageview', {
    method: 'POST',
    body: { session_id: getSessionId(), path },
  }).catch(() => {});
}

export function trackEvent(eventType, path) {
  if (!hasConsent()) return;
  apiFetch('/api/analytics/event', {
    method: 'POST',
    body: { session_id: getSessionId(), event_type: eventType, path: path || window.location.pathname },
  }).catch(() => {});
}
