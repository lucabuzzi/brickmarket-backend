import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowLeft, RotateCcw, Package, User, CreditCard, Truck } from 'lucide-react';

export default function AdminArchive() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchArchive = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/admin/archive');
      setItems(data);
    } catch (err) {
      setError('Errore nel caricamento dell\'archivio amministrativo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  const handleRestore = async (id) => {
    if (!window.confirm('Vuoi davvero ripristinare questo annuncio e rimetterlo in vendita?')) return;
    try {
      await apiFetch(`/api/admin/listings/${id}/restore`, { method: 'POST' });
      // Update local state
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      alert('Errore durante il ripristino dell\'annuncio.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500 mr-3" />
        Caricamento Vault...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/admin" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2 text-sm">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Admin Vault</h1>
          <p className="text-slate-400">Storico completo delle transazioni e degli annunci archiviati.</p>
        </div>
        <div className="bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700/50">
          <span className="text-slate-500 text-xs font-bold uppercase block">Totale Elementi</span>
          <span className="text-white text-xl font-black">{items.length}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 mb-6 flex items-center gap-3">
          <Package className="shrink-0" /> {error}
        </div>
      )}

      <div className="bg-[#0f172a] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-800">
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Annuncio</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Stato</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Soggetto</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Prezzo</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Spedizione</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right text-cyan-400">Fee</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Data</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white truncate max-w-[200px]">{item.title}</span>
                      <span className="text-[10px] text-slate-500">ID: {item.id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      item.status === 'sold' ? 'bg-green-500/10 text-green-400' : 
                      item.status === 'expired' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase w-4">S:</span>
                        <span className="text-[11px] text-white">{item.seller_username || '---'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase w-4">B:</span>
                        <span className="text-[11px] text-white">{item.buyer_username || '---'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-white">
                    €{Number(item.listing_price || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-medium text-slate-300">€{Number(item.shipping_cost || 0).toFixed(2)}</span>
                      <span className="text-[9px] text-slate-500 uppercase">{item.selected_carrier || '---'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-cyan-400">
                    €{Number(item.platform_fee || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[11px] text-slate-400">
                      {new Date(item.archived_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(item.status === 'expired' || item.status === 'removed') && (
                      <button 
                        onClick={() => handleRestore(item.id)}
                        className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all shadow-sm"
                        title="Ripristina Annuncio"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-slate-500 text-sm">
                    Nessun elemento archiviato trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
