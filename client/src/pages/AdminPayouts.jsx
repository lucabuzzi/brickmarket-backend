import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowLeft, Landmark, CheckCircle2, Archive, RotateCcw } from 'lucide-react';

const TABS = [
  { id: 'pending', label: 'Da Pagare' },
  { id: 'paid', label: 'Pagati' },
  { id: 'archived', label: 'Archiviati' },
];

export default function AdminPayouts() {
  const [tab, setTab] = useState('pending');
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});

  const fetchPayouts = async (status) => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/admin/payouts?status=${status}`);
      setPayouts(data.payouts);
      setError('');
    } catch {
      setError('Errore nel caricamento dei payout venditori.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts(tab);
  }, [tab]);

  const formatPrice = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  const runAction = async (orderId, action, body) => {
    setBusyId(orderId);
    try {
      await apiFetch(`/api/admin/payouts/${orderId}/${action}`, { method: 'POST', body });
      await fetchPayouts(tab);
    } catch (err) {
      alert(err.data?.error || 'Operazione fallita.');
    } finally {
      setBusyId(null);
    }
  };

  const totalOwed = payouts.reduce((acc, p) => acc + p.sellerPayout, 0);

  if (loading && payouts.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gold-500 mr-3" />
        Caricamento payout venditori...
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
            <Landmark className="text-gold-400" /> Payout Venditori
          </h1>
          <p className="text-stone-400">
            L'acquirente paga CardBrix via Stripe; il pagamento al venditore è un'operazione manuale (bonifico, PayPal, ecc.) che registri qui.
          </p>
        </div>
        {tab === 'pending' && (
          <div className="bg-stone-800/50 px-4 py-2 rounded-xl border border-stone-700/50">
            <span className="text-stone-500 text-xs font-bold uppercase block">Totale da pagare</span>
            <span className="text-white text-xl font-black">{formatPrice(totalOwed)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
              tab === t.id ? 'bg-gold-500 text-white' : 'bg-stone-800 text-stone-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Annuncio</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Venditore</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Acquirente</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 text-right">Da pagare al venditore</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Data ordine</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500">Nota (IBAN/rif.)</th>
                {tab !== 'archived' && <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-500 text-right">Azioni</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/50">
              {payouts.map((p) => (
                <tr key={p.orderId} className="hover:bg-stone-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold text-white">{p.listingTitle}</span>
                    {p.setNumber && <span className="text-[10px] text-stone-500 block">{p.setNumber}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-300">{p.sellerUsername}</td>
                  <td className="px-4 py-3 text-sm text-stone-300">{p.buyerUsername}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gold-400">{formatPrice(p.sellerPayout)}</td>
                  <td className="px-4 py-3 text-[11px] text-stone-400">{new Date(p.createdAt).toLocaleDateString('it-IT')}</td>
                  <td className="px-4 py-3">
                    {tab === 'pending' ? (
                      <input
                        type="text"
                        value={noteDrafts[p.orderId] ?? ''}
                        onChange={e => setNoteDrafts(prev => ({ ...prev, [p.orderId]: e.target.value }))}
                        placeholder="Es. bonifico IBAN ****1234"
                        className="w-full min-w-[160px] px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-white text-xs outline-none focus:border-gold-500"
                      />
                    ) : (
                      <span className="text-[11px] text-stone-400">{p.payoutNotes || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {tab === 'pending' && (
                      <button
                        disabled={busyId === p.orderId}
                        onClick={() => runAction(p.orderId, 'mark-paid', { notes: noteDrafts[p.orderId] || '' })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                      >
                        <CheckCircle2 size={14} /> Segna come pagato
                      </button>
                    )}
                    {tab === 'paid' && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={busyId === p.orderId}
                          onClick={() => runAction(p.orderId, 'unmark')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                          title="Annulla, torna a 'da pagare'"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          disabled={busyId === p.orderId}
                          onClick={() => runAction(p.orderId, 'archive')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500/10 hover:bg-gold-500/20 text-gold-400 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                        >
                          <Archive size={14} /> Archivia
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && !loading && (
                <tr>
                  <td colSpan={tab === 'archived' ? 6 : 7} className="px-4 py-12 text-center text-stone-500 text-sm">
                    Nessun payout in questa categoria.
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
