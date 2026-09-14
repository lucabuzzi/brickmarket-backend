import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from '../context/CartContext';
import { apiFetch } from '../api';
import { Trash2, AlertTriangle, CheckCircle2, Truck, Package, ShieldCheck, MapPin, Plus } from 'lucide-react';
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

const addressInputStyle = {
  backgroundColor: '#120f0a', border: '1px solid #44403c', borderRadius: '6px',
  padding: '0.5rem 0.6rem', color: '#f5f5f4', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box',
};

const emptyAddressForm = {
  label: '', fullName: '', addressStreet: '', addressHouseNumber: '',
  city: '', zip: '', province: '', country: '', phone: '',
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

// Mandatory shipping-address picker: pick a saved one or add a new one to the
// buyer's address book (reused across future orders — see src/routes/addresses.js).
// The order snapshots whichever is selected at checkout time (never a live
// reference), so editing this book later never changes a past order.
function AddressSection({ addresses, selectedAddressId, onSelect, onAddressCreated }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(addresses.length === 0);
  const [form, setForm] = useState(emptyAddressForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const created = await apiFetch('/api/addresses', {
        method: 'POST',
        body: { ...form, country: form.country.trim().toUpperCase() },
      });
      onAddressCreated(created);
      setForm(emptyAddressForm);
      setAdding(false);
    } catch (err) {
      setError(err.message || t('cart.address_save_error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ border: '1px solid #44403c', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#1c1917' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#292524', borderBottom: '1px solid #44403c', color: '#e7e5e4', fontSize: '0.9rem', fontWeight: 'bold' }}>
        <MapPin size={15} color="#d4af37" />
        {t('cart.shipping_address_title')}
      </div>
      <div style={{ padding: '1rem' }}>
        {addresses.length === 0 && !adding && (
          <p style={{ color: '#a8a29e', fontSize: '0.85rem', margin: '0 0 0.75rem 0' }}>{t('cart.no_saved_addresses')}</p>
        )}

        {addresses.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: adding ? '1rem' : 0 }}>
            {addresses.map((a) => {
              const isSelected = selectedAddressId === a.id;
              return (
                <label key={a.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: '8px',
                  border: isSelected ? '1px solid #d4af37' : '1px solid #44403c',
                  backgroundColor: isSelected ? 'rgba(212,175,55,0.1)' : '#292524', cursor: 'pointer',
                }}>
                  <input
                    type="radio" name="shipping-address" checked={isSelected}
                    onChange={() => onSelect(a.id)}
                    style={{ accentColor: '#d4af37', marginTop: '0.2rem' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>
                      {a.label ? `${a.label} — ` : ''}{a.full_name}
                    </span>
                    <span style={{ color: '#a8a29e' }}>
                      {a.address_street || a.address} {a.address_house_number}, {a.zip} {a.city} ({a.country})
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {!adding ? (
          <button
            type="button" onClick={() => setAdding(true)}
            style={{ background: 'none', border: '1px dashed #57534e', color: '#d4af37', borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={14} /> {t('cart.add_new_address')}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <input placeholder={t('cart.recipient_name')} value={form.fullName} onChange={handleField('fullName')} style={addressInputStyle} />
              <input placeholder={t('cart.address_label_placeholder')} value={form.label} onChange={handleField('label')} style={addressInputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.6rem' }}>
              <input placeholder={t('auth.street')} value={form.addressStreet} onChange={handleField('addressStreet')} style={addressInputStyle} />
              <input placeholder={t('auth.house_number')} value={form.addressHouseNumber} onChange={handleField('addressHouseNumber')} style={addressInputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 60px', gap: '0.6rem' }}>
              <input placeholder={t('auth.zip')} value={form.zip} onChange={handleField('zip')} style={addressInputStyle} />
              <input placeholder={t('auth.city')} value={form.city} onChange={handleField('city')} style={addressInputStyle} />
              <input
                placeholder={t('auth.country')} maxLength={2} value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
                style={addressInputStyle}
              />
            </div>
            <input placeholder={t('auth.phone')} value={form.phone} onChange={handleField('phone')} style={addressInputStyle} />

            {error && <span style={{ color: '#fb7185', fontSize: '0.8rem' }}>{error}</span>}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button" onClick={handleSave} disabled={saving}
                style={{ backgroundColor: '#d4af37', color: '#1c1917', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {saving ? t('ui.loading') : t('cart.save_address_button')}
              </button>
              {addresses.length > 0 && (
                <button
                  type="button" onClick={() => { setAdding(false); setError(''); }}
                  style={{ background: 'none', border: '1px solid #57534e', color: '#a8a29e', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {t('cart.cancel_new_address')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutSidebar({
  groups, itemsSubtotal, resolveMethod, groupCost, hasUnavailableItems, hasAddress, selectedAddressId,
  formatPrice, itemCount, onSuccess, refreshPhysicalQuotes,
}) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const shippingTotal = groups.reduce((acc, g) => acc + groupCost(g), 0);
  const total = itemsSubtotal + shippingTotal;

  // Physical groups send the exact quote token the buyer was shown
  // (POST /api/shipping/quote); TCG keeps sending a tier id, unrelated to
  // quoting entirely. If the server rejects a token as expired/stale (the
  // buyer sat on the page a while, or the cart changed since it was quoted),
  // re-quote every physical group and retry ONCE automatically — a second
  // failure surfaces as a real error instead of looping.
  const handleCheckout = async (isRetry = false) => {
    if (itemCount === 0 || hasUnavailableItems || !hasAddress || !stripe || !elements) return;
    setChecking(true);
    if (!isRetry) setError('');
    try {
      const itemIds = groups.flatMap((g) => g.items.map((i) => i.id));
      const selectionsByKey = {};
      groups.forEach((g) => {
        const val = resolveMethod(g);
        selectionsByKey[g.key] = g.macro === 'tcg' ? { method: val } : { quoteToken: val };
      });

      const { clientSecret } = await apiFetch('/api/payments/stripe/create-cart-payment-intent', {
        method: 'POST',
        body: {
          itemIds,
          shippingSelections: selectionsByKey,
          shippingAddress: { addressId: selectedAddressId },
        },
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
      if (err.data?.code === 'SHIPPING_QUOTE_EXPIRED' && !isRetry) {
        setError(t('cart.quote_refreshing'));
        await refreshPhysicalQuotes();
        setChecking(false);
        await handleCheckout(true);
        return;
      }
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

      {!hasUnavailableItems && !hasAddress && (
        <div style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)', border: '1px solid #d4af37', padding: '0.85rem 1rem', borderRadius: '8px', color: '#d4af37', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {t('cart.address_required_notice')}
        </div>
      )}

      {!hasUnavailableItems && hasAddress && (
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
        disabled={checking || hasUnavailableItems || !hasAddress || !stripe}
        style={{ width: '100%', backgroundColor: (hasUnavailableItems || !hasAddress) ? '#57534e' : '#22c55e', color: '#fff', border: 'none', padding: '1rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: (hasUnavailableItems || !hasAddress) ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}
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
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  // Physical (non-TCG) groups only: groupKey -> { options, loading, error }.
  // Each option is a live rate quote from POST /api/shipping/quote, not a
  // static table — see services/shippingQuote.js. TCG groups never populate
  // this; they keep the local tcgTiers eligibility below.
  const [physicalQuotes, setPhysicalQuotes] = useState({});

  useEffect(() => {
    apiFetch('/api/shipping/tcg-tiers')
      .then((d) => setTcgTiers(Array.isArray(d?.tiers) ? d.tiers : []))
      .catch(() => setTcgTiers([]));
  }, []);

  useEffect(() => {
    apiFetch('/api/addresses')
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setAddresses(arr);
        const preselect = arr.find((a) => a.is_default) || arr[0];
        if (preselect) setSelectedAddressId(preselect.id);
      })
      .catch(() => setAddresses([]));
  }, []);

  const handleAddressCreated = (created) => {
    setAddresses((prev) => [created, ...prev]);
    setSelectedAddressId(created.id);
  };

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
  const baseGroups = useMemo(() => {
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
    return [...map.values()];
  }, [cart, fullItems, soldItems, t]);

  // TCG groups price themselves locally (the card-tier system, unrelated to
  // quoting). Physical groups' options come from live aggregator quotes —
  // see physicalQuotes state + fetchPhysicalQuote below.
  const groups = useMemo(() => {
    return baseGroups.map((g) => {
      if (g.macro === 'tcg') {
        const value = g.fulls.reduce((s, f) => s + (parseFloat(f.price) || 0), 0);
        const options = eligibleTcgTiers(tcgTiers, g.fulls.length, value).map((tier) => ({
          method: tier.id, label: tier.label, cost: tier.price, tracked: tier.tracked,
        }));
        return { ...g, options };
      }
      const q = physicalQuotes[g.key];
      const options = (q?.options || [])
        .map((o) => ({ method: o.token, label: o.carrierName, cost: o.price, tracked: false }))
        .sort((a, b) => a.cost - b.cost);
      return { ...g, options, quoteLoading: !!q?.loading, quoteError: q?.error || null };
    });
  }, [baseGroups, tcgTiers, physicalQuotes]);

  // Requests (or re-requests) a live quote for one physical group. Exposed
  // as refreshPhysicalQuotes so the checkout retry path (an expired/stale
  // token) can re-quote every physical group and try again.
  const fetchPhysicalQuote = useCallback(async (g) => {
    if (!selectedAddressId) return;
    setPhysicalQuotes((prev) => ({ ...prev, [g.key]: { ...prev[g.key], loading: true, error: null } }));
    try {
      const itemIds = g.items.map((i) => i.id);
      const data = await apiFetch('/api/shipping/quote', {
        method: 'POST',
        body: { itemIds, shippingAddress: { addressId: selectedAddressId } },
      });
      setPhysicalQuotes((prev) => ({
        ...prev,
        [g.key]: { options: Array.isArray(data.options) ? data.options : [], expiresAt: data.expiresAt, loading: false, error: null },
      }));
    } catch (err) {
      setPhysicalQuotes((prev) => ({
        ...prev,
        [g.key]: { options: [], loading: false, error: err.message || t('cart.quote_error') },
      }));
    }
  }, [selectedAddressId, t]);

  useEffect(() => {
    baseGroups.filter((g) => g.macro === 'physical').forEach((g) => { fetchPhysicalQuote(g); });
    // fetchPhysicalQuote itself only changes when selectedAddressId does, so
    // this only re-fires when the groups or the address actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseGroups, selectedAddressId]);

  const refreshPhysicalQuotes = async () => {
    const physicalGroups = baseGroups.filter((g) => g.macro === 'physical');
    await Promise.all(physicalGroups.map((g) => fetchPhysicalQuote(g)));
  };

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
            <AddressSection
              addresses={addresses}
              selectedAddressId={selectedAddressId}
              onSelect={setSelectedAddressId}
              onAddressCreated={handleAddressCreated}
            />

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
                      {g.macro === 'physical' && g.quoteLoading && (
                        <span style={{ color: '#78716c', fontSize: '0.85rem' }}>{t('cart.quote_loading')}</span>
                      )}
                      {g.macro === 'physical' && g.quoteError && !g.quoteLoading && (
                        <span style={{ color: '#fb7185', fontSize: '0.85rem' }}>{t('cart.quote_error')}</span>
                      )}
                      {!g.quoteLoading && !g.quoteError && g.options.length === 0 && (
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
                hasAddress={!!selectedAddressId}
                selectedAddressId={selectedAddressId}
                formatPrice={formatPrice}
                onSuccess={handlePurchaseSuccess}
                refreshPhysicalQuotes={refreshPhysicalQuotes}
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
