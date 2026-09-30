import React from 'react';

// `accent` lets callers tie a stat card to the pillar it reports on — pass the FULL class,
// including the `group-hover:` prefix (e.g. "group-hover:text-pillar-listings"), so Tailwind's
// static scanner can see the literal token; building it from a partial value at render time
// (`group-hover:${accent}`) would never get generated. Every card used to hover gold regardless
// of what it measured; defaults to a neutral tone for stats that aren't pillar-specific.
export default function DashboardStatCard({ title, value, icon: Icon, trend, accent = 'group-hover:text-stone-100' }) {
  return (
    <div className="bg-[#120f0a] border border-stone-700 rounded-xl p-4 flex flex-col justify-between hover:scale-[1.02] hover:border-stone-500 transition-all duration-300 shadow-sm relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-stone-400 font-medium text-sm">{title}</h3>
        {Icon && (
          <div className={`p-2 bg-stone-800/50 rounded-lg text-stone-300 group-hover:bg-white/10 transition-colors ${accent}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      <div className="flex items-end justify-between relative z-10">
        <p className="text-2xl font-black text-white">{value}</p>
        {trend && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      {/* Decorative gradient blob */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-stone-800/50 rounded-full blur-2xl group-hover:bg-white/10 transition-colors duration-500 z-0"></div>
    </div>
  );
}
