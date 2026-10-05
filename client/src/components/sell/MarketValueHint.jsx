import { TrendingDown, TrendingUp, Minus, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Estimated market value of the LEGO set the seller looked up (Rebrickable pricing), adjusted for the
// condition they picked. Same maths the page always used; only the look changed.
const CONDITION_KEYS = ['new', 'used', 'complete', 'parts'];
const DEFAULT_MULTIPLIERS = { new: 1, used: 0.65, complete: 0.55, parts: 0.3 };

export default function MarketValueHint({ pricing, condition, setNumber }) {
  const { t } = useTranslation();
  if (!pricing || pricing.marketValue == null) return null;

  const condKey = condition && CONDITION_KEYS.includes(condition) ? condition : 'used';
  const multipliers = pricing.conditionMultipliers || DEFAULT_MULTIPLIERS;
  const mult = multipliers[condKey] ?? 0.65;
  const adjusted = Math.round(pricing.marketValue * mult);
  const appPct = pricing.appreciationPct;
  const TrendIcon = appPct >= 15 ? TrendingUp : appPct < 0 ? TrendingDown : Minus;
  const trendColor = appPct >= 50 ? 'text-emerald-400' : appPct >= 15 ? 'text-[#c6ff3d]' : appPct < 0 ? 'text-red-400' : 'text-stone-500';
  const condLabels = { new: t('sell.pricing_cond_new'), used: t('sell.pricing_cond_used'), complete: t('sell.pricing_cond_complete'), parts: t('sell.pricing_cond_parts') };
  const eur = (n) => `€${Math.round(n).toLocaleString('it-IT')}`;

  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-[#0d0c12]/90 px-4 py-3 backdrop-blur-xl ${pricing.isTrending ? 'border-emerald-400/35 shadow-[0_0_24px_rgba(16,185,129,0.12)]' : 'border-[#c6ff3d]/20'}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${pricing.isTrending ? 'bg-emerald-400/10 text-emerald-400' : 'bg-[#c6ff3d]/10 text-[#c6ff3d]'}`}>
        <Zap size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">{t('sell.market_value_estimated')}</p>
        <p className="truncate text-xs text-white/55">
          {setNumber || t('sell.set_fallback')} · <span className="text-white/70">{condLabels[condKey]}</span>
        </p>
      </div>
      {appPct != null ? (
        <span className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${trendColor}`}>
          <TrendIcon size={14} aria-hidden="true" />
          {appPct >= 0 ? `+${appPct}%` : `${appPct}%`}
        </span>
      ) : null}
      <div className="shrink-0 text-right">
        <p className="text-xl font-black leading-none tracking-tight text-white sm:text-2xl">{eur(adjusted)}</p>
        <p className="mt-1 text-[10px] text-white/40">{eur(pricing.low * mult)} – {eur(pricing.high * mult)}</p>
      </div>
    </div>
  );
}
