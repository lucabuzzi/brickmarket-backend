import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowLeft, Sparkles, Check, Loader2 } from 'lucide-react';

const formatEuro = (cents) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);

// "12,5" / "12.50" -> 1250; null if not a valid amount.
function parseEuroToCents(input) {
  const n = parseFloat(String(input).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export default function AdminFeaturedPricing() {
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  const fetchTariffs = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/admin/featured-tariffs');
      setTariffs(data.tariffs || []);
      setError('');
    } catch {
      setError('Errore nel caricamento delle tariffe in evidenza.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTariffs();
  }, []);

  const handleSave = async (id) => {
    const priceCents = parseEuroToCents(drafts[id]);
    if (priceCents == null || priceCents < 50) {
      setError('Prezzo non valido: deve essere almeno 0,50 €.');
      return;
    }

    setSavingId(id);
    setError('');
    try {
      await apiFetch(`/api/admin/featured-tariffs/${id}`, { method: 'PUT', body: { priceCents } });
      setSavedId(id);
      setTimeout(() => setSavedId((s) => (s === id ? null : s)), 2000);
      await fetchTariffs();
      setDrafts((d) => { const next = { ...d }; delete next[id]; return next; });
    } catch (err) {
      setError(err?.data?.error || 'Errore nel salvataggio del prezzo.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading && tariffs.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold-500 mr-3" />
        Caricamento tariffe...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[900px] mx-auto">
      <div className="mb-8">
        <Link to="/admin" className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-2 text-sm">
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
          <Sparkles className="text-gold-400" /> Prezzi Messa in Evidenza
        </h1>
        <p className="text-stone-400 text-sm sm:text-base">
          Prezzi in euro delle messe in evidenza, pagabili solo con carta. Le durate sono fisse; il costo al giorno mostrato agli utenti è calcolato in automatico.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#120f0a] rounded-2xl border border-stone-800 overflow-hidden shadow-2xl divide-y divide-stone-800/50">
        {tariffs.map((tf) => {
          const savedValue = (tf.priceCents / 100).toFixed(2).replace('.', ',');
          const draftValue = drafts[tf.id] ?? savedValue;
          const isDirty = draftValue !== savedValue;
          const previewCents = parseEuroToCents(draftValue) ?? tf.priceCents;
          return (
            <div key={tf.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{tf.days} giorni</span>
                  {tf.isDefault && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/10 text-amber-400">
                      Default di codice
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                  L'utente vede: {formatEuro(previewCents)} per {tf.days} giorni ({formatEuro(Math.round(previewCents / tf.days))} al giorno)
                </p>
                {tf.updatedAt && (
                  <p className="text-[10px] text-stone-600 mt-1">
                    Ultimo aggiornamento: {new Date(tf.updatedAt).toLocaleString('it-IT')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  inputMode="decimal"
                  value={draftValue}
                  onChange={(e) => setDrafts((d) => ({ ...d, [tf.id]: e.target.value }))}
                  className="w-28 px-3 py-2 rounded-xl bg-black/30 border border-stone-700 text-white text-sm text-right outline-none focus:border-gold-500 transition-colors"
                />
                <span className="text-[11px] text-stone-500 w-6">€</span>
                <button
                  type="button"
                  disabled={!isDirty || savingId === tf.id}
                  onClick={() => handleSave(tf.id)}
                  className="px-3 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 min-w-[84px] justify-center"
                >
                  {savingId === tf.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : savedId === tf.id ? (
                    <Check size={14} />
                  ) : (
                    'Salva'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
