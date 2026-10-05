import { useState } from 'react';
import { ChevronDown, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ListingCard from '../ListingCard';
import CompletenessMeter from './CompletenessMeter';

// The real <ListingCard> fed with the form state, so the seller sees exactly what buyers will see.
// `inert` keeps its links out of the tab order and unclickable: it is a picture of the listing, not a listing.
function PreviewCard({ listing }) {
  return (
    <div inert aria-hidden="true" className="pointer-events-none select-none">
      <ListingCard l={listing} hideMissingSetNumber />
    </div>
  );
}

/** Desktop: sticky column next to the wizard. */
export function PreviewPanel({ listing, percent, hint }) {
  const { t } = useTranslation();
  return (
    <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start" aria-label={t('sell.ui.preview.title')}>
      <div className="relative rounded-[1.75rem] border border-white/10 bg-[#0d0c12]/90 p-5 shadow-[0_30px_80px_-40px_rgba(198,255,61,0.35)] backdrop-blur-xl">
        <span className="pointer-events-none absolute -inset-x-6 -top-10 h-40 rounded-full bg-[#c6ff3d]/10 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <Eye size={16} className="text-[#c6ff3d]" aria-hidden="true" /> {t('sell.ui.preview.title')}
          </p>
          <p className="mb-4 mt-0.5 text-xs text-white/45">{t('sell.ui.preview.hint')}</p>
          <div className="lx-float">
            <PreviewCard listing={listing} />
          </div>
          <div className="mt-5 border-t border-white/10 pt-4">
            <CompletenessMeter percent={percent} hint={hint} />
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Phones and tablets: a slim bar above the form that opens into the same preview. */
export function PreviewBar({ listing, percent, hint }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section className="lg:hidden" aria-label={t('sell.ui.preview.title')}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0c12]/90 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c6ff3d]/50"
        >
          <Eye size={16} className="shrink-0 text-[#c6ff3d]" aria-hidden="true" />
          <span className="text-sm font-black text-white">{t('sell.ui.preview.toggle')}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <span className="block h-full rounded-full bg-gradient-to-r from-[#c6ff3d] to-[#e4ff8f] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
          </span>
          <span className="font-mono text-sm font-black tabular-nums text-white">{percent}%</span>
          <span className="text-xs font-semibold text-white/50">{open ? t('sell.ui.preview.hide') : t('sell.ui.preview.show')}</span>
          <ChevronDown size={16} className={`shrink-0 text-white/50 transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <div className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="mx-auto max-w-[340px] px-4 pb-4 pt-1">
              <p className="mb-3 text-xs text-white/45">{t('sell.ui.preview.title')} · {t('sell.ui.preview.hint')}</p>
              <PreviewCard listing={listing} />
              <div className="mt-4">
                <CompletenessMeter percent={percent} hint={hint} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
