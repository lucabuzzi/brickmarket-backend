import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowLeft, ShieldAlert, Check, X } from 'lucide-react';

export default function AdminDisputes() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/admin/orders/disputed');
      setOrders(data.orders || []);
      setError('');
    } catch {
      setError('Errore nel caricamento delle contestazioni.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleResolve = async (orderId, outcome) => {
    const confirmMsg = outcome === 'refund'
      ? 'Confermi il rimborso? I bonus crediti già maturati su questo ordine verranno tolti dai wallet (fino a quanto ne resta). Il rimborso reale in euro va comunque eseguito a parte su Stripe.'
      : 'Confermi il rigetto della contestazione? L\'ordine torna a "completato".';
    if (!window.confirm(confirmMsg)) return;

    setResolvingId(orderId);
    setError('');
    try {
      await apiFetch(`/api/admin/orders/${orderId}/dispute-resolution`, {
        method: 'POST',
        body: { outcome },
      });
      await fetchDisputes();
    } catch (err) {
      setError(err?.data?.error || 'Errore nella risoluzione della contestazione.');
    } finally {
      setResolvingId(null);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold-500 mr-3" />
        Caricamento contestazioni...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="mb-8">
        <Link to="/admin" className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-2 text-sm">
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
          <ShieldAlert className="text-amber-400" /> Contestazioni Aperte
        </h1>
        <p className="text-stone-400">
          Risolvere qui non esegue il rimborso reale in euro (resta un'operazione manuale su Stripe): solo lo stato dell'ordine e il clawback dei bonus crediti.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#120f0a] rounded-2xl border border-stone-800 overflow-hidden shadow-2xl divide-y divide-stone-800/50">
        {orders.length === 0 ? (
          <div className="px-4 py-12 text-center text-stone-500 text-sm">
            Nessuna contestazione aperta al momento.
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm font-bold text-white">{order.listing_title}</span>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Compratore: {order.buyer_username} ({order.buyer_email}) — Venditore: {order.seller_username} ({order.seller_email})
                  </p>
                  <p className="text-[10px] text-stone-600 mt-1">
                    Ordine {order.id} · {parseFloat(order.total_buyer).toFixed(2)} € · aperta il {new Date(order.disputed_at).toLocaleString('it-IT')}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={resolvingId === order.id}
                    onClick={() => handleResolve(order.id, 'reject')}
                    className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <X size={14} /> Respingi
                  </button>
                  <button
                    type="button"
                    disabled={resolvingId === order.id}
                    onClick={() => handleResolve(order.id, 'refund')}
                    className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check size={14} /> Rimborsa
                  </button>
                </div>
              </div>
              <p className="text-xs text-stone-400 bg-black/30 border border-stone-800 rounded-xl p-3 whitespace-pre-wrap">
                {order.dispute_reason}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
