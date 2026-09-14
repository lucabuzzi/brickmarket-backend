import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import { StitchCard } from '../components/StitchComponents';
import { Package, Truck, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, Clock } from 'lucide-react';

function formatPrice(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

// A shipment only gets an automatic label when it was quoted live by the
// aggregator — mirrors isLabelEligible in src/routes/shipments.js.
function isLabelEligible(shipment) {
  return shipment.macro_category === 'physical' && shipment.rate_source === 'aggregator';
}

const STATUS_STYLES = {
  pending_payment: 'bg-stone-500/10 text-stone-400',
  awaiting_preparation: 'bg-amber-500/10 text-amber-400',
  label_pending: 'bg-blue-500/10 text-blue-400',
  label_failed: 'bg-rose-500/10 text-rose-400',
  shipped: 'bg-emerald-500/10 text-emerald-400',
  in_transit: 'bg-blue-500/10 text-blue-400',
  delivered: 'bg-emerald-500/10 text-emerald-400',
  exception: 'bg-rose-500/10 text-rose-400',
  cancelled: 'bg-stone-500/10 text-stone-400',
};

function StatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_STYLES[status] || STATUS_STYLES.pending_payment}`}>
      {t(`seller_shipments.status_${status}`, status)}
    </span>
  );
}

function ShipmentCard({ shipment, onPrepare, onRetry, onMarkShipped, busy, actionError }) {
  const { t } = useTranslation();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const eligible = isLabelEligible(shipment);
  const buyerName = shipment.orders?.[0]?.buyerUsername || t('details.unknown_seller');
  const itemsTotal = (shipment.orders || []).reduce((s, o) => s + (parseFloat(o.itemPrice) || 0), 0);

  const canMarkShippedManually = !eligible && shipment.status === 'awaiting_preparation';
  const canPrepare = eligible && shipment.status === 'awaiting_preparation';
  const canRetry = eligible && shipment.status === 'label_failed';

  return (
    <StitchCard glowColor={shipment.status === 'label_failed' ? 'rose' : 'amber'} className="p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-stone-500 uppercase tracking-wider font-bold mb-1">
            {t('seller_shipments.buyer_label')}
          </p>
          <p className="text-white font-bold truncate">{buyerName}</p>
        </div>
        <StatusBadge status={shipment.status} />
      </div>

      <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
        {(shipment.orders || []).map((o) => (
          <div key={o.id} className="flex items-center gap-3">
            {o.listingImage ? (
              <img src={o.listingImage} alt={o.listingTitle} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-stone-800 flex items-center justify-center flex-shrink-0">
                <Package size={16} className="text-stone-600" />
              </div>
            )}
            <span className="text-sm text-stone-300 truncate flex-1">{o.listingTitle}</span>
            <span className="text-sm text-gold-400 font-bold flex-shrink-0">{formatPrice(o.itemPrice)}</span>
          </div>
        ))}
        <div className="flex justify-between text-xs text-stone-500 pt-1">
          <span>{t('seller_shipments.shipping_cost_label')}</span>
          <span>{formatPrice(shipment.shipping_cost)}</span>
        </div>
        <div className="flex justify-between text-xs text-stone-400 font-bold">
          <span>{t('seller_shipments.items_total_label')}</span>
          <span>{formatPrice(itemsTotal)}</span>
        </div>
      </div>

      {/* Tracking / label, once it exists */}
      {shipment.tracking_number && (
        <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs">
          <Truck size={14} className="text-emerald-400 flex-shrink-0" />
          <span className="text-stone-300 truncate">
            {shipment.carrier ? `${shipment.carrier} · ` : ''}{shipment.tracking_number}
          </span>
          {shipment.tracking_url && (
            <a href={shipment.tracking_url} target="_blank" rel="noreferrer" className="ml-auto text-gold-400 flex items-center gap-1 flex-shrink-0">
              {t('seller_shipments.track_link')} <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}
      {shipment.label_url && (
        <a href={shipment.label_url} target="_blank" rel="noreferrer" className="text-xs text-gold-400 flex items-center gap-1">
          {t('seller_shipments.label_link')} <ExternalLink size={12} />
        </a>
      )}

      {actionError && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-xs text-rose-300">
          <AlertTriangle size={14} className="flex-shrink-0" /> {actionError}
        </div>
      )}

      {/* Actions */}
      {canPrepare && (
        <button
          onClick={() => onPrepare(shipment.id)}
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-white font-black uppercase text-xs tracking-wider transition-all"
        >
          {busy ? t('seller_shipments.processing') : t('seller_shipments.prepare_button')}
        </button>
      )}

      {canRetry && (
        <button
          onClick={() => onRetry(shipment.id)}
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-rose-500/90 hover:bg-rose-500 disabled:opacity-50 text-white font-black uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} /> {busy ? t('seller_shipments.processing') : t('seller_shipments.retry_label_button')}
        </button>
      )}

      {canMarkShippedManually && (
        <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <Clock size={12} /> {t('seller_shipments.manual_notice')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text" placeholder={t('seller_shipments.tracking_number_placeholder')}
              value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-stone-600"
            />
            <input
              type="text" placeholder={t('seller_shipments.carrier_placeholder')}
              value={carrier} onChange={(e) => setCarrier(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-stone-600"
            />
          </div>
          <button
            onClick={() => onMarkShipped(shipment.id, trackingNumber, carrier)}
            disabled={busy || !trackingNumber.trim() || !carrier.trim()}
            className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 disabled:opacity-50 text-white font-black uppercase text-xs tracking-wider transition-all"
          >
            {busy ? t('seller_shipments.processing') : t('seller_shipments.mark_shipped_button')}
          </button>
        </div>
      )}
    </StitchCard>
  );
}

export default function SellerShipments() {
  const { t } = useTranslation();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [actionErrors, setActionErrors] = useState({});

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/shipments/mine');
      setShipments(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(err.message || t('seller_shipments.load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
    // fetchShipments has no dependency that changes across renders — this
    // should only run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyResult = (id, updatedShipment) => {
    setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, ...updatedShipment, orders: s.orders } : s)));
  };

  const runAction = async (id, fn) => {
    setBusyId(id);
    setActionErrors((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fn();
      if (res?.shipment) applyResult(id, res.shipment);
      if (res && res.labelGenerated === false && res.error) {
        setActionErrors((prev) => ({ ...prev, [id]: res.error }));
      }
    } catch (err) {
      setActionErrors((prev) => ({ ...prev, [id]: err.message || t('seller_shipments.action_error') }));
    } finally {
      setBusyId(null);
    }
  };

  const handlePrepare = (id) => runAction(id, () => apiFetch(`/api/shipments/${id}/prepare`, { method: 'POST' }));
  const handleRetry = (id) => runAction(id, () => apiFetch(`/api/shipments/${id}/retry-label`, { method: 'POST' }));
  const handleMarkShipped = (id, trackingNumber, carrier) =>
    runAction(id, () => apiFetch(`/api/shipments/${id}/mark-shipped`, { method: 'POST', body: { trackingNumber, carrier } }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">{t('seller_shipments.title')}</h1>
      <p className="text-stone-500 text-sm mb-6">{t('seller_shipments.subtitle')}</p>

      {loading && <p className="text-stone-400 text-sm">{t('ui.loading')}</p>}

      {error && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3 text-sm text-rose-300 mb-6">
          <AlertTriangle size={16} className="flex-shrink-0" /> {error}
        </div>
      )}

      {!loading && !error && shipments.length === 0 && (
        <StitchCard glowColor="blue" className="p-8 text-center">
          <Package size={32} className="text-stone-600 mx-auto mb-3" />
          <p className="text-stone-400 text-sm">{t('seller_shipments.empty')}</p>
        </StitchCard>
      )}

      <div className="grid grid-cols-1 gap-4">
        {shipments.map((s) => (
          <ShipmentCard
            key={s.id}
            shipment={s}
            busy={busyId === s.id}
            actionError={actionErrors[s.id]}
            onPrepare={handlePrepare}
            onRetry={handleRetry}
            onMarkShipped={handleMarkShipped}
          />
        ))}
      </div>
    </div>
  );
}
