import { apiFetch } from './api';
import legalPages from './config/legalPages.json';

const CONSENT_COOKIE = 'bm_cookie_consent';
// Fired by the footer's "Gestisci cookie" link so the visitor can change an earlier choice.
export const OPEN_COOKIE_SETTINGS_EVENT = 'cardbrix:open-cookie-settings';
const SESSION_STORAGE_KEY = 'bm_session_id';
const HEARTBEAT_INTERVAL_MS = 30000;

let heartbeatTimer = null;
let listenersRegistered = false;

// The choice is remembered for 6 months, then the banner asks again (EU data-protection authorities'
// recommended maximum).
export const CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

export function getConsentChoice() {
  const c = document.cookie.split('; ').find((x) => x.startsWith(`${CONSENT_COOKIE}=`));
  const v = c ? c.slice(CONSENT_COOKIE.length + 1) : null;
  return v === 'accepted' || v === 'rejected' ? v : null;
}

export function hasConsent() {
  return getConsentChoice() === 'accepted';
}

/** Global Privacy Control: the browser itself says "do not track me". Treated as a rejection until the visitor chooses. */
export function gpcEnabled() {
  return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true;
}

/** Stores the choice in the consent cookie and records it server-side as proof of consent (fire and forget). */
export function setConsent(value, source = 'banner') {
  document.cookie = `${CONSENT_COOKIE}=${value}; max-age=${CONSENT_MAX_AGE_SECONDS}; path=/; samesite=lax${window.location.protocol === 'https:' ? '; secure' : ''}`;
  if (value !== 'accepted') stopAnalytics();
  apiFetch('/api/consent', {
    method: 'POST',
    body: { choice: value, source, policy_version: legalPages.policyVersion },
  }).catch(() => {});
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

/** Withdrawal of consent takes effect at once: the periodic heartbeat stops (click/pageview calls already check the cookie). */
export function stopAnalytics() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
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
