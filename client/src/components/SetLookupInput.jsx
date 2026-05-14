/**
 * SetLookupInput.jsx
 *
 * A smart input that accepts a LEGO set number, queries the backend
 * (which in turn uses Rebrickable API with DB caching), and returns
 * auto-filled data to the parent Sell form via `onSetFound` callback.
 *
 * Props:
 *   onSetFound(setData)  — called with the API response when a set is found
 *   onClear()            — called when the user clears the lookup
 *   condition            — current condition from Sell form ('new'|'used'|'complete'|'parts')
 *   className            — optional extra Tailwind classes for the container
 */

import { useState, useRef } from 'react';
import { Search, Loader2, CheckCircle, AlertCircle, X, ExternalLink } from 'lucide-react';
import { apiFetch } from '../api';
import MarketValueBadge from './MarketValueBadge';

export default function SetLookupInput({ onSetFound, onClear, condition = '', className = '' }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | found | not_found | error
  const [foundSet, setFoundSet] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const debounceRef = useRef(null);

  const handleLookup = async (setNum) => {
    const trimmed = setNum.trim();
    if (!trimmed) return;

    setStatus('loading');
    setFoundSet(null);
    setErrorMsg('');

    try {
      const data = await apiFetch(`/sets/lookup/${encodeURIComponent(trimmed)}`);
      setFoundSet(data);
      setPricing(data.pricing || null);
      setStatus('found');
      onSetFound?.(data);
    } catch (err) {
      if (err.status === 404) {
        setStatus('not_found');
        setErrorMsg(err.message || `Set "${trimmed}" non trovato.`);
      } else {
        setStatus('error');
        setErrorMsg('Errore di connessione. Puoi inserire i dati manualmente.');
      }
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setStatus('idle');
    setFoundSet(null);
    setErrorMsg('');
    onClear?.();

    // Debounce auto-lookup on typing (500ms after last keystroke)
    clearTimeout(debounceRef.current);
    if (val.trim().length >= 4) {
      debounceRef.current = setTimeout(() => handleLookup(val), 500);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    handleLookup(query);
  };

  const handleClear = () => {
    setQuery('');
    setStatus('idle');
    setFoundSet(null);
    setPricing(null);
    setErrorMsg('');
    onClear?.();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Label */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Ricerca Set LEGO
        </span>
        <span className="text-[10px] text-slate-600 italic">(opzionale)</span>
      </div>

      {/* Input Row */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            id="set-lookup-input"
            value={query}
            onChange={handleInputChange}
            placeholder="Inserisci numero set (es. 10281)"
            maxLength={20}
            className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-200"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!query.trim() || status === 'loading'}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all duration-200 shrink-0"
        >
          {status === 'loading' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          <span className="hidden sm:inline">Cerca</span>
        </button>
      </form>

      {/* Status Feedback */}
      {status === 'loading' && (
        <div className="flex items-center gap-2 text-xs text-slate-400 animate-pulse">
          <Loader2 size={13} className="animate-spin text-cyan-400" />
          <span>Ricerca in corso su Rebrickable...</span>
        </div>
      )}

      {status === 'not_found' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Set non trovato. </span>
            <span className="text-amber-400/80">Puoi comunque inserire i dettagli manualmente qui sotto.</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Found Set Card */}
      {status === 'found' && foundSet && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 animate-in slide-in-from-top-1 duration-300">
          {/* Thumbnail */}
          {foundSet.img_url ? (
            <img
              src={foundSet.img_url}
              alt={foundSet.name}
              className="w-16 h-16 object-contain rounded-lg bg-slate-800 border border-slate-700 shrink-0"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center text-slate-600 text-xs">
              N/A
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={13} className="text-emerald-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Set trovato!
              </span>
              <span className="text-[10px] text-slate-600 ml-auto">
                {foundSet.source === 'cache' ? '📦 cache' : '🌐 API'}
              </span>
            </div>
            <p className="text-sm font-bold text-white truncate">{foundSet.name}</p>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
              <span>{foundSet.set_num}</span>
              {foundSet.year && <span>·  {foundSet.year}</span>}
              {foundSet.num_parts && <span>· {foundSet.num_parts.toLocaleString()} pz</span>}
            </div>
            <p className="text-[11px] text-emerald-300/70 mt-1">
              I campi del form sono stati precompilati ↓
            </p>
          </div>

          {/* Rebrickable link */}
          {foundSet.rebrickable_url && (
            <a
              href={foundSet.rebrickable_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-cyan-400 transition-colors shrink-0"
              title="Vedi su Rebrickable"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      )}

      {/* Market Value Badge — shown after a successful lookup */}
      {status === 'found' && pricing && (
        <MarketValueBadge pricing={pricing} condition={condition} />
      )}
    </div>
  );
}
