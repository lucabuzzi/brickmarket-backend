import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { apiFetch, apiUrl } from '../api';
import { Trash2, AlertTriangle, CheckCircle2, Truck } from 'lucide-react';
import { CARRIERS } from './Sell';

export default function Cart() {
  const { cart, removeFromCart, clearCart } = useCart();
  const [checking, setChecking] = useState(false);
  const [soldItems, setSoldItems] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const navigate = useNavigate();

  const [shippingSelections, setShippingSelections] = useState({});
  const [fullItems, setFullItems] = useState({});

  // Validate items instantly when the cart page loads
  useEffect(() => {
    async function checkStatuses() {
      if (cart.length === 0) return;
      try {
        const results = await Promise.all(
          cart.map(item => apiFetch(`/api/listings/${item.id}`).catch(() => null))
        );
        const newlySold = [];
        const fetchedItems = {};
        const initialShipping = {};
        
        results.forEach((res, index) => {
          if (res) {
            fetchedItems[res.id] = res;
            if (res.status === 'sold' || res.status === 'expired') {
              newlySold.push(cart[index].id);
            } else if (res.shipping_options && Array.isArray(res.shipping_options) && res.shipping_options.length > 0) {
              initialShipping[res.id] = { carrier: res.shipping_options[0].carrier, cost: res.shipping_options[0].cost };
            }
          }
        });
        setSoldItems(newlySold);
        setFullItems(fetchedItems);
        setShippingSelections(prev => ({ ...initialShipping, ...prev }));
      } catch (err) {
        console.error('Error checking item status', err);
      }
    }
    checkStatuses();
  }, [cart]);

  const total = cart.reduce((acc, curr) => {
    const price = typeof curr.price === 'string' ? parseFloat(curr.price) : curr.price;
    const itemCost = isNaN(price) ? 0 : price;
    const shipping = shippingSelections[curr.id]?.cost || 0;
    return acc + itemCost + parseFloat(shipping);
  }, 0);

  const formatPrice = (v) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (soldItems.length > 0) return; // Prevent checkout if there are sold items
    
    setChecking(true);
    try {
      const res = await fetch(apiUrl('/api/listings/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('brickmarket_token')}` },
        body: JSON.stringify({ itemIds: cart.map(c => c.id), shippingSelections })
      });
      if (res.ok) {
        clearCart();
        setShowSuccessModal(true);
        setTimeout(() => {
          setShowSuccessModal(false);
          navigate('/', { replace: true });
        }, 3000);
      } else {
        alert('Si è verificato un errore durante il checkout.');
      }
    } catch (err) {
      alert('Impossibile completare il checkout al momento.');
    } finally {
      setChecking(false);
    }
  };

  const hasUnavailableItems = soldItems.length > 0;

  return (
    <div className="page cart-page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      
      {showSuccessModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #22c55e', padding: '3rem', borderRadius: '16px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', maxWidth: '400px' }}>
             <CheckCircle2 color="#22c55e" size={64} style={{ marginBottom: '1rem' }} />
             <h2 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Acquisto Completato!</h2>
             <p style={{ color: '#94a3b8' }}>L'articolo è ora segnato come venduto. Sarai reindirizzato alla Home.</p>
          </div>
        </div>
      )}

      <h1 style={{ fontSize: '2rem', color: '#fff', marginBottom: '2rem' }}>Il tuo Carrello</h1>

      {cart.length === 0 ? (
        <div style={{ backgroundColor: '#1e293b', padding: '3rem', borderRadius: '12px', border: '1px solid #334155', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', marginBottom: '1.5rem' }}>Il tuo carrello è attualmente vuoto.</p>
          <Link to="/" style={{ display: 'inline-block', backgroundColor: '#38bdf8', color: '#0f172a', padding: '0.75rem 2rem', borderRadius: '8px', fontWeight: 'bold', textDecoration: 'none' }}>
            Continua lo shopping
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '2rem', alignItems: 'start' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {cart.map((item) => {
              const isSold = soldItems.includes(item.id);
              return (
                <div key={item.id} style={{ display: 'flex', backgroundColor: '#1e293b', borderRadius: '12px', border: isSold ? '1px solid #ef4444' : '1px solid #334155', overflow: 'hidden', opacity: isSold ? 0.7 : 1 }}>
                  <div style={{ width: '150px', height: '120px', flexShrink: 0, backgroundColor: '#0f172a' }}>
                    <img src={Array.isArray(item.images) ? item.images[0] : item.image_url || 'https://picsum.photos/seed/placeholder/800/600'} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ padding: '1rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Link to={`/product/${item.id}`} style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'semibold', textDecoration: 'none', marginBottom: '0.25rem' }}>{item.title}</Link>
                      <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}>
                        <Trash2 size={20} />
                      </button>
                    </div>
                    
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>Venditore: {item.seller?.username || 'Sconosciuto'}</p>
                    
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#38bdf8' }}>{formatPrice(item.price)}</span>
                      {isSold && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold' }}>
                          <AlertTriangle size={16} /> ARTICOLO ESAURITO
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Shipping Options */}
                  {!isSold && fullItems[item.id]?.shipping_options?.length > 0 && (
                    <div style={{ borderTop: '1px solid #334155', backgroundColor: '#0f172a', padding: '1rem' }}>
                      <p style={{ margin: '0 0 0.75rem 0', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Truck size={14} /> Scegli la Spedizione:
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {fullItems[item.id].shipping_options.map((opt) => {
                          const carrierInfo = CARRIERS.find(c => c.id === opt.carrier);
                          const isSelected = shippingSelections[item.id]?.carrier === opt.carrier;
                          
                          return (
                            <label key={opt.carrier} style={{ 
                              display: 'flex', alignItems: 'center', gap: '0.5rem', 
                              padding: '0.5rem 0.75rem', borderRadius: '8px', 
                              border: isSelected ? '1px solid #38bdf8' : '1px solid #334155',
                              backgroundColor: isSelected ? 'rgba(56,189,248,0.1)' : '#1e293b',
                              cursor: 'pointer', transition: 'all 0.2s', flex: '1 1 auto'
                            }}>
                              <input 
                                type="radio" 
                                name={`shipping-${item.id}`} 
                                checked={isSelected}
                                onChange={() => setShippingSelections(prev => ({ ...prev, [item.id]: { carrier: opt.carrier, cost: opt.cost } }))}
                                style={{ accentColor: '#38bdf8', margin: 0 }}
                              />
                              {carrierInfo && <img src={carrierInfo.icon} alt={carrierInfo.name} style={{ height: '14px', width: 'auto', backgroundColor: '#fff', borderRadius: '2px', padding: '1px' }} />}
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ color: isSelected ? '#fff' : '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                  {carrierInfo?.name || opt.carrier}
                                </span>
                                <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                  {opt.cost == 0 ? 'GRATIS' : `+ ${formatPrice(opt.cost)}`}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', border: '1px solid #334155', position: 'sticky', top: '100px' }}>
            <h2 style={{ fontSize: '1.3rem', margin: '0 0 1.5rem 0', color: '#fff' }}>Riepilogo Ordine</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: '#94a3b8' }}>
              <span>Articoli ({cart.length}):</span>
              <span>{formatPrice(total)}</span>
            </div>
            
            <hr style={{ border: 'none', borderTop: '1px solid #334155', margin: '1rem 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>
              <span>Totale:</span>
              <span style={{ color: '#38bdf8' }}>{formatPrice(total)}</span>
            </div>

            {hasUnavailableItems && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '1rem', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>Rimuovi gli articoli esauriti per poter procedere con l'acquisto.</span>
              </div>
            )}

            <button 
              onClick={handleCheckout} 
              disabled={checking || hasUnavailableItems}
              style={{ width: '100%', backgroundColor: hasUnavailableItems ? '#475569' : '#22c55e', color: '#fff', border: 'none', padding: '1rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: hasUnavailableItems ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
            >
              {checking ? 'Elaborazione...' : "Procedi all'acquisto"}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
