import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from '../context/CartContext';
import { apiFetch } from '../api';
import { Trash2, AlertTriangle, CheckCircle2, Truck, Package, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CARRIERS } from './Sell';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const cardElementOptions = {
  style: {
    base: { color: '#f5f5f4', fontSize: '16px', '::placeholder': { color: '#78716c' } },
    invalid: { color: '#fb7185' },
  },
};

// Mirror of src/services/shipping.js eligibility — display only; the server
// re-checks at checkout.
function eligibleTcgTiers(tiers, cardCount, value) {
  const n = Number(cardCount) || 0;
  const v = Number(value) || 0;
  const rules = {
    tcg_plain: (nn, vv) => nn <= 4 && vv < 20,
    tcg_padded: (nn, vv) => nn <= 15 && vv < 20,
    tcg_registered: (nn, vv) => nn <= 40 && vv <= 100,
    tcg_parcel: () => true,
  };
  return tiers
    .filter((t) => (rules[t.id] || (() => true))(n, v))
    .sort((a, b) => a.price - b.price);
}

// Carriers common to every item in a physical group, priced at the group's
// max single-item rate; legacy flat-cost items raise every option.
function physicalGroupOptions(items) {
  const withCarriers = items.filter((it) => Array.isArray(it.shipping_options) && it.shipping_options.length > 0);
  const flatMax = items
    .filter((it) => !Array.isArray(it.shipping_options) || it.shipping_options.length === 0)
    .reduce((m, it) => Math.max(m, Number(it.shipping_cost) || 0), 0);

  if (withCarriers.length === 0) {
    return [{ carrier: null, cost: flatMax }];
  }

  const maps = withCarriers.map((it) => new Map(it.shipping_options.map((o) => [o.carrier, Number(o.cost) || 0])));
  let common = [...maps[0].keys()];
  for (const m of maps.slice(1)) common = common.filter((c) => m.has(c));

  return common
    .map((carrier) => ({
      carrier,
      cost: Math.max(flatMax, maps.reduce((mx, m) => Math.max(mx, m.get(carrier) || 0), 0)),
    }))
    .sort((a, b) => a.cost - b.cost);
}

function CheckoutSidebar({ groups, itemsSubtotal, resolveMethod, groupCost, hasUnavailableItems, formatPrice, itemCount, onSuccess }) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const shippingTotal = groups.reduce((acc, g) => acc + groupCost(g), 0);
  const total = itemsSubtotal + shippingTotal;

  const handleCheckout = async () => {
    if (itemCount === 0 || hasUnavailableItems || !stripe || !elements) return;
    setChecking(true);
    setError('');
    try {
      const itemIds = groups.flatMap((g) => g.items.map((i) => i.id));
      const selectionsByKey = {};
      groups.forEach((g) => {
        selectionsByKey[g.key] = { method: resolveMethod(g) };
      });

      const { clientSecret } = await apiFetch('/api/payments/stripe/create-cart-payment-intent', {
        method: 'POST',
        body: { itemIds, shippingSelections: selectionsByKey },
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

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: '#a8a29e' }}>
        <span>{t('cart.items_count_label', { count: itemCount })}</span>
        <span>{formatPrice(itemsSubtotal)}</span>
      </div>

      {groups.map((g) => (
        <div key={g.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: '#a8a29e', fontSize: '0.9rem' }}>
          <span>
            {t('cart.shipping_group_label', { seller: g.sellerName })}
            {g.macro === 'tcg' ? ` · ${t('cart.cards_suffix')}` : ''}
          </span>
          <span>{groupCost(g) === 0 ? t('cart.free_shipping') : formatPrice(groupCost(g))}</span>
        </div>
      ))}

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

  const [shippingSelections, setShippingSelections] = useState({}); // groupKey -> { method }
  const [fullItems, setFullItems] = useState({});
  const [tcgTiers, setTcgTiers] = useState([]);

  useEffect(() => {
    apiFetch('/api/shipping/tcg-tiers')
      .then((d) => setTcgTiers(Array.isArray(d?.tiers) ? d.tiers : []))
      .catch(() => setTcgTiers([]));
  }, []);

  useEffect(() => {
    async function checkStatuses() {
      if (cart.length === 0) return;
      try {
        const results = await Promise.all(
          cart.map((item) => apiFetch(`/api/listings/${item.id}`).catch(() => null))
        );
        const newlySold = [];
        const fetchedItems = {};
        results.forEach((res, index) => {
          if (res) {
            fetchedItems[res.id] = res;
            if (res.status === 'sold' || res.status === 'expired') newlySold.push(cart[index].id);
          }
        });
        setSoldItems(newlySold);
        setFullItems(fetchedItems);
      } catch (err) {
        console.error('Error checking item status', err);
      }
    }
    checkStatuses();
  }, [cart]);

  const formatPrice = (v) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  // Build shipping groups: one per (seller × macro-category), sold items excluded.
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of cart) {
      if (soldItems.includes(item.id)) continue;
      const full = fullItems[item.id];
      if (!full) continue;
      const macro = full.product_type === 'tcg' ? 'tcg' : 'physical';
      const sellerId = full.seller_id || full.seller?.username || 'unknown';
      const key = `${sellerId}::${macro}`;
      if (!map.has(key)) {
        map.set(key, {
          key, sellerId, macro,
          sellerName: full.seller?.username || item.seller?.username || t('details.unknown_seller'),
          items: [], fulls: [],
        });
      }
      map.get(key).items.push(item);
      map.get(key).fulls.push(full);
    }

    return [...map.values()].map((g) => {
      let options;
      if (g.macro === 'tcg') {
        const value = g.fulls.reduce((s, f) => s + (parseFloat(f.price) || 0), 0);
        options = eligibleTcgTiers(tcgTiers, g.fulls.length, value).map((tier) => ({
          method: tier.id, label: tier.label, cost: tier.price, tracked: tier.tracked,
        }));
      } else {
        options = physicalGroupOptions(g.fulls).map((o) => ({
          method: o.carrier, label: CARRIERS.find((c) => c.id === o.carrier)?.name || o.carrier || t('cart.shipping_standard'),
          cost: o.cost, tracked: false,
        }));
      }
      return { ...g, options };
    });
  }, [cart, fullItems, soldItems, tcgTiers, t]);

  // Effective method for a group: the buyer's explicit pick if it's still a
  // valid option, otherwise the cheapest option (derived, never stored — so no
  // seeding effect is needed).
  const selectedMethod = (g) => {
    const picked = shippingSelections[g.key]?.method;
    if (g.options.some((o) => o.method === picked)) return picked;
    return g.options[0]?.method ?? null;
  };

  const groupCost = (g) => {
    const opt = g.options.find((o) => o.method === selectedMethod(g)) || g.options[0];
    return opt ? opt.cost : 0;
  };

  const activeItems = cart.filter((i) => !soldItems.includes(i.id));
  const itemsSubtotal = activeItems.reduce((acc, curr) => {
    const price = typeof curr.price === 'string' ? parseFloat(curr.price) : curr.price;
    return acc + (isNaN(price) ? 0 : price);
  }, 0);

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Sold items that dropped out of any group still need to show so the
                buyer can remove them. */}
            {cart.filter((i) => soldItems.includes(i.id)).map((item) => (
              <div key={item.id} style={{ display: 'flex', backgroundColor: '#292524', borderRadius: '12px', border: '1px solid #ef4444', overflow: 'hidden', opacity: 0.7 }}>
                <div style={{ width: '150px', height: '120px', flexShrink: 0, backgroundColor: '#120f0a' }}>
                  <img src={Array.isArray(item.images) ? item.images[0] : item.image_url || 'https://picsum.photos/seed/placeholder/800/600'} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '1rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>{item.title}</span>
                    <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: '0.2rem' }}><Trash2 size={20} /></button>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    <AlertTriangle size={16} /> {t('cart.item_unavailable')}
                  </div>
                </div>
              </div>
            ))}

            {groups.map((g) => {
              const selMethod = selectedMethod(g);
              return (
                <div key={g.key} style={{ border: '1px solid #44403c', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#1c1917' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#292524', borderBottom: '1px solid #44403c', color: '#e7e5e4', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    <Package size={15} color="#d4af37" />
                    {t('cart.shipping_from', { seller: g.sellerName })}
                    {g.macro === 'tcg' && <span style={{ color: '#a8a29e', fontWeight: 'normal' }}>· {t('cart.cards_suffix')}</span>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {g.items.map((item) => (
                      <div key={item.id} style={{ display: 'flex', borderBottom: '1px solid #292524' }}>
                        <div style={{ width: '130px', height: '104px', flexShrink: 0, backgroundColor: '#120f0a' }}>
                          <img src={Array.isArray(item.images) ? item.images[0] : item.image_url || 'https://picsum.photos/seed/placeholder/800/600'} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ padding: '0.85rem 1rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Link to={`/product/${item.id}`} style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 600, textDecoration: 'none' }}>{item.title}</Link>
                            <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', padding: '0.2rem' }}><Trash2 size={18} /></button>
                          </div>
                          <span style={{ marginTop: 'auto', fontSize: '1.2rem', fontWeight: 'bold', color: '#d4af37' }}>{formatPrice(item.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* One shipping selector for the whole group */}
                  <div style={{ backgroundColor: '#120f0a', padding: '1rem' }}>
                    <p style={{ margin: '0 0 0.75rem 0', color: '#d6d3d1', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Truck size={14} /> {t('cart.choose_shipping')}
                      <span style={{ color: '#78716c', fontWeight: 'normal' }}>· {t('cart.one_shipment_note')}</span>
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {g.options.length === 0 && (
                        <span style={{ color: '#78716c', fontSize: '0.85rem' }}>{t('cart.shipping_unavailable')}</span>
                      )}
                      {g.options.map((opt) => {
                        const carrierInfo = CARRIERS.find((c) => c.id === opt.method);
                        const isSelected = selMethod === opt.method;
                        return (
                          <label key={String(opt.method)} style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.5rem 0.75rem', borderRadius: '8px',
                            border: isSelected ? '1px solid #d4af37' : '1px solid #44403c',
                            backgroundColor: isSelected ? 'rgba(212,175,55,0.1)' : '#292524',
                            cursor: 'pointer', flex: '1 1 auto',
                          }}>
                            <input
                              type="radio"
                              name={`shipping-${g.key}`}
                              checked={isSelected}
                              onChange={() => setShippingSelections((prev) => ({ ...prev, [g.key]: { method: opt.method } }))}
                              style={{ accentColor: '#d4af37', margin: 0 }}
                            />
                            {carrierInfo && <img src={carrierInfo.icon} alt={carrierInfo.name} style={{ height: '14px', width: 'auto', backgroundColor: '#fff', borderRadius: '2px', padding: '1px' }} />}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ color: isSelected ? '#fff' : '#d6d3d1', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                {opt.label}
                                {opt.tracked && <ShieldCheck size={12} color="#34d399" />}
                              </span>
                              <span style={{ color: '#d4af37', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                {opt.cost === 0 ? t('cart.free_shipping') : `+ ${formatPrice(opt.cost)}`}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <CheckoutSidebar
                groups={groups}
                itemsSubtotal={itemsSubtotal}
                itemCount={activeItems.length}
                resolveMethod={selectedMethod}
                groupCost={groupCost}
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
