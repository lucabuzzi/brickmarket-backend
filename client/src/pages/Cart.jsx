import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from '../context/CartContext';
import { useAuth } from '../auth/useAuth';
import { apiFetch } from '../api';
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronRight, Gavel, Lock, MapPin, Package,
  Plus, ShieldCheck, ShoppingBag, Trash2, Truck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CARRIERS } from './Sell';
import MarketCard from '../components/market/MarketCard';
import { MARKET_MODES, useMarketItems } from '../components/market/marketConfig';
import { cldImage, formatEUR, listingImage } from '../components/landing/landingUtils';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const LIME = '#c6ff3d';

const cardElementOptions = {
  style: {
    base: { color: '#ffffff', fontSize: '16px', iconColor: LIME, '::placeholder': { color: 'rgba(255,255,255,0.35)' } },
    invalid: { color: '#ff7a5c', iconColor: '#ff7a5c' },
  },
};

const inputClass =
  'h-12 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-3.5 text-[15px] text-white outline-none transition placeholder:text-white/35 focus:border-white/40';

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

function itemThumb(item) {
  return listingImage(item, 320) || cldImage(item.image_url, 320) || 'https://picsum.photos/seed/placeholder/800/600';
}

function Panel({ icon: Icon, title, aside, children, tone }) {
  return (
    <section className={`overflow-hidden rounded-[1.75rem] border bg-white/[0.03] ${tone === 'danger' ? 'border-[#ff5a36]/50' : 'border-white/10'}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
          <Icon className="h-4.5 w-4.5" style={{ color: tone === 'danger' ? '#ff5a36' : LIME }} />
        </span>
        <h2 className="min-w-[9rem] flex-1 break-words text-base font-black text-white">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
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
    <Panel icon={MapPin} title={t('cart.shipping_address_title')}>
      <div className="p-5">
        {addresses.length === 0 && !adding && (
          <p className="mb-3 text-sm text-white/55">{t('cart.no_saved_addresses')}</p>
        )}

        {addresses.length > 0 && (
          <div className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${adding ? 'mb-5' : 'mb-3'}`}>
            {addresses.map((a) => {
              const isSelected = selectedAddressId === a.id;
              return (
                <label
                  key={a.id}
                  className={`relative flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                    isSelected ? 'bg-[#c6ff3d]/[0.07]' : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                  }`}
                  style={isSelected ? { borderColor: LIME } : undefined}
                >
                  <input
                    type="radio" name="shipping-address" checked={isSelected}
                    onChange={() => onSelect(a.id)}
                    className="sr-only"
                  />
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? '' : 'border-white/25'}`}
                    style={isSelected ? { borderColor: LIME, background: LIME } : undefined}
                  >
                    {isSelected && <Check className="h-3 w-3 text-[#10140a]" strokeWidth={4} />}
                  </span>
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-bold text-white">
                      {a.label ? `${a.label} — ` : ''}{a.full_name}
                    </span>
                    <span className="mt-0.5 block break-words text-white/55">
                      {a.address_street || a.address} {a.address_house_number}, {a.zip} {a.city} ({a.country})
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {!adding ? (
          <button
            type="button" onClick={() => setAdding(true)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-white/20 px-4 text-sm font-bold transition hover:border-white/40"
            style={{ color: LIME }}
          >
            <Plus className="h-4 w-4" /> {t('cart.add_new_address').replace(/^\+\s*/, '')}
          </button>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <input placeholder={t('cart.recipient_name')} value={form.fullName} onChange={handleField('fullName')} className={inputClass} autoComplete="name" />
              <input placeholder={t('cart.address_label_placeholder')} value={form.label} onChange={handleField('label')} className={inputClass} />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2.5">
              <input placeholder={t('auth.street')} value={form.addressStreet} onChange={handleField('addressStreet')} className={inputClass} autoComplete="address-line1" />
              <input placeholder={t('auth.house_number')} value={form.addressHouseNumber} onChange={handleField('addressHouseNumber')} className={inputClass} />
            </div>
            <div className="grid grid-cols-[96px_minmax(0,1fr)_72px] gap-2.5">
              <input placeholder={t('auth.zip')} value={form.zip} onChange={handleField('zip')} className={inputClass} autoComplete="postal-code" inputMode="numeric" />
              <input placeholder={t('auth.city')} value={form.city} onChange={handleField('city')} className={inputClass} autoComplete="address-level2" />
              <input
                placeholder={t('auth.country')} maxLength={2} value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value.toUpperCase() }))}
                className={`${inputClass} text-center uppercase`}
                autoComplete="country"
              />
            </div>
            <input placeholder={t('auth.phone')} value={form.phone} onChange={handleField('phone')} className={inputClass} autoComplete="tel" inputMode="tel" />

            {error && <p className="text-sm font-semibold text-[#ff7a5c]">{error}</p>}

            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="button" onClick={handleSave} disabled={saving}
                className="flex min-h-11 items-center rounded-xl px-5 text-sm font-black text-[#10140a] transition hover:brightness-110 disabled:opacity-60"
                style={{ background: LIME }}
              >
                {saving ? t('ui.loading') : t('cart.save_address_button')}
              </button>
              {addresses.length > 0 && (
                <button
                  type="button" onClick={() => { setAdding(false); setError(''); }}
                  className="flex min-h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-bold text-white/70 transition hover:border-white/35 hover:text-white"
                >
                  {t('cart.cancel_new_address')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Panel>
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

  const blocked = hasUnavailableItems || !hasAddress;

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0f0e14]/90 p-5 backdrop-blur-xl sm:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: LIME }} />
      <div className="relative">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/45">{t('cart.order_summary')}</p>

        <dl className="mt-5 space-y-2.5 text-sm">
          <div className="flex justify-between gap-4 text-white/70">
            <dt>{t('cart.items_count_label', { count: itemCount }).replace(/:$/, '')}</dt>
            <dd className="font-mono font-bold tabular-nums text-white">{formatPrice(itemsSubtotal)}</dd>
          </div>
          {groups.map((g) => (
            <div key={g.key} className="flex justify-between gap-4 text-white/55">
              <dt className="min-w-0 truncate">
                {t('cart.shipping_group_label', { seller: g.sellerName })}
                {g.macro === 'tcg' ? ` · ${t('cart.cards_suffix')}` : ''}
              </dt>
              <dd className="shrink-0 font-mono tabular-nums">
                {groupCost(g) === 0 ? <span style={{ color: LIME }}>{t('cart.free_shipping')}</span> : formatPrice(groupCost(g))}
              </dd>
            </div>
          ))}
        </dl>

        <div className="my-5 h-px bg-white/10" />

        <div className="flex items-end justify-between gap-4">
          <span className="text-sm font-bold uppercase tracking-wider text-white/60">{t('cart.total_label').replace(/:$/, '')}</span>
          <span className="break-all text-right text-[clamp(2.2rem,5vw,2.8rem)] font-black leading-none tracking-[-0.04em]" style={{ color: LIME }}>
            {formatPrice(total)}
          </span>
        </div>

        <div className="mt-6 space-y-3">
          {hasUnavailableItems && (
            <p className="flex items-start gap-2 rounded-2xl border border-[#ff5a36]/40 bg-[#ff5a36]/10 p-3.5 text-sm font-semibold text-[#ff7a5c]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {t('cart.remove_unavailable_notice')}
            </p>
          )}

          {!hasUnavailableItems && !hasAddress && (
            <p className="flex items-start gap-2 rounded-2xl border border-white/15 bg-white/[0.04] p-3.5 text-sm font-semibold text-white/75">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: LIME }} />
              {t('cart.address_required_notice')}
            </p>
          )}

          {!hasUnavailableItems && hasAddress && (
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                {t('wallet.card_details_label')}
              </label>
              <div className="rounded-2xl border border-white/12 bg-black/40 px-4 py-4 transition focus-within:border-white/40">
                <CardElement options={cardElementOptions} />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-2xl border border-[#ff5a36]/40 bg-[#ff5a36]/10 p-3 text-center text-sm font-semibold text-[#ff7a5c]" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => handleCheckout()}
            disabled={checking || blocked || !stripe}
            className="lx-shine relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
            style={blocked ? undefined : { background: LIME, color: '#10140a', boxShadow: '0 18px 40px -14px rgba(198,255,61,0.65)' }}
          >
            <Lock className="h-4.5 w-4.5" />
            {checking ? t('cart.processing') : t('cart_page.pay_cta', { total: formatPrice(total) })}
          </button>

          <p className="flex items-start justify-center gap-2 text-center text-xs leading-relaxed text-white/40">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t('wallet.secure_payment_notice')}
          </p>
        </div>
      </div>
    </div>
  );
}

function Steps({ current }) {
  const { t } = useTranslation();
  const steps = ['address', 'shipping', 'payment'];
  return (
    <ol className="flex items-center gap-2 overflow-x-auto">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex shrink-0 items-center gap-2">
            <span
              className={`flex h-8 items-center gap-2 rounded-full border pl-1 pr-3 text-xs font-bold ${
                active ? 'border-white/40 bg-white/10 text-white' : done ? 'border-transparent text-white/80' : 'border-white/10 text-white/40'
              }`}
            >
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black"
                style={done ? { background: LIME, color: '#10140a' } : active ? { background: '#fff', color: '#07060b' } : { background: 'rgba(255,255,255,0.08)' }}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={4} /> : i + 1}
              </span>
              {t(`cart_page.step_${s}`)}
            </span>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-white/20" />}
          </li>
        );
      })}
    </ol>
  );
}

function EmptyCart() {
  const { t } = useTranslation();
  const { items } = useMarketItems(MARKET_MODES.listings);
  const picks = items.slice(0, 4);

  return (
    <>
      <div className="relative mx-auto flex max-w-2xl flex-col items-center py-10 text-center md:py-16">
        <div className="relative mb-8 h-36 w-36">
          <div className="lx-arena-ring absolute inset-0 rounded-full" style={{ background: `conic-gradient(from var(--lx-ring-angle, 0deg), ${LIME}, #22d3ee, #ff5a36, ${LIME})`, opacity: 0.45 }} />
          <div className="lx-float relative flex h-full w-full items-center justify-center rounded-full border border-white/10 bg-[#0f0e14]">
            <ShoppingBag className="h-14 w-14 text-white/80" strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="text-[clamp(2.2rem,6vw,3.8rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('cart_page.empty_title')}</h2>
        <p className="mt-4 max-w-md text-base text-white/60 md:text-lg">{t('cart_page.empty_desc')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/annunci" className="lx-shine relative inline-flex min-h-12 items-center gap-2 overflow-hidden rounded-full px-6 font-black text-[#10140a] transition hover:brightness-110" style={{ background: LIME }}>
            {t('cart_page.empty_cta_listings')}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/aste" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-6 font-bold text-white transition hover:border-white/40">
            <Gavel className="h-4 w-4 text-[#ff5a36]" />
            {t('cart_page.empty_cta_auctions')}
          </Link>
        </div>
      </div>

      {picks.length > 0 && (
        <section className="pb-8">
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: LIME }}>{t('cart_page.picks_kicker')}</p>
          <h2 className="mb-8 mt-2 text-[clamp(1.9rem,4.5vw,3rem)] font-black leading-[0.95] tracking-[-0.045em] text-white">{t('cart_page.picks_title')}</h2>
          <div className="grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
            {picks.map((item, i) => <MarketCard key={item.id} item={item} mode={MARKET_MODES.listings} index={i} />)}
          </div>
        </section>
      )}
    </>
  );
}

export default function Cart() {
  const { t, i18n } = useTranslation();
  const { cart, removeFromCart, clearCart } = useCart();
  const { user } = useAuth();
  const [soldItems, setSoldItems] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const summaryRef = useRef(null);

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

  const shippingReady = groups.length > 0 && groups.every((g) => g.options.length > 0);
  const currentStep = !selectedAddressId ? 0 : !shippingReady ? 1 : 2;
  const shippingTotal = groups.reduce((acc, g) => acc + groupCost(g), 0);
  const unavailable = cart.filter((i) => soldItems.includes(i.id));
  // Items still waiting for their status check render in a neutral group so they never "vanish".
  const pending = cart.filter((i) => !soldItems.includes(i.id) && !fullItems[i.id]);

  const goToSummary = () => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const renderItem = (item, { unavailableItem = false } = {}) => (
    <motion.li
      key={item.id}
      initial={{ y: 12 }}
      animate={{ y: 0 }}
      className={`flex gap-4 p-4 sm:p-5 ${unavailableItem ? 'opacity-70' : ''}`}
    >
      <Link to={`/product/${item.id}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#1b1822] sm:h-28 sm:w-28">
        <img src={itemThumb(item)} alt={item.title} className={`h-full w-full object-cover transition duration-500 hover:scale-105 ${unavailableItem ? 'grayscale' : ''}`} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/product/${item.id}`} className="line-clamp-2 text-base font-bold leading-snug text-white transition hover:text-[#c6ff3d] sm:text-lg">
            {item.title}
          </Link>
          <button
            type="button"
            onClick={() => removeFromCart(item.id)}
            aria-label={t('cart_page.remove', { title: item.title })}
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/40 transition hover:bg-[#ff5a36]/15 hover:text-[#ff5a36]"
          >
            <Trash2 className="h-4.5 w-4.5" />
          </button>
        </div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
          {unavailableItem ? (
            <span className="flex items-center gap-1.5 rounded-full bg-[#ff5a36]/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#ff7a5c]">
              <AlertTriangle className="h-3.5 w-3.5" /> {t('cart.item_unavailable')}
            </span>
          ) : <span />}
          <span className="font-mono text-xl font-black tabular-nums text-white">{formatEUR(item.price, i18n.language)}</span>
        </div>
      </div>
    </motion.li>
  );

  return (
    <div className="lx-page pb-28 lg:pb-16">
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 px-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f0e14] p-10 text-center"
            >
              <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-56 w-56 rounded-full opacity-40 blur-3xl" style={{ background: LIME }} />
              <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
                <span className="lx-ping absolute inset-0 rounded-full" style={{ background: `${LIME}33` }} />
                <span className="relative flex h-20 w-20 items-center justify-center rounded-full" style={{ background: LIME }}>
                  <CheckCircle2 className="h-11 w-11 text-[#10140a]" strokeWidth={2.5} />
                </span>
              </div>
              <h2 className="relative text-3xl font-black tracking-[-0.03em] text-white">{t('cart.purchase_complete_title')}</h2>
              <p className="relative mt-3 text-white/60">{t('cart.purchase_complete_subtitle')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute -left-40 top-10 h-[480px] w-[480px] rounded-full opacity-[0.12] blur-[130px]" style={{ background: LIME }} />

      <div className="relative mx-auto max-w-[1320px] px-4 pt-24 md:px-10 md:pt-28">
        <motion.header initial={{ y: 20 }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="mb-10">
          <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: LIME }}>{t('cart_page.kicker')}</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div>
              <h1 className="text-[clamp(2.8rem,8vw,6rem)] font-black leading-[0.88] tracking-[-0.055em] text-white">
                {cart.length === 0 ? t('cart.title') : t('cart_page.title')}
              </h1>
              {cart.length > 0 && (
                <p className="mt-4 text-lg font-semibold text-white/60">{t('cart_page.subtitle', { count: cart.length })}</p>
              )}
            </div>
            {cart.length > 0 && user && <Steps current={currentStep} />}
          </div>
        </motion.header>

        {cart.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
            <div className="flex min-w-0 flex-col gap-5">
              {user ? (
                <AddressSection
                  addresses={addresses}
                  selectedAddressId={selectedAddressId}
                  onSelect={setSelectedAddressId}
                  onAddressCreated={handleAddressCreated}
                />
              ) : null}

              {/* Sold items that dropped out of any group still need to show so the
                  buyer can remove them. */}
              {unavailable.length > 0 && (
                <Panel icon={AlertTriangle} title={t('cart_page.unavailable_title')} tone="danger">
                  <ul className="divide-y divide-white/10">
                    {unavailable.map((item) => renderItem(item, { unavailableItem: true }))}
                  </ul>
                </Panel>
              )}

              {pending.length > 0 && (
                <Panel icon={Package} title={t('cart_page.pending_title')}>
                  <ul className="divide-y divide-white/10">
                    {pending.map((item) => renderItem(item))}
                  </ul>
                </Panel>
              )}

              {groups.map((g) => {
                const selMethod = selectedMethod(g);
                return (
                  <Panel
                    key={g.key}
                    icon={Package}
                    title={t('cart.shipping_from', { seller: g.sellerName })}
                    aside={(
                      <span className="flex items-center gap-2">
                        {g.macro === 'tcg' && (
                          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white/60">{t('cart.cards_suffix')}</span>
                        )}
                        <Link to={`/user/${g.sellerName}`} className="flex min-h-11 items-center gap-1 text-xs font-bold text-white/50 transition hover:text-white">
                          {t('cart_page.seller_profile')}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </span>
                    )}
                  >
                    <ul className="divide-y divide-white/10">
                      {g.items.map((item) => renderItem(item))}
                    </ul>

                    {/* One shipping selector for the whole group */}
                    <div className="border-t border-white/10 bg-black/25 p-4 sm:p-5">
                      <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-white">
                        <Truck className="h-4 w-4" style={{ color: LIME }} />
                        {t('cart.choose_shipping').replace(/:$/, '')}
                        <span className="font-medium text-white/45">· {t('cart.one_shipment_note')}</span>
                      </p>

                      {!selectedAddressId && g.macro === 'physical' ? (
                        <p className="text-sm text-white/50">{t('cart_page.shipping_needs_address')}</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {g.macro === 'physical' && g.quoteLoading && (
                            <>
                              <span className="sr-only">{t('cart.quote_loading')}</span>
                              <div className="h-[60px] animate-pulse rounded-2xl bg-white/[0.05]" />
                              <div className="hidden h-[60px] animate-pulse rounded-2xl bg-white/[0.05] sm:block" />
                            </>
                          )}
                          {g.macro === 'physical' && g.quoteError && !g.quoteLoading && (
                            <p className="flex items-center gap-2 text-sm font-semibold text-[#ff7a5c] sm:col-span-2">
                              {t('cart.quote_error')}
                              <button type="button" onClick={() => fetchPhysicalQuote(g)} className="min-h-9 rounded-full border border-white/15 px-3 text-xs font-bold text-white hover:border-white/40">
                                {t('cart_page.retry')}
                              </button>
                            </p>
                          )}
                          {!g.quoteLoading && !g.quoteError && g.options.length === 0 && (
                            <p className="text-sm text-white/50 sm:col-span-2">{t('cart.shipping_unavailable')}</p>
                          )}
                          {!g.quoteLoading && g.options.map((opt) => {
                            const carrierInfo = CARRIERS.find((c) => c.id === opt.method);
                            const isSelected = selMethod === opt.method;
                            return (
                              <label
                                key={String(opt.method)}
                                className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                                  isSelected ? 'bg-[#c6ff3d]/[0.07]' : 'border-white/10 bg-white/[0.02] hover:border-white/25'
                                }`}
                                style={isSelected ? { borderColor: LIME } : undefined}
                              >
                                <input
                                  type="radio"
                                  name={`shipping-${g.key}`}
                                  checked={isSelected}
                                  onChange={() => setShippingSelections((prev) => ({ ...prev, [g.key]: { method: opt.method } }))}
                                  className="sr-only"
                                />
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isSelected ? '' : 'border-white/25'}`}
                                  style={isSelected ? { borderColor: LIME, background: LIME } : undefined}
                                >
                                  {isSelected && <Check className="h-3 w-3 text-[#10140a]" strokeWidth={4} />}
                                </span>
                                {carrierInfo && <img src={carrierInfo.icon} alt={carrierInfo.name} className="h-4 w-auto rounded-sm bg-white p-px" />}
                                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-bold text-white">
                                  <span className="truncate">{opt.label}</span>
                                  {opt.tracked && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#34d399]" />}
                                </span>
                                <span className="shrink-0 font-mono text-sm font-black tabular-nums" style={{ color: opt.cost === 0 ? LIME : '#fff' }}>
                                  {opt.cost === 0 ? t('cart.free_shipping') : `+ ${formatPrice(opt.cost)}`}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Panel>
                );
              })}
            </div>

            <div ref={summaryRef} className="min-w-0 scroll-mt-24 lg:sticky lg:top-24">
              {!user ? (
                <div className="rounded-[1.75rem] border border-white/10 bg-[#0f0e14]/90 p-6 text-center">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06]">
                    <Lock className="h-6 w-6" style={{ color: LIME }} />
                  </span>
                  <p className="mt-4 text-xl font-black text-white">{t('cart_page.login_title')}</p>
                  <p className="mt-2 text-sm text-white/55">{t('cart_page.login_desc')}</p>
                  <p className="mt-5 font-mono text-3xl font-black tabular-nums" style={{ color: LIME }}>{formatPrice(itemsSubtotal)}</p>
                  <Link
                    to="/login"
                    state={{ from: location }}
                    className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-black text-[#10140a] transition hover:brightness-110"
                    style={{ background: LIME }}
                  >
                    {t('nav.login')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link to="/register" className="mt-2 flex min-h-11 items-center justify-center text-sm font-bold text-white/60 hover:text-white">
                    {t('nav.register')}
                  </Link>
                </div>
              ) : stripePromise ? (
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
                <div className="rounded-[1.75rem] border border-[#ff5a36]/40 bg-[#ff5a36]/10 p-6 text-center font-semibold text-[#ff7a5c]">
                  {t('wallet.stripe_not_configured')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* mobile total bar */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#07060b]/90 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold uppercase tracking-wider text-white/45">{t('cart.total_label').replace(/:$/, '')}</p>
              <p className="truncate font-mono text-xl font-black tabular-nums" style={{ color: LIME }}>{formatPrice(itemsSubtotal + shippingTotal)}</p>
            </div>
            <button
              type="button"
              onClick={goToSummary}
              className="flex h-12 shrink-0 items-center gap-2 rounded-2xl px-5 text-sm font-black text-[#10140a]"
              style={{ background: LIME }}
            >
              <Lock className="h-4 w-4" />
              {t('cart_page.go_to_payment')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
