import { useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, Camera, ImagePlus, Lightbulb, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { fileKey } from '../../lib/sell/photos';
import ShotGlyph from './ShotGlyph';

// Photo step of the sell wizard. Instead of one empty box there is one tile per photo (up to `max`):
// each empty tile suggests the shot to take in that position (position 1 is the cover), filled tiles show
// the photo with controls to move it earlier/later or remove it. Click, camera (on phones) and drag & drop
// ADD photos; the soft quality hints never block anything. The long explanation lives in <PhotoGuide>.
export default function PhotoSlots({
  previews, existingImages = [], editing = false, error, notices = [], max = 5, shots, quality = {},
  guideSeen = true, onAdd, onRemove, onMove, onOpenGuide, resolveExisting,
}) {
  const { t } = useTranslation();
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const coarse = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches, []);

  const showingExisting = editing && previews.length === 0 && existingImages.length > 0;
  const filled = previews.length || (showingExisting ? existingImages.length : 0);
  const full = previews.length >= max;
  const shotLabel = (i) => t(`sell.ui.shots.${shots[i]}.label`);

  const pick = (list) => {
    const files = Array.from(list || []);
    if (files.length) onAdd(files);
  };
  const input = (ref, extra = {}) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      tabIndex={-1}
      className="sr-only"
      aria-hidden="true"
      onChange={(e) => {
        pick(e.target.files);
        e.target.value = ''; // so the same file can be picked again after removing it
      }}
      {...extra}
    />
  );

  const flagged = previews
    .map((p, i) => ({ i, q: quality[fileKey(p.file)] }))
    .filter(({ q }) => q && (q.small || q.blurry));

  const tile = (i) => {
    const p = previews[i];
    const existing = showingExisting ? existingImages[i] : null;
    const q = p ? quality[fileKey(p.file)] : null;
    const cover = i === 0;

    if (p || existing) {
      return (
        <div className={`relative aspect-square overflow-hidden rounded-2xl bg-white/5 ${cover ? 'ring-2 ring-[#c6ff3d] ring-offset-2 ring-offset-[#0d0c12]' : 'border border-white/10'}`}>
          <img src={p ? p.url : resolveExisting ? resolveExisting(existing) : existing} alt={shotLabel(i)} className="h-full w-full object-cover" />
          {cover ? <span className="absolute inset-x-0 bottom-0 bg-[#c6ff3d] py-0.5 text-center text-[9px] font-black uppercase tracking-wider text-[#10140a]">{t('sell.cover_badge')}</span> : null}
          {q && (q.small || q.blurry) ? (
            <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[#1a1300]" aria-hidden="true">
              <AlertTriangle size={13} />
            </span>
          ) : null}
          {p ? (
            <>
              <button type="button" onClick={() => onRemove(i)} aria-label={`${t('sell.ui.photos.remove')} (${i + 1})`} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <X size={15} aria-hidden="true" />
              </button>
              {i > 0 ? (
                <button type="button" onClick={() => onMove(i, i - 1)} aria-label={`${t('sell.ui.photos.move_left')} (${i + 1})`} className={`absolute left-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-[#c6ff3d] hover:text-[#10140a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${cover ? 'bottom-6' : 'bottom-1'}`}>
                  <ArrowLeft size={15} aria-hidden="true" />
                </button>
              ) : null}
              {i < previews.length - 1 ? (
                <button type="button" onClick={() => onMove(i, i + 1)} aria-label={`${t('sell.ui.photos.move_right')} (${i + 1})`} className={`absolute right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-[#c6ff3d] hover:text-[#10140a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${cover ? 'bottom-6' : 'bottom-1'}`}>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      );
    }

    const active = i === filled && !full;
    return (
      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        aria-label={t('sell.ui.photos.slot_aria', { shot: shotLabel(i) })}
        className={`group relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/60 ${
          active
            ? 'border-[#c6ff3d]/70 bg-[#c6ff3d]/[0.07] text-[#c6ff3d] shadow-[0_0_30px_-8px_rgba(198,255,61,0.5)]'
            : 'border-white/15 bg-white/[0.02] text-white/35 hover:border-[#c6ff3d]/40 hover:text-[#c6ff3d]/80'
        } ${error && i === 0 ? 'border-red-400/70 text-red-300' : ''}`}
      >
        <ShotGlyph id={shots[i]} size={active ? 44 : 38} className="transition-transform duration-300 group-hover:scale-110 motion-reduce:transform-none" />
        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${active ? 'bg-[#c6ff3d] text-[#10140a]' : 'bg-white/10 text-white/60'}`} aria-hidden="true">
          <ImagePlus size={11} />
        </span>
      </button>
    );
  };

  return (
    <div>
      {input(galleryRef, { multiple: true })}
      {input(cameraRef, { capture: 'environment' })}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenGuide}
          className="relative inline-flex items-center gap-2 rounded-full border border-[#c6ff3d]/40 bg-[#c6ff3d]/10 px-4 py-2 text-sm font-bold text-[#c6ff3d] transition-colors hover:bg-[#c6ff3d]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/60"
        >
          <Lightbulb size={16} aria-hidden="true" /> {t('sell.ui.guide.chip')}
          {!guideSeen ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#c6ff3d] shadow-[0_0_10px_rgba(198,255,61,0.9)] motion-safe:animate-pulse" aria-hidden="true" /> : null}
        </button>
        <span aria-live="polite" className="font-mono text-xs font-bold text-white/45">{t('sell.ui.photos.count', { count: filled, max })}</span>
      </div>

      <div
        onDragEnter={(e) => { e.preventDefault(); if (!full) setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); if (!full) setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (!full) pick(e.dataTransfer?.files); }}
        className={`rounded-3xl border-2 border-dashed p-3 transition-all duration-300 sm:p-4 ${
          error ? 'border-red-400/60 bg-red-400/5' : dragging ? 'scale-[1.01] border-[#c6ff3d] bg-[#c6ff3d]/10' : 'border-white/10 bg-white/[0.02]'
        }`}
      >
        <p className="mb-3 text-center text-[13px] font-semibold text-white/60">
          {dragging ? t('sell.ui.photos.drop_here') : t('sell.upload_dropzone_title')}
        </p>
        <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3">
          {Array.from({ length: max }, (_, i) => (
            <li key={i} className="min-w-0">
              {tile(i)}
              <p className={`mt-1.5 line-clamp-2 text-center text-[11px] leading-tight ${i === filled && !full ? 'font-bold text-white' : 'text-white/45'}`}>
                {i + 1}. {shotLabel(i)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            id="sell-photos"
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={full}
            aria-describedby={error ? 'sell-photos-err' : undefined}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#c6ff3d] px-5 py-3 text-sm font-black text-[#10140a] shadow-[0_10px_30px_-12px_rgba(198,255,61,0.6)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus size={17} aria-hidden="true" /> {coarse ? t('sell.ui.photos.gallery') : t('sell.upload_btn_browse')}
          </button>
          {coarse ? (
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={full}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.05] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera size={17} aria-hidden="true" /> {t('sell.ui.photos.camera')}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p id="sell-photos-err" role="alert" className="mt-2.5 flex items-start gap-1.5 text-xs font-semibold text-red-300">
          <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" /> <span>{error}</span>
        </p>
      ) : null}
      {showingExisting ? <p className="mt-2.5 text-xs text-white/50">{t('sell.ui.photos.replace_note')}</p> : null}
      {notices.map((n) => <p key={n} className="mt-2.5 text-xs text-amber-300/90" role="status">{t(`sell.ui.photos.${n}`)}</p>)}
      {flagged.length ? (
        <ul className="mt-2.5 space-y-1" role="status">
          {flagged.flatMap(({ i, q }) => [
            q.blurry ? <li key={`b${i}`} className="flex items-start gap-1.5 text-xs text-amber-300/90"><AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />{t('sell.ui.photos.quality_blurry_msg', { n: i + 1 })}</li> : null,
            q.small ? <li key={`s${i}`} className="flex items-start gap-1.5 text-xs text-amber-300/90"><AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />{t('sell.ui.photos.quality_small_msg', { n: i + 1 })}</li> : null,
          ])}
        </ul>
      ) : null}
    </div>
  );
}
