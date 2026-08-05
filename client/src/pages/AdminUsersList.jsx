import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowLeft, Users, Coins, ShieldCheck } from 'lucide-react';

export default function AdminUsersList() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchUsers = async (currentOffset = 0, currentSearch = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: String(limit), offset: String(currentOffset) });
      if (currentSearch) params.set('search', currentSearch);
      const data = await apiFetch(`/api/admin/users?${params.toString()}`);
      setUsers(data.users);
      setTotal(data.total);
      setError('');
    } catch {
      setError('Errore nel caricamento dell\'elenco utenti.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(0, '');
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setOffset(0);
    fetchUsers(0, search.trim());
  };

  const goToPage = (newOffset) => {
    setOffset(newOffset);
    fetchUsers(newOffset, search.trim());
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold-500 mr-3" />
        Caricamento utenti...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <Link to="/admin" className="flex items-center gap-2 text-stone-400 hover:text-white transition-colors mb-2 text-sm">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Users className="text-gold-400" /> Utenti Registrati
          </h1>
          <p className="text-stone-400">Elenco completo degli account con il saldo crediti wallet di ciascuno.</p>
        </div>
        <div className="bg-stone-800/50 px-4 py-2 rounded-xl border border-stone-700/50">
          <span className="text-stone-500 text-xs font-bold uppercase block">Totale Utenti</span>
          <span className="text-white text-xl font-black">{total}</span>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per username o email..."
          className="flex-1 min-w-[220px] px-4 py-2 rounded-xl bg-[#161209] border border-stone-700 text-white text-sm outline-none focus:border-gold-500 transition-colors"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-white text-xs font-black uppercase tracking-wider transition-colors">
          Cerca
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setOffset(0); fetchUsers(0, ''); }}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-black uppercase tracking-wider transition-colors"
          >
            Reset
          </button>
        )}
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 mb-6">
          {error}
        </div>
      )}

      <div className="bg-[#120f0a] rounded-2xl border border-stone-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-900/50 border-b border-stone-800">
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Utente</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Ruolo</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Stato</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 text-right">Crediti Wallet</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 text-right">Registrato il</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-stone-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        {u.username}
                        {u.role === 'admin' && <ShieldCheck size={13} className="text-gold-400" />}
                      </span>
                      <span className="text-[10px] text-stone-500">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-stone-800 text-stone-300">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${u.isActive !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {u.isActive !== false ? 'Attivo' : 'Disattivato'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-gold-400">
                      <Coins size={13} />
                      {u.balanceCredits !== null ? `${u.balanceCredits.toFixed(2)} CR` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[11px] text-stone-400">
                    {new Date(u.createdAt).toLocaleDateString('it-IT')}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-stone-500 text-sm">
                    Nessun utente trovato.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > limit && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            disabled={offset === 0}
            onClick={() => goToPage(Math.max(0, offset - limit))}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Precedente
          </button>
          <span className="text-stone-500 text-xs">
            {offset + 1}–{Math.min(offset + limit, total)} di {total}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => goToPage(offset + limit)}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Successiva
          </button>
        </div>
      )}
    </div>
  );
}
