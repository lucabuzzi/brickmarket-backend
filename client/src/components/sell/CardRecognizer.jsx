import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Check, Loader2, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch, apiPostForm } from '../../api';
import { analyzePhoto } from './analyzePhoto';
import { showThumbnails } from '../../lib/sell/catalog';
import {
  MAX_RECOGNIZE_BYTES, canRecognize, needsBetterPhoto, outcomeOf, photoProblem, printLabel, readingLabel, recognizedPatch,
} from '../../lib/sell/recognize';

let statusRequest = null; // one status call per page load, shared by every picker
const loadStatus = () => {
  statusRequest = statusRequest || apiFetch('/cards/recognize/status').catch(() => ({ enabled: false }));
  return statusRequest;
};

// "Photograph the card" shortcut inside the catalog picker (CardCatalogPicker): the photo is read on the server, the
// seller picks the exact print among the real ones, and the form is filled from the catalog. The photo then becomes the
// listing's first photo (`onPhoto`), and the seller is asked for a better one when it is unreadable, small or blurry.
export default function CardRecognizer({ game, form, patch, onChosen, onPhoto, chosenCls, accentText }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const mode = useRef('recognize'); // what the next picked file is for: 'recognize' | 'replace' (listing photo only)
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [error, setError] = useState(null);
  const [quality, setQuality] = useState(null);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    let alive = true;
    loadStatus().then((s) => { if (alive) setStatus(s); });
    return () => { alive = false; };
  }, []);

  // the card chosen from the photo was cleared in the picker: back to the camera button
  useEffect(() => {
    if (picked && !form.cardExternalId) { setPicked(false); setAnswer(null); setFile(null); }
  }, [picked, form.cardExternalId]);

  if (!canRecognize(game, status)) return null;

  const openCamera = (next) => {
    mode.current = next;
    inputRef.current?.click();
  };

  async function recognize(photo, { anyway = false } = {}) {
    setBusy(true);
    setAnswer(null);
    setError(null);
    setPicked(false);
    setFile(photo);
    setQuality(null);
    try {
      if (photo.size > MAX_RECOGNIZE_BYTES) throw Object.assign(new Error('too large'), { data: { code: 'too_large' } });
      const measured = await analyzePhoto(photo);
      setQuality(measured);
      const problem = photoProblem(measured);
      if (problem === 'too_small' || (problem && !anyway)) throw Object.assign(new Error(problem), { data: { code: problem } });
      const fd = new FormData();
      fd.append('game', game);
      fd.append('image', photo);
      setAnswer(await apiPostForm('/cards/recognize', fd));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function replacePhoto(photo) {
    setFile(photo);
    setQuality(null);
    onPhoto?.(photo);
    setQuality(await analyzePhoto(photo));
  }

  const onFile = (e) => {
    const photo = e.target.files?.[0];
    e.target.value = '';
    if (!photo) return;
    if (mode.current === 'replace') replacePhoto(photo);
    else recognize(photo);
  };

  const choose = (print) => {
    patch(recognizedPatch(print, answer?.reading, form, game));
    onChosen?.(print);
    onPhoto?.(file);
    setPicked(true);
  };

  const dismiss = () => { setAnswer(null); setError(null); setFile(null); setPicked(false); };

  const outcome = busy || (!answer && !error) ? null : outcomeOf(answer, error, quality);
  const matched = ['matched', 'check_name', 'check_photo'].includes(outcome?.key);
  const askBetter = outcome && !error && needsBetterPhoto(answer, quality);
  const issue = quality?.blurry ? 'blurry' : quality?.small ? 'small' : null;
  const read = readingLabel(answer?.reading);
  const thumbnails = showThumbnails(game); // not for Yu-Gi-Oh!: YGOPRODeck asks not to link its images

  // once a card is chosen (here or by hand) only the after-pick notices stay
  if (form.cardExternalId && !picked) return null;

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

      {!picked && !answer && !busy ? (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => openCamera('recognize')}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.06] ${chosenCls}`}
          >
            <Camera size={18} className={accentText} aria-hidden="true" /> {t('sell.recognize.button')}
          </button>
          <p className="text-[12px] text-white/50">{t(`sell.recognize.hint.${game}`)}</p>
          {error ? <p role="alert" className="text-[13px] text-amber-300">{t(`sell.recognize.error.${outcome.key}`)}</p> : null}
          {outcome?.key === 'too_small' || outcome?.key === 'too_blurry' ? <p className="text-[12px] text-white/60">{t('sell.recognize.better.tips')}</p> : null}
          {outcome?.key === 'too_blurry' && file ? (
            <button type="button" onClick={() => recognize(file, { anyway: true })} className="text-xs font-semibold text-white/55 underline underline-offset-2 hover:text-white">
              {t('sell.recognize.try_anyway')}
            </button>
          ) : null}
          <p className="text-[11px] text-white/35">{t('sell.recognize.privacy')}</p>
        </div>
      ) : null}

      {busy ? (
        <p className="flex items-center gap-2 py-2 text-sm text-white/70" aria-live="polite">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t('sell.recognize.busy')}
        </p>
      ) : null}

      {answer && !picked ? (
        <div className="space-y-3" aria-live="polite">
          <div>
            {read ? <p className="font-mono text-xs text-white/45">{t('sell.recognize.read', { text: read })}</p> : null}
            <p className={`text-sm ${outcome.key !== 'matched' ? 'text-amber-300' : 'text-white/80'}`}>{t(`sell.recognize.result.${outcome.key === 'matched' && !thumbnails ? 'matched_by_code' : outcome.key}`)}</p>
          </div>

          {matched ? (
            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {answer.prints.map((p) => {
                const l = printLabel(p, game);
                const label = l.kind ? t(`sell.recognize.kind.${l.kind}`, { n: l.n }) : l.title;
                return (
                  <li key={p.external_id}>
                    <button
                      type="button"
                      onClick={() => choose(p)}
                      className="flex w-full flex-col items-stretch gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left transition hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                      {thumbnails ? (p.img_url
                        ? <img src={p.img_url} alt={`${p.name} — ${label}`} loading="lazy" className="aspect-[5/7] w-full rounded-md object-cover" />
                        : <span className="aspect-[5/7] w-full rounded-md bg-white/5" aria-hidden="true" />) : null}
                      <span className="line-clamp-2 text-[13px] font-bold leading-tight text-white">{label}</span>
                      <span className="block break-words text-[11px] leading-snug text-white/45">{l.sub}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {askBetter && !matched ? (
            <div className="flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-amber-200">{t('sell.recognize.better.title')}</p>
                <p className="mt-0.5 text-[13px] text-white/70">{t('sell.recognize.better.tips')}</p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => openCamera('recognize')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 hover:border-white/30">
              <RotateCcw size={14} aria-hidden="true" /> {t('sell.recognize.retake')}
            </button>
            <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-xs font-semibold text-white/55 hover:text-white">
              {matched ? t('sell.recognize.none') : t('sell.recognize.search_by_hand')}
            </button>
          </div>
        </div>
      ) : null}

      {picked ? (
        askBetter && issue ? (
          <div className="flex gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3" role="status">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-bold text-amber-200">{t('sell.recognize.better.title')}</p>
              <p className="text-[13px] text-white/70">{t(`sell.recognize.better.${issue}`)} {t('sell.recognize.better.tips')}</p>
              <button type="button" onClick={() => openCamera('replace')} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/85 hover:border-white/30">
                <Camera size={14} aria-hidden="true" /> {t('sell.recognize.replace_photo')}
              </button>
            </div>
          </div>
        ) : (
          <p className="flex items-start gap-2 text-[13px] text-white/60" role="status">
            <Check size={16} className={`mt-0.5 shrink-0 ${accentText}`} aria-hidden="true" /> {t(onPhoto ? 'sell.recognize.added' : 'sell.recognize.chosen')}
          </p>
        )
      ) : null}
    </div>
  );
}
