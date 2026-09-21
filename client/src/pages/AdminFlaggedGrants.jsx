import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowLeft, ShieldAlert, Check, X } from 'lucide-react';

const REASON_LABELS = {
  daily_cap_exceeded: 'Tetto giornaliero superato',
  monthly_cap_exceeded: 'Tetto mensile superato',
  pair_cap_exceeded: 'Tetto mensile per coppia superato',
};

export default function AdminFlaggedGrants() {
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);

  const fetchGrants = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/admin/credit-bonus-grants/flagged');
      setGrants(data.grants || []);
      setError('');
    } catch {
      setError('Errore nel caricamento dei bonus in revisione.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrants();
  }, []);

  const handleReview = async (grantId, decision) => {
    const confirmMsg = decision === 'approve'
      ? 'Confermi l\'approvazione? Il bonus viene accreditato subito sul wallet.'
      : 'Confermi il rigetto? Il bonus non verrà mai accreditato.';
    if (!window.confirm(confirmMsg)) return;

    setReviewingId(grantId);
    setError('');
    try {
      await apiFetch(`/api/admin/credit-bonus-grants/${grantId}/review`, {
        method: 'POST',
        body: { decision },
      });
      await fetchGrants();
    } catch (err) {
      setError(err?.data?.error || 'Errore nella revisione del bonus.');
    } finally {
      setReviewingId(null);
    }
  };

  if (loading && grants.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold-500 mr-3" />
        Caricamento bonus in revisione...
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
          <ShieldAlert className="text-amber-400" /> Bonus in Revisione
        </h1>
        <p className="text-stone-400">
          Bonus vendita/acquisto bloccati perché supererebbero un tetto anti-abuso configurato in Configurazione Crediti. Il cron di maturazione li ignora finché non li approvi o respingi qui.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#120f0a] rounded-2xl border border-stone-800 overflow-hidden shadow-2xl divide-y divide-stone-800/50">
        {grants.length === 0 ? (
          <div className="px-4 py-12 text-center text-stone-500 text-sm">
            Nessun bonus in revisione al momento.
          </div>
        ) : (
          grants.map((grant) => (
            <div key={grant.id} className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{grant.username} ({grant.email})</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/10 text-amber-400">
                    {REASON_LABELS[grant.flag_reason] || grant.flag_reason}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {grant.type === 'sale_bonus' ? 'Bonus vendita' : 'Bonus acquisto'} · {parseFloat(grant.amount).toFixed(2)} CR · "{grant.listing_title}"
                </p>
                <p className="text-[10px] text-stone-600 mt-1">
                  Ordine {grant.order_id} · creato il {new Date(grant.created_at).toLocaleString('it-IT')}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  disabled={reviewingId === grant.id}
                  onClick={() => handleReview(grant.id, 'reject')}
                  className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <X size={14} /> Respingi
                </button>
                <button
                  type="button"
                  disabled={reviewingId === grant.id}
                  onClick={() => handleReview(grant.id, 'approve')}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={14} /> Approva
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
