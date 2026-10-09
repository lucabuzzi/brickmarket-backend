import { useTranslation } from 'react-i18next';

// Photo framing choice of the sell wizard: portrait (cards, tall boxes) or landscape. It only changes the
// aspect ratio the listing is shown with (card in lists, gallery on the detail page) — photos are never cropped
// or rotated when stored.
const OPTIONS = [
  { id: 'portrait', shape: 'h-9 w-6' },
  { id: 'landscape', shape: 'h-6 w-9' },
];

export default function OrientationPicker({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4">
      <p className="text-sm font-semibold text-white">{t('sell.ui.orientation.label')}</p>
      <p className="mt-0.5 text-xs text-white/55">{t('sell.ui.orientation.hint')}</p>
      <div role="radiogroup" aria-label={t('sell.ui.orientation.label')} className="mt-3 grid grid-cols-2 gap-2">
        {OPTIONS.map(({ id, shape }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(id)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'border-[#c6ff3d] bg-[#c6ff3d]/10 text-white' : 'border-white/10 text-white/70 hover:border-white/25'}`}
            >
              <span className={`${shape} shrink-0 rounded-[3px] border-2 ${active ? 'border-[#c6ff3d]' : 'border-white/40'}`} aria-hidden="true" />
              {t(`sell.ui.orientation.${id}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
