import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from '../context/CartContext';
import { apiFetch } from '../api';
import { Trash2, AlertTriangle, CheckCircle2, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CARRIERS } from './Sell';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const cardElementOptions = {
  style: {
    base: {
      color: '#f5f5f4',
      fontSize: '16px',
      '::placeholder': { color: '#78716c' },
    },
    invalid: { color: '#fb7185' },
  },
};

function CheckoutSidebar({ cart, total, shippingSelections, hasUnavailableItems, formatPrice, onSuccess }) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (cart.length === 0 || hasUnavailableItems || !stripe || !elements) return;

    setChecking(true);
    setError('');
    try {
      const { clientSecret } = await apiFetch('/api/payments/stripe/create-cart-payment-intent', {
        method: 'POST',
        body: { itemIds: cart.map(c => c.id), shippingSelections },
      });

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });

      if (result.error) {
        setError(result.error.message || t('wallet.payment_failed'));
        return;
      }

      onSuccess();
    } catch (err) {
      setError(err.message || t('wallet.payment_comm_error'));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#292524', padding: '1.5rem', borderRadius: '12px', border: '1px solid #44403c', position: 'sticky', top: '100px' }}>
      <h2 style={{ fontSize: '1.3rem', margin: '0 0 1.5rem 0', color: '#fff' }}>{t('cart.order_summary')}</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', color: '#a8a29e' }}>
        <span>{t('cart.items_count_label', { count: cart.length })}</span>
        <span>{formatPrice(total)}</span>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #44403c', margin: '1rem 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>
        <span>{t('cart.total_label')}</span>
        <span style={{ color: '#d4af37' }}>{formatPrice(total)}</span>
      </div>

      {hasUnavailableItems && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '1rem', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>{t('cart.remove_unavailable_notice')}</span>
        </div>
      )}

      {!hasUnavailableItems && (
        <>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            {t('wallet.card_details_label')}
          </label>
          <div style={{ backgroundColor: '#120f0a', border: '1px solid #44403c', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
            <CardElement options={cardElementOptions} />
          </div>
        </>
      )}

      {error && (
        <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fb7185', fontSize: '0.8rem', textAlign: 'center', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={checking || hasUnavailableItems || !stripe}
        style={{ width: '100%', backgroundColor: hasUnavailableItems ? '#57534e' : '#22c55e', color: '#fff', border: 'none', padding: '1rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: hasUnavailableItems ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
      >
        {checking ? t('cart.processing') : t('cart.checkout_button')}
      </button>

      <p style={{ fontSize: '0.7rem', color: '#78716c', textAlign: 'center', marginTop: '1rem', lineHeight: '1.4' }}>
        {t('wallet.secure_payment_notice')}
      </p>
    </div>
  );
}

export default function Cart() {
  const { t } = useTranslation();
  const { cart, removeFromCart, clearCart } = useCart();
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

  const handlePurchaseSuccess = () => {
    clearCart();
    setShowSuccessModal(true);
    setTimeout(() => {
      setShowSuccessModal(false);
      navigate('/', { replace: true });
    }, 3000);
  };

  const hasUnavailableItems = soldItems.length > 0;

  return (
    <div className="page cart-page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      
      {showSuccessModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: '#292524', border: '1px solid #22c55e', padding: '3rem', borderRadius: '16px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', maxWidth: '400px' }}>
             <CheckCircle2 color="#22c55e" size={64} style={{ marginBottom: '1rem' }} />
             <h2 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t('cart.purchase_complete_title')}</h2>
             <p style={{ color: '#a8a29e' }}>{t('cart.purchase_complete_subtitle')}</p>
          </div>
        </div>
      )}

      <h1 style={{ fontSize: '2rem', color: '#fff', marginBottom: '2rem' }}>{t('cart.title')}</h1>

      {cart.length === 0 ? (
        <div style={{ backgroundColor: '#292524', padding: '3rem', borderRadius: '12px', border: '1px solid #44403c', textAlign: 'center' }}>
          <p style={{ color: '#a8a29e', fontSize: '1.1rem', marginBottom: '1.5rem' }}>{t('cart.empty_message')}</p>
          <Link to="/" style={{ display: 'inline-block', backgroundColor: '#d4af37', color: '#fff', padding: '0.75rem 2rem', borderRadius: '8px', fontWeight: 'bold', textDecoration: 'none' }}>
            {t('cart.continue_shopping')}
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '2rem', alignItems: 'start' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {cart.map((item) => {
              const isSold = soldItems.includes(item.id);
              return (
                <div key={item.id} style={{ display: 'flex', backgroundColor: '#292524', borderRadius: '12px', border: isSold ? '1px solid #ef4444' : '1px solid #44403c', overflow: 'hidden', opacity: isSold ? 0.7 : 1 }}>
                  <div style={{ width: '150px', height: '120px', flexShrink: 0, backgroundColor: '#120f0a' }}>
                    <img src={Array.isArray(item.images) ? item.images[0] : item.image_url || 'https://picsum.photos/seed/placeholder/800/600'} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ padding: '1rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Link to={`/product/${item.id}`} style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'semibold', textDecoration: 'none', marginBottom: '0.25rem' }}>{item.title}</Link>
                      <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.2rem' }}>
                        <Trash2 size={20} />
                      </button>
                    </div>
                    
                    <p style={{ margin: 0, color: '#a8a29e', fontSize: '0.85rem' }}>{t('cart.seller_label')}: {item.seller?.username || t('details.unknown_seller')}</p>
                    
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#d4af37' }}>{formatPrice(item.price)}</span>
                      {isSold && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold' }}>
                          <AlertTriangle size={16} /> {t('cart.item_unavailable')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Shipping Options */}
                  {!isSold && fullItems[item.id]?.shipping_options?.length > 0 && (
                    <div style={{ borderTop: '1px solid #44403c', backgroundColor: '#120f0a', padding: '1rem' }}>
                      <p style={{ margin: '0 0 0.75rem 0', color: '#d6d3d1', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Truck size={14} /> {t('cart.choose_shipping')}
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {fullItems[item.id].shipping_options.map((opt) => {
                          const carrierInfo = CARRIERS.find(c => c.id === opt.carrier);
                          const isSelected = shippingSelections[item.id]?.carrier === opt.carrier;
                          
                          return (
                            <label key={opt.carrier} style={{ 
                              display: 'flex', alignItems: 'center', gap: '0.5rem', 
                              padding: '0.5rem 0.75rem', borderRadius: '8px', 
                              border: isSelected ? '1px solid #d4af37' : '1px solid #44403c',
                              backgroundColor: isSelected ? 'rgba(212,175,55,0.1)' : '#292524',
                              cursor: 'pointer', transition: 'all 0.2s', flex: '1 1 auto'
                            }}>
                              <input 
                                type="radio" 
                                name={`shipping-${item.id}`} 
                                checked={isSelected}
                                onChange={() => setShippingSelections(prev => ({ ...prev, [item.id]: { carrier: opt.carrier, cost: opt.cost } }))}
                                style={{ accentColor: '#d4af37', margin: 0 }}
                              />
                              {carrierInfo && <img src={carrierInfo.icon} alt={carrierInfo.name} style={{ height: '14px', width: 'auto', backgroundColor: '#fff', borderRadius: '2px', padding: '1px' }} />}
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ color: isSelected ? '#fff' : '#d6d3d1', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                  {carrierInfo?.name || opt.carrier}
                                </span>
                                <span style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                  {opt.cost == 0 ? t('cart.free_shipping') : `+ ${formatPrice(opt.cost)}`}
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

          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <CheckoutSidebar
                cart={cart}
                total={total}
                shippingSelections={shippingSelections}
                hasUnavailableItems={hasUnavailableItems}
                formatPrice={formatPrice}
                onSuccess={handlePurchaseSuccess}
              />
            </Elements>
          ) : (
            <div style={{ backgroundColor: '#292524', padding: '1.5rem', borderRadius: '12px', border: '1px solid #ef4444', color: '#fb7185', textAlign: 'center' }}>
              {t('wallet.stripe_not_configured')}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
