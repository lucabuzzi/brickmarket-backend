import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const TYPE_LABELS = {
  deposit: 'Ricarica',
  contest_entry: 'Ingresso Sfida',
  contest_refund: 'Rimborso Sfida',
  payout: 'Vincita',
  shop_purchase: 'Acquisto Shop'
};

export default function AdminWalletTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const fetchTransactions = async (currentOffset = 0, filterUserId = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: String(limit), offset: String(currentOffset) });
      if (filterUserId) params.set('userId', filterUserId);
      const data = await apiFetch(`/api/admin/wallet/transactions?${params.toString()}`);
      setTransactions(data.transactions);
      setTotal(data.total);
      setError('');
    } catch {
      setError('Errore nel caricamento dello storico transazioni wallet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(0, '');
  }, []);

  const handleFilter = (e) => {
    e.preventDefault();
    setOffset(0);
    fetchTransactions(0, userIdFilter.trim());
  };

  const goToPage = (newOffset) => {
    setOffset(newOffset);
    fetchTransactions(newOffset, userIdFilter.trim());
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold-500 mr-3" />
        Caricamento storico wallet...
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
            <Wallet className="text-gold-400" /> Storico Transazioni Crediti
          </h1>
          <p className="text-stone-400">Registro completo, immutabile, di ogni movimento di credito su ogni wallet.</p>
        </div>
        <div className="bg-stone-800/50 px-4 py-2 rounded-xl border border-stone-700/50">
          <span className="text-stone-500 text-xs font-bold uppercase block">Totale Transazioni</span>
          <span className="text-white text-xl font-black">{total}</span>
        </div>
      </div>

      <form onSubmit={handleFilter} className="mb-6 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={userIdFilter}
          onChange={e => setUserIdFilter(e.target.value)}
          placeholder="Filtra per User ID (UUID)..."
          className="flex-1 min-w-[220px] px-4 py-2 rounded-xl bg-[#161209] border border-stone-700 text-white text-sm outline-none focus:border-gold-500 transition-colors"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-gold-500 hover:bg-gold-400 text-white text-xs font-black uppercase tracking-wider transition-colors">
          Filtra
        </button>
        {userIdFilter && (
          <button
            type="button"
            onClick={() => { setUserIdFilter(''); setOffset(0); fetchTransactions(0, ''); }}
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
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Tipo</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 text-right">Importo</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 text-right">Saldo Attuale</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Riferimento</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-stone-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{tx.username}</span>
                      <span className="text-[10px] text-stone-500">{tx.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-gold-500/10 text-gold-400">
                      {TYPE_LABELS[tx.type] || tx.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right text-sm font-bold flex items-center justify-end gap-1 ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.amount >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)} CR
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-stone-300">
                    {tx.currentBalance !== null ? `${tx.currentBalance.toFixed(2)} CR` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-stone-500 max-w-[220px] truncate">{tx.referenceId || '—'}</td>
                  <td className="px-4 py-3 text-right text-[11px] text-stone-400">
                    {new Date(tx.createdAt).toLocaleString('it-IT')}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-stone-500 text-sm">
                    Nessuna transazione trovata.
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
