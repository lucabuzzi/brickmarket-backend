import { useRef } from 'react';
import { Camera, Check, ImagePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ShotGlyph from './ShotGlyph';
import { CARD_REQUIRED_SHOTS, nextShot } from '../../lib/sell/cards';

// Guided photo flow for card listings: one step at a time (front, back, corners, then two optional ones), each
// with its instruction and a big "take photo" button. The photo you add lands in the next free position, so the
// order of the shots is the order of the gallery (position 1 is the cover). The crop editor opens after each one.
export default function CardShotGuide({ photoCount, shots, onAdd }) {
  const { t } = useTranslation();
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const total = shots.length;
  const { index, required, done } = nextShot(photoCount, total);
  const shot = shots[index];

  const pick = (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = ''; // so the same file can be picked again
    if (list.length) onAdd(list);
  };

  return (
    <section className="mb-4 overflow-hidden rounded-3xl border border-[#c6ff3d]/25 bg-[#c6ff3d]/[0.04] p-4 sm:p-5" aria-labelledby="card-shot-title">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={pick} />

      <ol className="mb-4 flex gap-1.5" aria-label={t('sell.ui.cards.guide_progress')}>
        {shots.map((id, i) => (
          <li
            key={id}
            aria-current={!done && i === index ? 'step' : undefined}
            className={`flex h-7 flex-1 items-center justify-center rounded-full text-[11px] font-black ${
              i < photoCount ? 'bg-[#c6ff3d] text-[#10140a]' : !done && i === index ? 'border-2 border-[#c6ff3d] text-[#c6ff3d]' : 'border border-white/15 text-white/35'
            }`}
          >
            {i < photoCount ? <Check size={13} strokeWidth={3.5} aria-hidden="true" /> : i + 1}
          </li>
        ))}
      </ol>

      {done ? (
        <p id="card-shot-title" className="text-center text-sm font-semibold text-white/80">{t('sell.ui.cards.guide_done')}</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-[#c6ff3d]/60 text-[#c6ff3d]">
              <ShotGlyph id={shot} size={40} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">
                {t('sell.ui.cards.guide_step', { n: index + 1, total })} · {required ? t('sell.ui.cards.guide_required') : t('sell.ui.cards.guide_optional')}
              </p>
              <h3 id="card-shot-title" className="text-lg font-black text-white">{t(`sell.ui.shots.${shot}.label`)}</h3>
              <p className="text-[13px] leading-snug text-white/60">{t(`sell.ui.shots.${shot}.tip`)}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => cameraRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c6ff3d] px-4 py-3 text-sm font-black text-[#10140a] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <Camera size={18} aria-hidden="true" /> {t('sell.ui.cards.guide_take')}
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/60">
              <ImagePlus size={18} aria-hidden="true" /> {t('sell.ui.cards.guide_gallery')}
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-white/40">{t('sell.ui.cards.guide_minimum', { count: CARD_REQUIRED_SHOTS })}</p>
        </>
      )}
    </section>
  );
}
