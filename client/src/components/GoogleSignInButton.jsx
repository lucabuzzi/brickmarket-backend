import { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptLoadingPromise = null;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
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

/** Google Identity Services button. Calls onCredential(idTokenJwt) on success. */
export default function GoogleSignInButton({ onCredential, onError }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return; // Non configurato: bottone semplicemente non renderizzato.

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              onCredential?.(response.credential);
            } else {
              onError?.(new Error('Nessuna credential ricevuta da Google'));
            }
          },
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: 320,
        });
      })
      .catch(() => onError?.(new Error('Impossibile caricare Google Identity Services')));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;

  return <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center' }} />;
}
