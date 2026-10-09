import { useCallback, useEffect, useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { CROP_ASPECTS, CROP_ASPECT_IDS, initialCropAspect } from '../../lib/sell/crop';
import { cropImageFile } from './cropImage';

// Full-screen crop editor for one photo. Drag to move, pinch (or the slider) to zoom, pick the frame shape.
// "Crop" hands back a new File, "Use whole photo" / Escape hands back null (keep the original untouched).
export default function CropEditor({ file, imageOrientation, onDone }) {
  const { t } = useTranslation();
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectId, setAspectId] = useState(() => initialCropAspect(imageOrientation));
  const [area, setArea] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  // Keep the page behind from scrolling while the editor is open, and let Escape mean "keep the whole photo".
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onDone(null); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onDone]);

  const onCropComplete = useCallback((_percent, pixels) => setArea(pixels), []);

  async function apply() {
    if (!area || busy) return;
    setBusy(true);
    const cropped = await cropImageFile(file, area);
    setBusy(false);
    onDone(cropped); // null (could not crop) falls back to keeping the original
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={t('sell.ui.crop.title')} className="fixed inset-0 z-[100] flex flex-col bg-[#07060b]">
      <div className="shrink-0 px-4 pb-2 pt-3">
        <p className="text-sm font-bold text-white">{t('sell.ui.crop.title')}</p>
        <p className="text-xs text-white/55">{t('sell.ui.crop.hint')}</p>
      </div>

      <div className="relative min-h-0 flex-1">
        <Cropper
          image={url}
          crop={crop}
          zoom={zoom}
          aspect={CROP_ASPECTS[aspectId]}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid
        />
      </div>

      <div className="shrink-0 space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div role="radiogroup" aria-label={t('sell.ui.crop.shape')} className="grid grid-cols-3 gap-2">
          {CROP_ASPECT_IDS.map((id) => {
            const active = aspectId === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setAspectId(id)}
                className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${active ? 'border-[#c6ff3d] bg-[#c6ff3d]/10 text-white' : 'border-white/10 text-white/70'}`}
              >
                {t(`sell.ui.crop.aspect_${id}`)}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-3 text-xs font-semibold text-white/60">
          {t('sell.ui.crop.zoom')}
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-6 flex-1 accent-[#c6ff3d]"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onDone(null)} disabled={busy} className="rounded-xl border border-white/15 px-3 py-3 text-sm font-semibold text-white/80 disabled:opacity-50">
            {t('sell.ui.crop.use_full')}
          </button>
          <button type="button" onClick={apply} disabled={busy || !area} className="rounded-xl bg-[#c6ff3d] px-3 py-3 text-sm font-black text-[#10140a] disabled:opacity-50">
            {busy ? t('sell.ui.crop.working') : t('sell.ui.crop.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}
