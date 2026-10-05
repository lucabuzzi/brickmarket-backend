import { Check } from 'lucide-react';

/** One selectable option (product type, game, category, condition). Part of a role="radiogroup". */
export default function ChoiceTile({ selected, onClick, icon, label, compact = false }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`group relative flex min-h-[56px] items-center justify-center rounded-2xl border text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c6ff3d]/50 ${
        compact ? 'flex-row gap-2 px-3 py-2.5' : 'flex-col gap-1.5 px-1 py-3.5 sm:px-2'
      } ${
        selected
          ? 'border-[#c6ff3d]/70 bg-[#c6ff3d]/10 text-white shadow-[0_0_0_1px_rgba(198,255,61,0.25),0_12px_30px_-14px_rgba(198,255,61,0.45)]'
          : 'border-white/10 bg-white/[0.03] text-white/60 hover:-translate-y-0.5 hover:border-white/25 hover:text-white'
      }`}
    >
      {icon ? <span className={compact ? 'text-lg' : 'text-2xl'} aria-hidden="true">{icon}</span> : null}
      <span className={`font-bold leading-tight ${compact ? 'text-[13px]' : 'text-[11px] sm:text-[13px]'}`}>{label}</span>
      {selected ? (
        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#c6ff3d] text-[#10140a]" aria-hidden="true">
          <Check size={11} strokeWidth={3.5} />
        </span>
      ) : null}
    </button>
  );
}
