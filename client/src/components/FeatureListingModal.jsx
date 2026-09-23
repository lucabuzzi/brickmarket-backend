import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '../api';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

function formatEuroCents(cents, locale) {
  return new Intl.NumberFormat(locale || 'it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

const cardElementOptions = {
  style: {
    base: { color: '#f5f5f4', fontSize: '15px', '::placeholder': { color: '#78716c' } },
    invalid: { color: '#fb7185' },
  },
};

function FeatureModalInner({ listing, onClose, onFeatured }) {
  const { t, i18n } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();

  const [tariffs, setTariffs] = useState(null);
  const [tariffId, setTariffId] = useState('7');
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    apiFetch('/api/listings/featured/tariffs')
      .then((data) => {
        const list = data?.tariffs || [];
        setTariffs(list);
        if (list.length && !list.some((tf) => tf.id === tariffId)) setTariffId(list[0].id);
      })
      .catch(() => setTariffs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderedTariffs = useMemo(
    () => [...(tariffs || [])].sort((a, b) => a.days - b.days),
    [tariffs]
  );
  const selected = orderedTariffs.find((tf) => tf.id === tariffId);
  const fmt = (cents) => formatEuroCents(cents, i18n.language);
  // Per-day price is display-only: rounded to the cent, never used for charging.
  const perDay = (tf) => fmt(Math.round(tf.priceCents / tf.days));

  const handleConfirm = async () => {
    if (!selected || status === 'processing') return;
    setStatus('processing');
    setErrorMessage('');

    try {
      if (!stripe || !elements) {
        setStatus('error');
        setErrorMessage(t('feature.stripe_unavailable'));
        return;
      }
      const { clientSecret } = await apiFetch(`/api/listings/${listing.id}/feature`, {
        method: 'POST',
        body: { tariff: tariffId, method: 'card' },
      });
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) },
      });
      if (result.error) {
        setStatus('error');
        setErrorMessage(result.error.message || t('feature.payment_failed'));
        return;
      }
      const confirm = await apiFetch(`/api/listings/${listing.id}/confirm-feature`, {
        method: 'POST',
        body: { paymentIntentId: result.paymentIntent.id },
      });
      setStatus('success');
      onFeatured?.(confirm.listing);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err?.data?.error || err.message || t('feature.generic_error'));
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '1rem',
        backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '460px', backgroundColor: '#120f0a',
          border: '1px solid #292524', borderRadius: '18px', padding: '1.75rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Sparkles size={20} color="#d4af37" />
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
              {t('feature.title')}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#a8a29e', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <CheckCircle size={48} color="#34d399" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: '#f8fafc', fontWeight: 700, marginBottom: '0.25rem' }}>{t('feature.success_title')}</p>
            <p style={{ color: '#a8a29e', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{t('feature.success_desc')}</p>
            <button
              onClick={onClose}
              style={{
                padding: '0.7rem 1.5rem', borderRadius: '10px', border: 'none',
                backgroundColor: '#d4af37', color: '#000', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {t('feature.close')}
            </button>
          </div>
        ) : (
          <>
            <p style={{ color: '#a8a29e', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              <strong style={{ color: '#d6d3d1' }}>{listing.title}</strong>
              <br />
              {t('feature.intro')}
            </p>

            {/* Tariff cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
              {orderedTariffs.map((tf) => {
                const active = tf.id === tariffId;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => setTariffId(tf.id)}
                    style={{
                      padding: '0.9rem 0.4rem', borderRadius: '12px', cursor: 'pointer',
                      border: `2px solid ${active ? '#d4af37' : '#44403c'}`,
                      backgroundColor: active ? 'rgba(212,175,55,0.08)' : '#1c1917',
                      color: active ? '#fff' : '#a8a29e', textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: active ? '#eed690' : '#d6d3d1' }}>
                      {tf.days}
                    </div>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                      {t('feature.days')}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: active ? '#fff' : '#78716c' }}>
                      {fmt(tf.priceCents)}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: active ? '#a8a29e' : '#57534e', marginTop: '0.15rem' }}>
                      {t('feature.per_day_short', { price: perDay(tf) })}
                    </div>
                  </button>
                );
              })}
            </div>

            {selected && (
              <p style={{ fontSize: '0.85rem', color: '#d6d3d1', marginBottom: '1rem', textAlign: 'center' }}>
                {t('feature.price_summary', { total: fmt(selected.priceCents), days: selected.days, perDay: perDay(selected) })}
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#a8a29e', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              <CreditCard size={14} /> {t('feature.card_label')}
            </div>
            <div style={{ padding: '0.8rem', border: '1px solid #44403c', borderRadius: '10px', backgroundColor: '#1c1917', marginBottom: '1rem' }}>
              <CardElement options={cardElementOptions} />
            </div>

            {status === 'error' && (
              <div style={{ padding: '0.7rem 0.9rem', backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '8px', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '1rem' }}>
                {errorMessage}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={status === 'processing' || !selected || !stripe}
              style={{
                width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
                backgroundColor: status === 'processing' ? '#57534e' : '#d4af37',
                color: '#000', fontWeight: 800, fontSize: '0.95rem',
                cursor: status === 'processing' ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {status === 'processing' ? (
                <><Loader2 size={16} className="animate-spin" /> {t('feature.processing')}</>
              ) : (
                t('feature.confirm', { price: selected ? fmt(selected.priceCents) : '' })
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function FeatureListingModal(props) {
  return createPortal(
    <Elements stripe={stripePromise}>
      <FeatureModalInner {...props} />
    </Elements>,
    document.body
  );
}
