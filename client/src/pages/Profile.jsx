import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiFetch, normalizeImageUrl } from '../api';
import BrickRating from '../components/BrickRating';
import { Package, Tag, CheckCircle, PlusCircle, Hammer, ShoppingCart, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardStatCard from '../components/DashboardStatCard';
import ListingCard from '../components/ListingCard';

export default function Profile() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [purchases, setPurchases] = useState([]);
  const [listings, setListings] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);

  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackOrder, setFeedbackOrder] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const [purchasesError, setPurchasesError] = useState(null);
  const [listingsError, setListingsError] = useState(null);
  const [bidsError, setBidsError] = useState(null);

  const refreshData = async () => {
    setLoading(true);
    try {
      const pRes = await apiFetch('/api/orders/me');
      setPurchases(Array.isArray(pRes) ? pRes : []);
      setPurchasesError(null);
    } catch (err) {
      console.error('Orders fetch error:', err);
      setPurchasesError('Impossibile caricare gli acquisti.');
    }
    try {
      const lRes = await apiFetch('/api/listings/user/me');
      setListings(Array.isArray(lRes) ? lRes : []);
      setListingsError(null);
    } catch (err) {
      console.error('Listings fetch error:', err);
      setListingsError('Impossibile caricare gli annunci.');
    }
    try {
      const bRes = await apiFetch('/api/users/bids/me');
      setBids(Array.isArray(bRes) ? bRes : []);
      setBidsError(null);
    } catch (err) {
      console.error('Bids fetch error:', err);
      setBidsError('Impossibile caricare le tue offerte.');
    }
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const openFeedback = (order) => {
    setFeedbackOrder(order);
    setRating(0);
    setComment('');
    setFeedbackModalOpen(true);
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    if (rating === 0) return alert('Seleziona almeno un Brick.');
    setSubmittingFeedback(true);
    try {
      await apiFetch(`/api/orders/${feedbackOrder.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment })
      });
      setFeedbackModalOpen(false);
      refreshData();
    } catch (err) {
      alert(err.message || 'Errore nel salvataggio');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
    </div>
  );

  const formatPrice = (v) => {
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
  };

  const canSell = user && (user.role === 'seller' || user.role === 'both');

  // Stats Calculations
  const activeListingsCount = listings.filter(l => l.status === 'active').length;
  const soldListingsCount = listings.filter(l => l.status === 'sold').length;
  const totalBids = bids.length;
  const totalPurchases = purchases.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 w-full font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-black text-white tracking-tight">Il Mio Profilo</h1>
        {canSell && (
          <Link to="/sell" className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-lg transition-colors font-bold shadow-lg shadow-amber-600/20">
            <PlusCircle size={20} /> Nuovo Annuncio
          </Link>
        )}
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <DashboardStatCard title="Annunci Attivi" value={activeListingsCount} icon={Activity} />
        <DashboardStatCard title="Articoli Venduti" value={soldListingsCount} icon={Tag} />
        <DashboardStatCard title="Offerte Piazzate" value={totalBids} icon={Hammer} />
        <DashboardStatCard title="Acquisti" value={totalPurchases} icon={ShoppingCart} />
      </div>

      {/* I Miei Annunci */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2 border-b border-slate-700/50 pb-3">
          <Tag size={22} className="text-sky-400" /> I Miei Annunci
        </h2>
        {listingsError ? (
          <p className="text-red-500 bg-red-500/10 p-4 rounded-lg">{listingsError}</p>
        ) : listings.length === 0 ? (
          <div className="text-center py-12 bg-[#0f172a]/50 border border-slate-800 rounded-xl border-dashed">
            <p className="text-slate-400 mb-4">Non hai ancora creato annunci.</p>
            {canSell && (
              <Link to="/sell" className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors font-bold">
                <PlusCircle size={16} /> Crea il tuo primo annuncio
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {listings.map(item => (
              <ListingCard key={item.id} l={item} />
            ))}
          </div>
        )}
      </section>

      {/* Le Mie Offerte */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2 border-b border-slate-700/50 pb-3">
          <Hammer size={22} className="text-amber-500" /> {t('profile.my_bids') || 'Le Mie Offerte'}
        </h2>
        {bidsError ? (
          <p className="text-red-500 bg-red-500/10 p-4 rounded-lg">{bidsError}</p>
        ) : bids.length === 0 ? (
          <div className="text-center py-12 bg-[#0f172a]/50 border border-slate-800 rounded-xl border-dashed">
            <p className="text-slate-400">Non hai ancora partecipato a nessuna asta.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bids.map(item => {
              const outbid = item.bidStatus === 'outbid';
              const winning = item.bidStatus === 'winning';
              const won = item.bidStatus === 'won';
              return (
                <div key={item.id} className={`bg-[#0f172a] rounded-xl overflow-hidden hover:scale-[1.02] transition-all duration-300 shadow-sm flex flex-col border ${outbid ? 'border-red-500/50 hover:border-red-500 shadow-red-500/10' : (winning || won ? 'border-emerald-500/50 hover:border-emerald-500 shadow-emerald-500/10' : 'border-slate-700 hover:border-slate-500')}`}>
                  <div className="p-4 flex-1 flex flex-col">
                    <Link to={`/product/${item.id}`} className="text-white font-bold text-base sm:text-lg mb-4 hover:text-sky-400 transition-colors line-clamp-2 leading-tight">{item.title}</Link>
                    <div className="mt-auto flex justify-between items-end">
                      <div>
                        <p className="text-[10px] sm:text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">Offerta Attuale</p>
                        <p className="text-xl sm:text-2xl font-black text-amber-400 leading-none">{formatPrice(item.current_bid || item.starting_price)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {winning && <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded uppercase tracking-wider">In Vantaggio</span>}
                        {won && <span className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-black rounded uppercase shadow-sm tracking-wider">Vinta</span>}
                        {item.bidStatus === 'lost' && <span className="px-2 py-1 bg-slate-800 text-slate-400 text-[10px] font-bold rounded uppercase tracking-wider">Persa</span>}
                        {outbid && (
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="px-2 py-1 bg-red-500/10 text-red-400 text-[10px] font-black rounded uppercase tracking-wider">Superata</span>
                            <Link to={`/product/${item.id}`} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 text-xs rounded font-bold transition-colors">Rilancia</Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* I Miei Acquisti */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2 border-b border-slate-700/50 pb-3">
          <Package size={22} className="text-emerald-500" /> I Miei Acquisti
        </h2>
        {purchasesError ? (
          <p className="text-red-500 bg-red-500/10 p-4 rounded-lg">{purchasesError}</p>
        ) : purchases.length === 0 ? (
          <div className="text-center py-12 bg-[#0f172a]/50 border border-slate-800 rounded-xl border-dashed">
            <p className="text-slate-400">Non hai ancora effettuato acquisti.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {purchases.map(order => (
              <div key={order.id} className="bg-[#0f172a] border border-slate-700 hover:border-slate-500 rounded-xl overflow-hidden hover:scale-[1.02] transition-all duration-300 shadow-sm flex h-32">
                <div className="w-32 h-full shrink-0 bg-slate-800 border-r border-slate-800">
                  {order.listing_images && order.listing_images[0] ? (
                    <img src={normalizeImageUrl(order.listing_images[0])} alt={order.listing_title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600"><Package size={24} /></div>
                  )}
                </div>
                <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between overflow-hidden">
                  <div>
                    <Link to={`/product/${order.listing_id}`} className="text-white font-bold text-sm sm:text-base line-clamp-2 hover:text-sky-400 transition-colors leading-tight mb-1">{order.listing_title || 'Articolo sconosciuto'}</Link>
                    <p className="text-xs text-slate-400 font-mono">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-end justify-between mt-1">
                    <p className="text-base sm:text-lg font-black text-sky-400 leading-none">{formatPrice(order.total_buyer)}</p>
                    {order.feedback_id ? (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                        <CheckCircle size={12} /> Feedback
                      </span>
                    ) : (
                      <button onClick={() => openFeedback(order)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 sm:px-3 sm:py-1 text-[10px] sm:text-xs rounded font-bold transition-colors shadow-lg shadow-emerald-600/20">
                        Lascia Feedback
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Feedback Modal */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-[#0f172a] border border-slate-700 p-6 sm:p-8 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-white font-black text-2xl mb-2">Valuta il Venditore</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Lascia un Brick-Rating per l'ordine di <strong className="text-white">{feedbackOrder?.listing_title}</strong>.
              </p>
              <form onSubmit={submitFeedback}>
                <div className="flex justify-center mb-8 bg-slate-900/50 py-4 rounded-xl border border-slate-800">
                  <BrickRating value={rating} interactive={true} onChange={setRating} />
                </div>
                <div className="mb-6">
                  <label className="block text-slate-300 font-bold mb-2 text-sm uppercase tracking-wider">Commento (opzionale)</label>
                  <textarea 
                    value={comment} 
                    onChange={e => setComment(e.target.value)} 
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl text-white p-4 min-h-[100px] resize-y focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-sm" 
                    placeholder="Scrivi qui la tua esperienza..." 
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setFeedbackModalOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 py-3 rounded-xl font-bold transition-colors">
                    Annulla
                  </button>
                  <button type="submit" disabled={submittingFeedback} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                    {submittingFeedback ? 'Invio in corso...' : 'Invia Feedback'}
                  </button>
                </div>
              </form>
            </div>
            {/* Decorative blob for modal */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-600/10 rounded-full blur-2xl z-0 pointer-events-none"></div>
          </div>
        </div>
      )}
    </div>
  );
}
