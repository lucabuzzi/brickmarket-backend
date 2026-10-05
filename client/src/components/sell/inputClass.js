// Shared look of every input in the sell wizard (landing-page language: dark glass, lime focus ring).
// Kept apart from FormField.jsx so that file only exports components (React fast refresh).
export const inputCls = (invalid = false) =>
  `w-full rounded-xl border bg-white/[0.04] px-4 py-3 text-[15px] text-white placeholder:text-white/30 transition-colors focus:outline-none focus:ring-2 ${
    invalid
      ? 'border-red-400/70 focus:border-red-400 focus:ring-red-400/25'
      : 'border-white/10 hover:border-white/20 focus:border-[#c6ff3d]/60 focus:ring-[#c6ff3d]/20'
  }`;
