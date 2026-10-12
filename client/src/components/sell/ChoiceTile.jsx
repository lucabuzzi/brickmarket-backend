import { Check } from 'lucide-react';

// Full literal Tailwind fragments per pillar accent (lime = Annunci, orange = Aste), so dynamic
// picking never hides a class from Tailwind's build-time scan (it only generates CSS for class
// strings it finds verbatim in source).
const ACCENT = {
  lime: { ring: 'focus-visible:ring-[#c6ff3d]/50', selected: 'border-[#c6ff3d]/70 bg-[#c6ff3d]/10 text-white shadow-[0_0_0_1px_rgba(198,255,61,0.25),0_12px_30px_-14px_rgba(198,255,61,0.45)]', badge: 'bg-[#c6ff3d] text-[#10140a]' },
  orange: { ring: 'focus-visible:ring-pillar-auctions/50', selected: 'border-pillar-auctions/70 bg-pillar-auctions/10 text-white shadow-[0_0_0_1px_rgba(255,90,54,0.25),0_12px_30px_-14px_rgba(255,90,54,0.45)]', badge: 'bg-pillar-auctions text-white' },
};

/** One selectable option (product type, game, category, condition). Part of a role="radiogroup". */
export default function ChoiceTile({ selected, onClick, icon, label, compact = false, accent = 'lime' }) {
  const a = ACCENT[accent] || ACCENT.lime;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`group relative flex min-h-[56px] items-center justify-center rounded-2xl border text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${a.ring} ${
        compact ? 'flex-row gap-2 px-3 py-2.5' : 'flex-col gap-1.5 px-1 py-3.5 sm:px-2'
      } ${
        selected
          ? a.selected
          : 'border-white/10 bg-white/[0.03] text-white/60 hover:-translate-y-0.5 hover:border-white/25 hover:text-white'
      }`}
    >
      {icon ? <span className={compact ? 'text-lg' : 'text-2xl'} aria-hidden="true">{icon}</span> : null}
      <span className={`font-bold leading-tight ${compact ? 'text-[13px]' : 'text-[11px] sm:text-[13px]'}`}>{label}</span>
      {selected ? (
        <span className={`absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full ${a.badge}`} aria-hidden="true">
          <Check size={11} strokeWidth={3.5} />
        </span>
      ) : null}
    </button>
  );
}
