import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowLeft, Users, Activity, TrendingUp, UserPlus } from 'lucide-react';

export default function AdminInteractions() {
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInteractions = async () => {
      try {
        setLoading(true);
        const data = await apiFetch('/api/admin/analytics/interactions');
        setInteractions(data);
      } catch (err) {
        setError('Errore nel caricamento dei dati di interazione.');
      } finally {
        setLoading(false);
      }
    };
    fetchInteractions();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500 mr-3" />
        Analisi Network in corso...
      </div>
    );
  }

  // Grouping for top pairings logic (already ordered by backend, but we can refine UI here)
  const topPairings = interactions.slice(0, 10);

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/admin" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2 text-sm">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Interaction Insight</h1>
          <p className="text-slate-400">Analisi comportamentale e connessioni tra utenti della piattaforma.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interaction Matrix / Heatmap Card */}
        <div className="lg:col-span-2 bg-[#0f172a] rounded-2xl border border-slate-800 p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="text-cyan-400" size={20} /> Network Matrix
            </h2>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Traffic Mapping</span>
          </div>

          <div className="aspect-video bg-slate-900/50 rounded-xl border border-slate-800/50 flex items-center justify-center relative overflow-hidden">
            {/* Visual placeholder for the "Heatmap Matrix" since we don't use heavy chart libs */}
            <div className="absolute inset-0 grid grid-cols-10 grid-rows-6 opacity-20">
               {Array.from({ length: 60 }).map((_, i) => (
                 <div key={i} className="border border-slate-800" />
               ))}
            </div>
            
            <div className="relative z-10 grid grid-cols-5 md:grid-cols-8 gap-4 p-4 w-full h-full content-center">
              {interactions.slice(0, 24).map((inter, i) => (
                <div 
                  key={i}
                  className="aspect-square rounded-lg border border-cyan-500/30 flex flex-col items-center justify-center transition-all hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/20"
                  style={{ 
                    backgroundColor: `rgba(6, 182, 212, ${Math.min(inter.trade_count * 0.15, 0.8)})`,
                    boxShadow: inter.trade_count > 3 ? '0 0 15px rgba(6, 182, 212, 0.4)' : 'none'
                  }}
                  title={`${inter.buyer_username} → ${inter.seller_username}: ${inter.trade_count} scambi`}
                >
                  <span className="text-[10px] font-black text-white">{inter.trade_count}</span>
                </div>
              ))}
            </div>

            <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
              <span>X: Top Buyers</span>
              <span>Y: Top Sellers</span>
            </div>
          </div>
          
          <div className="mt-6 flex gap-4">
            <div className="flex-1 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
               <span className="text-slate-500 text-[10px] font-black uppercase block mb-1">Density Index</span>
               <div className="flex items-baseline gap-2">
                 <span className="text-xl font-black text-white">4.8</span>
                 <span className="text-green-400 text-xs font-bold">+12%</span>
               </div>
            </div>
            <div className="flex-1 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
               <span className="text-slate-500 text-[10px] font-black uppercase block mb-1">Retention Rate</span>
               <div className="flex items-baseline gap-2">
                 <span className="text-xl font-black text-white">62%</span>
                 <span className="text-cyan-400 text-xs font-bold">Stable</span>
               </div>
            </div>
          </div>
        </div>

        {/* Top Pairings List */}
        <div className="bg-[#0f172a] rounded-2xl border border-slate-800 p-6 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="text-green-400" size={20} /> Top Pairings
            </h2>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
            {topPairings.map((pair, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      {i + 1}
                    </div>
                    <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider">High Frequency</span>
                  </div>
                  <span className="text-xs font-black text-white bg-green-500/10 px-2 py-0.5 rounded-full">
                    {pair.trade_count} trades
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                   <div className="flex flex-col">
                     <span className="text-[10px] text-slate-500 uppercase font-bold">Buyer</span>
                     <span className="text-sm font-bold text-white">{pair.buyer_username}</span>
                   </div>
                   <div className="h-px w-8 bg-slate-800" />
                   <div className="flex flex-col text-right">
                     <span className="text-[10px] text-slate-500 uppercase font-bold">Seller</span>
                     <span className="text-sm font-bold text-white">{pair.seller_username}</span>
                   </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Volume Totale</span>
                  <span className="text-xs font-black text-white">€{Number(pair.total_volume).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          <button className="mt-6 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-widest transition-all border border-slate-700">
            Esporta Report PDF
          </button>
        </div>
      </div>
    </div>
  );
}
