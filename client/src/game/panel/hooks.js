// Small hooks shared by the views of the side panel.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../api';

/**
 * GET `url` from the real API: { status: 'loading' | 'ready' | 'error', data, code (HTTP status of an error), retry }. A new url (or retry)
 * starts over; answers that arrive for an old url are dropped.
 */
export function useApiData(url) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', data: null, code: null });
  const key = `${url}#${attempt}`;
  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    apiFetch(url)
      .then((data) => { if (live) setState({ key, status: 'ready', data, code: null }); })
      .catch((err) => { if (live) setState({ key, status: 'error', data: null, code: err?.status ?? null }); });
    return () => { live = false; };
  }, [url, key]);
  const current = state.key === key ? state : { status: 'loading', data: null, code: null };
  return { ...current, retry: () => setAttempt((a) => a + 1) };
}

/** Date.now(), refreshed every `ms` while `active` (live countdowns). */
export function useNow(ms = 1000, active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, active]);
  return now;
}

/** The Intl locale of the UI language (prices). */
export function useMoneyLocale() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'it').slice(0, 2);
  return lang === 'en' ? 'en-GB' : `${lang}-${lang.toUpperCase()}`;
}

/** Text revealed a few letters at a time, like the dialogue box of a handheld RPG. Instant with reduced motion. */
export function useTypewriter(text, charsPerSecond = 90) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState({ text: null, n: 0 });
  const n = shown.text === text ? shown.n : 0;
  const done = reduce || n >= text.length;
  useEffect(() => {
    if (done) return undefined;
    const id = setTimeout(() => setShown({ text, n: Math.min(text.length, n + 2) }), 2000 / charsPerSecond);
    return () => clearTimeout(id);
  }, [text, n, done, charsPerSecond]);
  return { visible: done ? text : text.slice(0, n), done, finish: () => setShown({ text, n: text.length }) };
}
