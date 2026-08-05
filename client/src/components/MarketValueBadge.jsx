/**
 * MarketValueBadge.jsx
 *
 * Displays a "Market Value Range" card below the set lookup result.
 * Updates in real time based on the condition selected by the user.
 *
 * Props:
 *   pricing     — pricing object from the API (marketValue, low, high, etc.)
 *   condition   — one of: 'new' | 'used' | 'complete' | 'parts' | '' (unknown)
 */

import { TrendingUp, TrendingDown, Minus, Info, AlertTriangle } from 'lucide-react';

const CONDITION_LABELS = {
  new: { label: 'Sigillato / Mint', multiplier: 1.00 },
  used: { label: 'Usato', multiplier: 0.65 },
  complete: { label: 'Usato Completo', multiplier: 0.55 },
  parts: { label: 'Pezzi / Sfuso', multiplier: 0.30 },
};

function fmt(val) {
  if (val == null) return '—';
  return `€${val.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function MarketValueBadge({ pricing, condition }) {
  if (!pricing || pricing.marketValue == null) return null;

  const conditionKey = condition && CONDITION_LABELS[condition] ? condition : 'used';
  const { multiplier } = CONDITION_LABELS[conditionKey] || { multiplier: 0.65 };

  const adjustedMid = Math.round(pricing.marketValue * multiplier);
  const adjustedLow = Math.round(pricing.low * multiplier);
  const adjustedHigh = Math.round(pricing.high * multiplier);

  const { appreciationPct, isRetired, isTrending, pricingSource } = pricing;

  // Trend icon
  let TrendIcon = Minus;
  let trendColor = '#a8a29e';
  let trendText = 'Valore stabile';

  if (appreciationPct >= 50) {
    TrendIcon = TrendingUp;
    trendColor = '#10b981';
    trendText = `+${appreciationPct}% sul prezzo originale`;
  } else if (appreciationPct >= 15) {
    TrendIcon = TrendingUp;
    trendColor = '#d4af37';
    trendText = `+${appreciationPct}% sul prezzo originale`;
  } else if (appreciationPct < 0) {
    TrendIcon = TrendingDown;
    trendColor = '#f87171';
    trendText = `${appreciationPct}% rispetto al prezzo originale`;
  }

  const isEstimated = pricingSource === 'rrp_estimated';

  return (
    <div
      style={{
        marginTop: '0.75rem',
        padding: '1rem 1.25rem',
        backgroundColor: 'rgba(12, 10, 8, 0.9)',
        border: `1px solid ${isTrending ? 'rgba(16,185,129,0.4)' : 'rgba(212,175,55,0.25)'}`,
        borderRadius: '12px',
        backdropFilter: 'blur(8px)',
        boxShadow: isTrending ? '0 0 20px rgba(16,185,129,0.12)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendIcon size={16} color={trendColor} />
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: trendColor, letterSpacing: '0.05em' }}>
            {trendText}
          </span>
        </div>

        {isRetired && (
          <span style={{
            fontSize: '0.6rem', fontWeight: '700', letterSpacing: '0.08em',
            color: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.3)',
            padding: '0.15rem 0.5rem', borderRadius: '999px',
          }}>
            RITIRATO
          </span>
        )}

        {!isRetired && (
          <span style={{
            fontSize: '0.6rem', fontWeight: '700', letterSpacing: '0.08em',
            color: '#34d399', backgroundColor: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.25)',
            padding: '0.15rem 0.5rem', borderRadius: '999px',
          }}>
            IN PRODUZIONE
          </span>
        )}
      </div>

      {/* Condition selector row */}
      <div style={{ fontSize: '0.7rem', color: '#78716c', marginBottom: '0.5rem' }}>
        Condizione selezionata: <span style={{ color: '#e7e5e4', fontWeight: '600' }}>
          {CONDITION_LABELS[conditionKey]?.label || 'Usato'}
        </span>
      </div>

      {/* Price Range */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: '#78716c' }}>Range:</span>
        <span style={{ fontSize: '0.9rem', color: '#a8a29e' }}>{fmt(adjustedLow)}</span>
        <span style={{ fontSize: '0.7rem', color: '#57534e' }}>—</span>
        <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.02em' }}>
          {fmt(adjustedMid)}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#57534e' }}>—</span>
        <span style={{ fontSize: '0.9rem', color: '#a8a29e' }}>{fmt(adjustedHigh)}</span>
      </div>

      {/* Retail reference */}
      {pricing.retailPrice != null && (
        <div style={{ fontSize: '0.7rem', color: '#57534e', marginBottom: '0.5rem' }}>
          Prezzo originale LEGO (stimato): <span style={{ color: '#78716c' }}>{fmt(pricing.retailPrice)}</span>
        </div>
      )}

      {/* Condition impact table — compact */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem',
        marginTop: '0.75rem', paddingTop: '0.75rem',
        borderTop: '1px solid rgba(22, 19, 14,0.8)',
      }}>
        {Object.entries(CONDITION_LABELS).map(([key, { label, multiplier: m }]) => (
          <div
            key={key}
            style={{
              textAlign: 'center', padding: '0.4rem 0.25rem', borderRadius: '8px',
              backgroundColor: conditionKey === key ? 'rgba(212,175,55,0.08)' : 'transparent',
              border: conditionKey === key ? '1px solid rgba(212,175,55,0.2)' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: '0.6rem', color: '#78716c', marginBottom: '0.2rem' }}>{label}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: conditionKey === key ? '#d4af37' : '#a8a29e' }}>
              {fmt(Math.round(pricing.marketValue * m))}
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.4rem',
        marginTop: '0.75rem', padding: '0.5rem 0.75rem',
        backgroundColor: 'rgba(22, 19, 14,0.5)', borderRadius: '8px',
      }}>
        {isEstimated
          ? <AlertTriangle size={11} color="#bf9a2e" style={{ flexShrink: 0, marginTop: '1px' }} />
          : <Info size={11} color="#57534e" style={{ flexShrink: 0, marginTop: '1px' }} />
        }
        <p style={{ margin: 0, fontSize: '0.65rem', lineHeight: '1.4', color: isEstimated ? '#92400e' : '#57534e', fontStyle: 'italic' }}>
          {isEstimated
            ? 'Stima basata su prezzo al pezzo (RRP non disponibile). Verifica su BrickLink per conferma.'
            : 'Stima algoritmica basata su dati storici del mercato secondario LEGO. A scopo indicativo.'
          }
        </p>
      </div>
    </div>
  );
}
