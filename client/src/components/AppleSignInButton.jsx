import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SCRIPT_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

let scriptLoadingPromise = null;
function loadAppleScript() {
  if (window.AppleID) return Promise.resolve();
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

/**
 * Apple Sign-In button. Calls onSuccess({ id_token, user }) on success.
 * Note: Apple requires an HTTPS redirect URI registered against the Services
 * ID — http://localhost does not work for real testing, even with usePopup.
 * Use a tunnel (ngrok, etc.) with a registered HTTPS domain for local dev.
 */
export default function AppleSignInButton({ onSuccess, onError }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const initedRef = useRef(false);

  useEffect(() => {
    const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
    if (!clientId) return;

    let cancelled = false;

    loadAppleScript()
      .then(() => {
        if (cancelled || !window.AppleID || initedRef.current) return;
        window.AppleID.auth.init({
          clientId,
          scope: 'name email',
          redirectURI: window.location.origin,
          usePopup: true,
        });
        initedRef.current = true;
        setReady(true);
      })
      .catch(() => onError?.(new Error('Impossibile caricare Sign in with Apple')));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClick() {
    try {
      const res = await window.AppleID.auth.signIn();
      const idToken = res?.authorization?.id_token;
      if (!idToken) {
        onError?.(new Error('Nessun id_token ricevuto da Apple'));
        return;
      }
      onSuccess?.({ id_token: idToken, user: res.user });
    } catch (err) {
      if (err?.error === 'popup_closed_by_user') return;
      onError?.(err instanceof Error ? err : new Error('Apple Sign-In fallito'));
    }
  }

  if (!import.meta.env.VITE_APPLE_CLIENT_ID) return null;

  return (
    <button
      type="button"
      className="btn btn--secondary"
      onClick={handleClick}
      disabled={!ready}
      style={{ width: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
    >
      <span aria-hidden="true"></span> {t('auth.continue_with_apple')}
    </button>
  );
}
