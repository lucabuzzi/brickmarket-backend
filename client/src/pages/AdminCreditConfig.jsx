import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowLeft, SlidersHorizontal, Check, Loader2 } from 'lucide-react';

const LABELS = {
  signup_bonus: 'Bonus Registrazione',
  referral_bonus: 'Bonus Referral',
  sale_bonus: 'Bonus Vendita',
  purchase_bonus: 'Bonus Acquisto',
  maturation_days: 'Giorni di Maturazione',
  min_order_amount: 'Importo Minimo Ordine (EUR)',
  daily_bonus_cap_per_user: 'Tetto Giornaliero per Utente',
  monthly_bonus_cap_per_user: 'Tetto Mensile per Utente',
  monthly_bonus_cap_per_pair: 'Tetto Mensile per Coppia Compratore-Venditore',
};

const UNITS = {
  signup_bonus: 'CR',
  referral_bonus: 'CR',
  sale_bonus: 'CR',
  purchase_bonus: 'CR',
  maturation_days: 'giorni',
  min_order_amount: '€',
  daily_bonus_cap_per_user: 'CR',
  monthly_bonus_cap_per_user: 'CR',
  monthly_bonus_cap_per_pair: 'CR',
};

export default function AdminCreditConfig() {
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [savedKey, setSavedKey] = useState(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/admin/credit-config');
      setConfig(data.config || []);
      setError('');
    } catch {
      setError('Errore nel caricamento della configurazione crediti.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (key) => {
    const draft = drafts[key];
    const value = parseFloat(draft);
    if (!Number.isFinite(value) || value < 0) {
      setError('Valore non valido: deve essere un numero maggiore o uguale a 0.');
      return;
    }

    setSavingKey(key);
    setError('');
    try {
      await apiFetch(`/api/admin/credit-config/${key}`, { method: 'PUT', body: { value } });
      setSavedKey(key);
      setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
      await fetchConfig();
      setDrafts((d) => { const next = { ...d }; delete next[key]; return next; });
    } catch (err) {
      setError(err?.data?.error || 'Errore nel salvataggio del valore.');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading && config.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold-500 mr-3" />
        Caricamento configurazione crediti...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <div className="mb-8">
        <Link to="/admin" className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-2 text-sm">
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
          <SlidersHorizontal className="text-gold-400" /> Configurazione Crediti
        </h1>
        <p className="text-stone-400">
          Valori del sistema crediti, mai hardcoded nel codice. Include i bonus di guadagno e i tetti anti-abuso giornalieri/mensili.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#120f0a] rounded-2xl border border-stone-800 overflow-hidden shadow-2xl divide-y divide-stone-800/50">
        {config.map((item) => {
          const draftValue = drafts[item.key] ?? String(item.value);
          const isDirty = draftValue !== String(item.value);
          return (
            <div key={item.key} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{LABELS[item.key] || item.key}</span>
                  {item.isDefault && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/10 text-amber-400">
                      Default di codice
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">{item.description}</p>
                )}
                {item.updatedAt && (
                  <p className="text-[10px] text-stone-600 mt-1">
                    Ultimo aggiornamento: {new Date(item.updatedAt).toLocaleString('it-IT')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftValue}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.key]: e.target.value }))}
                  className="w-28 px-3 py-2 rounded-xl bg-black/30 border border-stone-700 text-white text-sm text-right outline-none focus:border-gold-500 transition-colors"
                />
                <span className="text-[11px] text-stone-500 w-14">{UNITS[item.key] || ''}</span>
                <button
                  type="button"
                  disabled={!isDirty || savingKey === item.key}
                  onClick={() => handleSave(item.key)}
                  className="px-3 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 min-w-[84px] justify-center"
                >
                  {savingKey === item.key ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : savedKey === item.key ? (
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
