import { AlertCircle, ArrowRight, Lightbulb, PartyPopper, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatPrice, snippet } from '../../lib/sell/review';
import { PREVIEW_PLACEHOLDER } from '../../lib/sell/preview';

function Row({ label, onEdit, editLabel, children }) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/40">{label}</p>
        <div className="mt-1 text-[15px] font-semibold leading-snug text-white [overflow-wrap:anywhere]">{children}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${editLabel}: ${label}`}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/15 px-2.5 text-xs font-bold sm:px-3 text-white/70 transition-colors hover:border-[#c6ff3d]/50 hover:text-[#c6ff3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/50"
      >
        <Pencil size={14} aria-hidden="true" /> <span className="hidden sm:inline">{editLabel}</span>
      </button>
    </div>
  );
}

/**
 * The last step: everything the seller entered, each row with an "Edit" button that jumps back to its step,
 * and one clear message: either "ready" or the (few) things still missing, each with a way to fix it.
 * The publish button itself lives in the page's navigation bar, as on the other steps.
 */
export default function ReviewStep({ summary, blockers, hint, onEdit, onFix }) {
  const { t } = useTranslation();
  const edit = t('sell.ui.review.edit');
  const ready = blockers.length === 0;

  return (
    <div className="space-y-5">
      {ready ? (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-[#c6ff3d]/30 bg-[#c6ff3d]/[0.07] px-4 py-3.5">
          <PartyPopper size={20} className="mt-0.5 shrink-0 text-[#c6ff3d]" aria-hidden="true" />
          <div>
            <p className="text-sm font-black text-white">{t('sell.ui.review.ready_title')}</p>
            <p className="mt-0.5 text-[13px] text-white/60">{t('sell.ui.review.ready_sub')}</p>
          </div>
        </div>
      ) : (
        <div role="alert" className="rounded-2xl border border-amber-400/35 bg-amber-400/[0.07] px-4 py-3.5">
          <p className="flex items-center gap-2 text-sm font-black text-amber-100">
            <AlertCircle size={17} className="shrink-0 text-amber-300" aria-hidden="true" /> {t('sell.ui.review.blockers_title')}
          </p>
          <p className="mt-0.5 text-[13px] text-white/60">{t('sell.ui.review.blockers_sub')}</p>
          <ul className="mt-2.5 space-y-2">
            {blockers.map((b) => (
              <li key={b.field} className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2">
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-white/85">{t(`sell.ui.err.${b.code}`)}</span>
                <button
                  type="button"
                  onClick={() => onFix(b)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-300 px-2.5 py-1 text-xs font-black text-[#1a1304] transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {t('sell.ui.review.fix')} <ArrowRight size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4">
        {summary.photos.length ? (
          <div className="flex gap-2 overflow-x-auto py-4" role="img" aria-label={t('sell.ui.review.rows.photos')}>
            {summary.photos.map((src, i) => (
              <span key={`${src}-${i}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:h-24 sm:w-24">
                <img src={src} alt="" className="h-full w-full object-cover" />
                {i === 0 ? <span className="absolute inset-x-0 bottom-0 bg-[#c6ff3d] py-0.5 text-center text-[9px] font-black uppercase tracking-wider text-[#10140a]">{t('sell.cover_badge')}</span> : null}
              </span>
            ))}
          </div>
        ) : (
          <div className="py-4">
            <img src={PREVIEW_PLACEHOLDER} alt="" className="h-20 w-20 rounded-xl border border-white/10 object-cover opacity-60" />
          </div>
        )}

        <div className="divide-y divide-white/10 border-t border-white/10">
          <Row label={t('sell.ui.review.rows.what')} editLabel={edit} onEdit={() => onEdit('what')}>
            <span className="block">{summary.title || '—'}</span>
            {summary.what.length ? <span className="mt-0.5 block text-[13px] font-medium text-white/55">{summary.what.join(' · ')}</span> : null}
          </Row>
          <Row label={t('sell.ui.review.rows.photos')} editLabel={edit} onEdit={() => onEdit('photos')}>
            {t('sell.ui.review.photos_value', { n: summary.photoCount, max: summary.maxPhotos })}
          </Row>
          <Row label={t('sell.ui.review.rows.condition')} editLabel={edit} onEdit={() => onEdit('condition')}>
            {summary.condition || '—'}
            {summary.conditionExtras.length ? <span className="mt-0.5 block text-[13px] font-medium text-white/55">{summary.conditionExtras.join(' · ')}</span> : null}
          </Row>
          <Row label={t('sell.ui.review.rows.price')} editLabel={edit} onEdit={() => onEdit('price')}>
            {formatPrice(summary.price) ? <span className="text-xl font-black text-[#c6ff3d]">€ {formatPrice(summary.price)}</span> : '—'}
          </Row>
          <Row label={t('sell.ui.review.rows.shipping')} editLabel={edit} onEdit={() => onEdit('price')}>
            {summary.carriers.length ? summary.carriers.join(' · ') : '—'}
          </Row>
          <Row label={t('sell.ui.review.rows.description')} editLabel={edit} onEdit={() => onEdit('price')}>
            {summary.description ? <span className="font-medium text-white/75">{snippet(summary.description, 160)}</span> : <span className="font-medium text-white/45">{t('sell.ui.review.no_description')}</span>}
          </Row>
        </div>
      </div>

      {ready && hint ? (
        <p className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] text-white/60">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-[#c6ff3d]" aria-hidden="true" />
          <span>
            <span className="font-bold text-white/80">{t('sell.ui.review.tips_title')}: </span>
            {t(`sell.ui.hint.${hint}`)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
