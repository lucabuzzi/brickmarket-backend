import { useRef, useState } from 'react';
import { Camera, ImagePlus, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Photo picker of the sell wizard: click or drag & drop, new photos are ADDED to the selection (up to `max`),
// the first one is the cover. `previews` = [{ file, url }]. Existing photos (edit mode) are shown until
// new ones replace them. (The shot-by-shot guide "come fare la foto" is built on top of this in the next phase.)
export default function PhotoDropzone({ previews, existingImages = [], editing = false, error, notices = [], max = 5, onAdd, onRemove, resolveExisting }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const full = previews.length >= max;
  const hasNew = previews.length > 0;

  const pick = (list) => {
    const files = Array.from(list || []);
    if (files.length) onAdd(files);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer?.files);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        tabIndex={-1}
        className="sr-only"
        aria-hidden="true"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = ''; // so the same file can be picked again after removing it
        }}
      />

      <button
        id="sell-photos"
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={full}
        aria-describedby={error ? 'sell-photos-err' : undefined}
        onDragEnter={(e) => { e.preventDefault(); if (!full) setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); if (!full) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`group relative flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed text-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/50 disabled:cursor-not-allowed disabled:opacity-60 ${
          hasNew ? 'gap-1 px-4 py-5' : 'gap-3 px-5 py-10 sm:py-14'
        } ${
          error
            ? 'border-red-400/60 bg-red-400/5'
            : dragging
              ? 'scale-[1.01] border-[#c6ff3d] bg-[#c6ff3d]/10'
              : 'border-[#c6ff3d]/30 bg-[#c6ff3d]/[0.03] hover:border-[#c6ff3d]/60 hover:bg-[#c6ff3d]/[0.07]'
        }`}
      >
        <span className={`flex items-center justify-center rounded-full bg-[#c6ff3d]/12 text-[#c6ff3d] transition-transform duration-300 group-hover:scale-110 motion-reduce:transform-none ${hasNew ? 'h-10 w-10' : 'h-16 w-16 shadow-[0_0_40px_rgba(198,255,61,0.25)]'}`}>
          {hasNew ? <ImagePlus size={20} aria-hidden="true" /> : <Camera size={30} aria-hidden="true" />}
        </span>
        <span className="text-base font-black text-white">
          {dragging ? t('sell.ui.photos.drop_here') : hasNew ? t('sell.ui.photos.add_more') : t('sell.upload_dropzone_title')}
        </span>
        {!hasNew ? <span className="max-w-xs text-[13px] text-white/50">{t('sell.upload_dropzone_desc')}</span> : null}
        <span className="mt-1 font-mono text-xs font-bold text-white/40">{t('sell.ui.photos.count', { count: previews.length, max })}</span>
      </button>

      {error ? (
        <p id="sell-photos-err" role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-red-300">
          <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" /> <span>{error}</span>
        </p>
      ) : null}
      {notices.map((n) => (
        <p key={n} className="mt-2 text-xs text-amber-300/90" role="status">{t(`sell.ui.photos.${n}`)}</p>
      ))}

      {hasNew ? (
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {previews.map((p, i) => (
            <li key={p.url} className={`relative aspect-square overflow-hidden rounded-xl ${i === 0 ? 'ring-2 ring-[#c6ff3d] ring-offset-2 ring-offset-[#0d0c12]' : 'border border-white/10'}`}>
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              {i === 0 ? <span className="absolute inset-x-0 bottom-0 bg-[#c6ff3d] py-0.5 text-center text-[9px] font-black uppercase tracking-wider text-[#10140a]">{t('sell.cover_badge')}</span> : null}
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={t('sell.ui.photos.remove')}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : editing && existingImages.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-white/55">{t('sell.existing_images_label')}</p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {existingImages.map((img, i) => (
              <li key={`${img}-${i}`} className={`aspect-square overflow-hidden rounded-xl ${i === 0 ? 'ring-2 ring-[#c6ff3d] ring-offset-2 ring-offset-[#0d0c12]' : 'border border-white/10'}`}>
                <img src={resolveExisting ? resolveExisting(img) : img} alt="" className="h-full w-full object-cover" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
