import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setDisplayName, setLogoSrc } from '../../lib/sell/catalog';

// "Browse by expansion" strip on the Pokémon pages: only the expansions that have something to show right now
// (listings on the listings page, auctions on the auctions page), newest first. Renders nothing when there are none.
export default function ExpansionRail({ series, mode, game = 'pokemon' }) {
  const { t, i18n } = useTranslation();
  const countKey = mode.isAuction ? 'auctions_count' : 'listings_count';
  const sets = series.flatMap((s) => s.sets).filter((s) => s[countKey] > 0);
  if (sets.length === 0) return null;

  return (
    <section className="lx-bleed relative pb-6 pt-2" aria-labelledby="expansion-rail-title">
      <div className="mx-auto max-w-[1320px] px-5 md:px-10">
        <h2 id="expansion-rail-title" className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/50">{t('market.expansions.title')}</h2>
        <ul className="lx-rail -mx-5 flex gap-3 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
          {sets.map((s) => (
            <li key={s.id} className="shrink-0">
              <Link
                to={`${mode.base}/carte-collezionabili/${game}/${String(s.id).toLowerCase()}`}
                className="flex h-full w-52 items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.03] px-3 py-3 transition-colors hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              >
                {s.logo ? <img src={setLogoSrc(s.logo)} alt="" loading="lazy" className="h-9 w-12 shrink-0 object-contain" /> : <span className="h-9 w-12 shrink-0" aria-hidden="true" />}
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm font-bold leading-tight text-white">{setDisplayName(s, i18n.language)}</span>
                  <span className="block text-[11px] font-semibold" style={{ color: mode.accent }}>
                    {t(mode.isAuction ? 'market.count_auctions' : 'market.count_listings', { count: s[countKey] })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
