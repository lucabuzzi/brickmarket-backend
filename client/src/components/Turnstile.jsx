import { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Cloudflare's official "always passes" test site key — used only if no real
// key is configured (VITE_TURNSTILE_SITE_KEY), so the widget keeps working in
// local dev before a real Turnstile site is set up. Replace in production.
const DEV_FALLBACK_SITE_KEY = '1x00000000000000000000AA';

let scriptLoadingPromise = null;
function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptLoadingPromise;
}

/** Cloudflare Turnstile anti-bot widget. Calls onVerify(token) / onExpire() as the challenge progresses. */
export default function Turnstile({ onVerify, onExpire, size = 'normal' }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY || DEV_FALLBACK_SITE_KEY,
        size,
        callback: (token) => onVerify?.(token),
        'expired-callback': () => onExpire?.(),
        'error-callback': () => onExpire?.(),
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} />;
}
