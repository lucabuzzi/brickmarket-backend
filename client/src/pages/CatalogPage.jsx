import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { Package, TrendingUp, Calendar, Hash, ArrowRight, ShoppingBag, PlusCircle, AlertCircle } from 'lucide-react';
import MarketValueBadge from '../components/MarketValueBadge';

export default function CatalogPage() {
  const { setNum } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/catalog/${setNum}`);
        setData(res);
        // SEO: set dynamic document title
        document.title = `LEGO ${res.name} ${res.set_num} - Valore di Mercato e Dettagli | BrickMarket`;
        
        // SEO: set dynamic meta description
        const description = `Scopri il valore di mercato attuale (€${res.pricing.marketValue}), pezzi (${res.num_parts}) e anno di uscita (${res.year}) del set LEGO ${res.name} (${res.set_num}) su BrickMarket.`;
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.name = 'description';
          document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', description);
      } catch (err) {
        setError('Impossibile caricare i dati del set.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [setNum]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-sky-500 mr-3" />
        Consultando il Catalogo...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Set non trovato</h1>
        <p className="text-slate-400 mb-8">{error || 'Il set richiesto non è presente nel nostro database.'}</p>
        <Link to="/" className="btn btn--primary">Torna alla Home</Link>
      </div>
    );
  }

  const { pricing } = data;

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto animate-fadeIn">
      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        <div className="lg:col-span-7 bg-[#0f172a] rounded-3xl border border-slate-800 p-8 flex items-center justify-center relative overflow-hidden group shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-50" />
          <img 
            src={data.img_url} 
            alt={data.name} 
            className="relative z-10 max-h-[400px] w-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] transform transition-transform group-hover:scale-105 duration-700" 
          />
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-8 shadow-xl flex-1 flex flex-col justify-center">
            <span className="text-sky-400 font-black tracking-widest text-xs uppercase mb-2 block">LEGO Catalog Reference</span>
            <h1 className="text-4xl font-black text-white leading-none tracking-tight mb-2 uppercase">{data.name}</h1>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono text-slate-500 font-bold">{data.set_num}</span>
              <div className="h-4 w-px bg-slate-800" />
              <span className="px-3 py-1 bg-slate-800 rounded-full text-xs font-bold text-slate-400 uppercase tracking-widest">Official Data</span>
            </div>
          </div>

          <div className="bg-sky-500 rounded-3xl p-8 shadow-xl shadow-sky-500/10 flex items-center justify-between group cursor-pointer overflow-hidden relative">
            <div className="relative z-10">
              <h3 className="text-sky-950 font-black text-xl mb-1 uppercase">Vendi il tuo</h3>
              <p className="text-sky-900 text-sm font-bold opacity-80">Pubblica un annuncio in 60 secondi</p>
            </div>
            <Link 
              to={`/sell?set=${data.set_num}`}
              className="absolute inset-0 z-20"
            />
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-sky-600 shadow-lg transform transition-transform group-hover:translate-x-2">
              <PlusCircle size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid Stats & Financials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Financials Card */}
        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-8 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={80} />
          </div>
          <h3 className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
            <TrendingUp size={14} /> Financial Insight
          </h3>
          
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Sealed / Mint Value</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">€{pricing.marketValue}</span>
                {pricing.appreciationPct > 0 && (
                  <span className="text-emerald-400 text-sm font-bold">+{pricing.appreciationPct}%</span>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-800/50" />

            <div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Used Market Value</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-300">€{pricing.low}</span>
                <span className="text-slate-500 text-xs font-medium">Est. Range</span>
              </div>
            </div>

            <div className="mt-4">
              <MarketValueBadge isTrending={pricing.isTrending} />
            </div>
          </div>
        </div>

        {/* Technical Specs Card */}
        <div className="bg-[#0f172a] rounded-3xl border border-slate-800 p-8 shadow-xl">
          <h3 className="text-slate-500 font-bold text-xs uppercase tracking-widest mb-8 flex items-center gap-2">
            <Package size={14} /> Tech Sheet
          </h3>
          
          <div className="grid grid-cols-2 gap-y-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar size={14} />
                <span className="text-[10px] font-black uppercase tracking-wider">Release Year</span>
              </div>
              <span className="text-xl font-black text-white">{data.year}</span>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-500">
                <Hash size={14} />
                <span className="text-[10px] font-black uppercase tracking-wider">Piece Count</span>
              </div>
              <span className="text-xl font-black text-white">{data.num_parts}</span>
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-500">
                <ShoppingBag size={14} />
                <span className="text-[10px] font-black uppercase tracking-wider">Status</span>
              </div>
              <span className={`text-xl font-black uppercase ${pricing.isRetired ? 'text-amber-500' : 'text-emerald-500'}`}>
                {pricing.isRetired ? 'Retired Product' : 'Currently Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Marketplace CTA Card */}
        <div className="bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-800 p-8 shadow-xl flex flex-col justify-between group">
           <div>
             <h3 className="text-white font-black text-xl mb-4 leading-tight uppercase">Cerchi questo set?</h3>
             <p className="text-slate-400 text-sm leading-relaxed mb-6">
               Controlla subito gli annunci attivi nel nostro marketplace. Potresti trovare offerte migliori del valore di mercato stimato.
             </p>
           </div>
           <Link 
             to={`/search-results?q=${data.set_num}`}
             className="flex items-center justify-between w-full p-4 bg-slate-800 rounded-2xl text-white font-bold text-sm hover:bg-slate-700 transition-all group-hover:border-sky-500/50 border border-transparent"
           >
             Vedi annunci attivi
             <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
           </Link>
        </div>
      </div>

      <div className="mt-12 text-center text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] border-t border-slate-800 pt-8">
        Reference Data sourced via Rebrickable API • Pricing estimated by BrickMarket Insight Engine
      </div>
    </div>
  );
}
