import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowLeft, Sparkles, Package } from 'lucide-react';

const FEATURE_DAYS = [7, 14, 30];

function featuredActive(l) {
  if (!l.is_featured) return false;
  if (!l.featured_until) return true;
  return new Date(l.featured_until) > new Date();
}

export default function AdminListings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | featured | plain
  const [busyId, setBusyId] = useState(null);

  const fetchRows = async (currentSearch = '', currentFilter = 'all') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (currentSearch) params.set('search', currentSearch);
      if (currentFilter === 'featured') params.set('featured', 'true');
      if (currentFilter === 'plain') params.set('featured', 'false');
      const data = await apiFetch(`/api/admin/listings?${params.toString()}`);
      setRows(Array.isArray(data) ? data : []);
      setError('');
    } catch {
      setError('Errore nel caricamento degli annunci.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows('', 'all');
  }, []);

  const applyFeature = async (id, body) => {
    try {
      setBusyId(id);
      const res = await apiFetch(`/api/admin/listings/${id}/feature`, { method: 'POST', body });
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...res.listing } : r));
    } catch (err) {
      alert(err?.data?.error || err.message || 'Errore nella gestione evidenza.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRows(search.trim(), filter);
  };

  const changeFilter = (f) => {
    setFilter(f);
    fetchRows(search.trim(), f);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <Link to="/admin" className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-2 text-sm">
          <ArrowLeft size={16} /> Dashboard
        </Link>
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
          <Sparkles className="text-gold-400" /> Annunci — In Evidenza
        </h1>
        <p className="text-stone-400">Metti o togli manualmente un annuncio dalle sezioni &ldquo;in evidenza&rdquo; della home. Gratuito, senza scadenza se scegli &infin;.</p>
      </div>

      <form onSubmit={handleSearch} className="mb-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per titolo o venditore..."
          className="flex-1 min-w-[220px] px-4 py-2 rounded-xl bg-[#161209] border border-stone-700 text-white text-sm outline-none focus:border-gold-500 transition-colors"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-white text-xs font-black uppercase tracking-wider transition-colors">
          Cerca
        </button>
      </form>

      <div className="mb-6 flex gap-2">
        {[['all', 'Tutti'], ['featured', 'In evidenza'], ['plain', 'Non in evidenza']].map(([f, label]) => (
          <button
            key={f}
            onClick={() => changeFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${
              filter === f ? 'bg-gold-500 text-white' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 mb-6">{error}</div>
      )}

      <div className="bg-[#120f0a] rounded-2xl border border-stone-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-900/50 border-b border-stone-800">
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Annuncio</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Stato</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 text-right">Prezzo</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Evidenza</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50">
              {rows.map((l) => {
                const isFeat = featuredActive(l);
                return (
                  <tr key={l.id} className={`hover:bg-stone-800/20 transition-colors ${busyId === l.id ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <Link to={`/product/${l.id}`} className="text-sm font-bold text-white hover:text-gold-400">{l.title}</Link>
                        <span className="text-[10px] text-stone-500">
                          {l.seller_username}{(l.type === 'auction' || l.is_auction) ? ' · asta' : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        l.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-stone-800 text-stone-400'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gold-400">
                      {l.price != null ? `€${parseFloat(l.price).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {isFeat ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gold-300">
                          <Sparkles size={12} />
                          {l.featured_until
                            ? `fino al ${new Date(l.featured_until).toLocaleDateString('it-IT')}`
                            : 'senza scadenza'}
                          <span className="text-stone-600 ml-1">({l.featured_source || '—'})</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        {FEATURE_DAYS.map(d => (
                          <button
                            key={d}
                            disabled={busyId === l.id || l.status !== 'active'}
                            onClick={() => applyFeature(l.id, { days: d })}
                            className="px-2 py-1 rounded-md bg-stone-800 hover:bg-gold-500 hover:text-white text-stone-300 text-[10px] font-black transition-colors disabled:opacity-30"
                            title={`Metti in evidenza per ${d} giorni`}
                          >
                            {d}g
                          </button>
                        ))}
                        <button
                          disabled={busyId === l.id || l.status !== 'active'}
                          onClick={() => applyFeature(l.id, { pin: true })}
                          className="px-2 py-1 rounded-md bg-stone-800 hover:bg-gold-500 hover:text-white text-stone-300 text-[10px] font-black transition-colors disabled:opacity-30"
                          title="Metti in evidenza senza scadenza"
                        >
                          &infin;
                        </button>
                        {isFeat && (
                          <button
                            disabled={busyId === l.id}
                            onClick={() => applyFeature(l.id, { unfeature: true })}
                            className="px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500 hover:text-white text-red-400 text-[10px] font-black transition-colors disabled:opacity-30"
                          >
                            Rimuovi
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-stone-500 text-sm">
                    <Package size={28} className="mx-auto mb-3 opacity-30" />
                    Nessun annuncio trovato.
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
