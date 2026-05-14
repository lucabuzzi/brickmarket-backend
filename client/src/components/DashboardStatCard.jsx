import React from 'react';

export default function DashboardStatCard({ title, value, icon: Icon, trend }) {
  return (
    <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 flex flex-col justify-between hover:scale-[1.02] hover:border-slate-500 transition-all duration-300 shadow-sm relative overflow-hidden group">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-slate-400 font-medium text-sm">{title}</h3>
        {Icon && (
          <div className="p-2 bg-slate-800/50 rounded-lg text-slate-300 group-hover:text-amber-400 group-hover:bg-amber-400/10 transition-colors">
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
      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-slate-800/50 rounded-full blur-2xl group-hover:bg-amber-600/20 transition-colors duration-500 z-0"></div>
    </div>
  );
}
