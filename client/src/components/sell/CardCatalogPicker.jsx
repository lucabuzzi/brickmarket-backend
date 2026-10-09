import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../api';
import {
  SET_EXAMPLE, cardNumberLabel, clearCardPatch, filterCards, filterSeries, pickCardPatch, seriesDisplayName, setDisplayName, setLogoSrc,
} from '../../lib/sell/catalog';

// Optional shortcut of the sell wizard for the games that have an expansion catalog (`game`): pick the expansion, then the card, and the form is filled
// in (title, number, rarity, language). The picture shown is a catalog reference, never saved as the listing photo.
export default function CardCatalogPicker({ form, patch, game = 'pokemon' }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [series, setSeries] = useState(null); // null = loading, [] = unavailable
  const [setQuery, setSetQuery] = useState('');
  const [cardQuery, setCardQuery] = useState('');
  const [loadedSet, setLoadedSet] = useState(null); // { set, cards } of the last expansion fetched
  const [failedSetId, setFailedSetId] = useState('');
  const [picking, setPicking] = useState(false);
  const [pickedImage, setPickedImage] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/catalog/${game}/sets`)
      .then((d) => { if (!cancelled) setSeries(Array.isArray(d?.series) ? d.series : []); })
      .catch(() => { if (!cancelled) setSeries([]); });
    return () => { cancelled = true; };
  }, [game]);

  // load the cards of the chosen expansion (also when editing a listing that already has one)
  useEffect(() => {
    const id = form.cardSetId;
    if (!id) return undefined;
    let cancelled = false;
    apiFetch(`/catalog/${game}/sets/${encodeURIComponent(id)}`)
      .then((d) => { if (!cancelled) setLoadedSet(d); })
      .catch(() => { if (!cancelled) setFailedSetId(id); });
    return () => { cancelled = true; };
  }, [form.cardSetId, game]);

  // what is shown depends on the expansion chosen NOW: data of a previous one is ignored, never cleared by hand
  const setData = loadedSet && String(loadedSet.set?.id).toLowerCase() === String(form.cardSetId).toLowerCase() ? loadedSet : null;
  const loadingSet = !!form.cardSetId && !setData && failedSetId !== form.cardSetId;

  const chosenSet = useMemo(() => {
    if (setData?.set) return setData.set;
    for (const s of series || []) for (const x of s.sets) if (x.id === form.cardSetId) return x;
    return null;
  }, [setData, series, form.cardSetId]);

  const filteredSeries = useMemo(() => filterSeries(series || [], setQuery), [series, setQuery]);
  const found = useMemo(() => filterCards(setData?.cards || [], cardQuery), [setData, cardQuery]);

  const chooseSet = (set) => {
    patch({ cardSetId: set.id, cardSetName: setDisplayName(set, 'it'), ...clearCardPatch() });
    setSetQuery('');
    setCardQuery('');
    setPickedImage('');
  };
  const clearSet = () => {
    patch({ cardSetId: '', cardSetName: '', ...clearCardPatch() });
    setPickedImage('');
  };

  async function chooseCard(card) {
    setPicking(true);
    let full = card;
    try { full = (await apiFetch(`/catalog/${game}/${encodeURIComponent(card.external_id)}`)) || card; } catch { /* the list row is enough */ }
    patch(pickCardPatch(full, setData?.set || chosenSet, form, game));
    setPickedImage(full.img_url || card.img_url || '');
    setPicking(false);
  }

  const unavailable = series !== null && series.length === 0 && !form.cardSetId;
  const rowCls = 'flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none';

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5" aria-labelledby="sell-catalog-title">
      <div>
        <h3 id="sell-catalog-title" className="text-sm font-black uppercase tracking-[0.14em] text-white/55">{t('sell.ui.catalog.title')}</h3>
        <p className="mt-1 text-[13px] text-white/50">{t('sell.ui.catalog.hint')}</p>
      </div>

      {unavailable ? <p className="text-sm text-white/55">{t('sell.ui.catalog.unavailable')}</p> : null}

      {!form.cardSetId && !unavailable ? (
        <div>
          <label htmlFor="sell-catalog-set" className="mb-1.5 block text-[13px] font-bold text-white/80">{t('sell.ui.catalog.set_label')}</label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" aria-hidden="true" />
            <input
              id="sell-catalog-set"
              type="search"
              value={setQuery}
              onChange={(e) => setSetQuery(e.target.value)}
              placeholder={t('sell.ui.catalog.set_placeholder', { example: SET_EXAMPLE[game] })}
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-[15px] text-white placeholder:text-white/30 focus:border-[#c6ff3d]/60 focus:outline-none focus:ring-2 focus:ring-[#c6ff3d]/20"
            />
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/20">
            {series === null ? (
              <p className="flex items-center gap-2 px-3 py-4 text-sm text-white/50"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t('sell.ui.catalog.loading')}</p>
            ) : filteredSeries.length === 0 ? (
              <p className="px-3 py-4 text-sm text-white/50">{t('sell.ui.catalog.no_results')}</p>
            ) : filteredSeries.map((s) => (
              <div key={s.id}>
                <p className="sticky top-0 z-[1] bg-[#15131c] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-white/40">{seriesDisplayName(s, lang)}</p>
                <ul>
                  {s.sets.map((x) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => chooseSet(x)} className={rowCls}>
                        <span className="flex h-8 w-14 shrink-0 items-center justify-center">
                          {x.logo ? <img src={setLogoSrc(x.logo)} alt="" loading="lazy" className="max-h-8 max-w-full object-contain" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">{setDisplayName(x, lang)}</span>
                          {x.card_count_total ? <span className="block text-[11px] text-white/40">{t('sell.ui.catalog.cards_count', { count: x.card_count_total })}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {form.cardSetId ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-[#c6ff3d]/40 bg-[#c6ff3d]/[0.06] px-3 py-2.5">
            <Check size={16} className="shrink-0 text-[#c6ff3d]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{t('sell.ui.catalog.set_label')}</p>
              <p className="truncate text-sm font-bold text-white">{chosenSet ? setDisplayName(chosenSet, lang) : form.cardSetName || form.cardSetId}</p>
            </div>
            <button type="button" onClick={clearSet} className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 hover:border-white/30">{t('sell.ui.catalog.change')}</button>
          </div>

          {form.cardExternalId ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {pickedImage ? <img src={pickedImage} alt="" loading="lazy" className="h-24 w-[4.3rem] shrink-0 rounded-md object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{form.title}</p>
                <p className="text-xs text-white/50">{form.cardNumber ? `#${form.cardNumber}` : ''}{form.cardRarity ? ` · ${form.cardRarity}` : ''}</p>
                {pickedImage ? <p className="mt-1 text-[11px] text-white/35">{t('sell.ui.catalog.reference_note')}</p> : null}
              </div>
              <button type="button" onClick={() => { patch(clearCardPatch()); setPickedImage(''); }} aria-label={t('sell.ui.catalog.card_clear')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/40 text-white/70 hover:bg-red-600 hover:text-white">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="sell-catalog-card" className="mb-1.5 block text-[13px] font-bold text-white/80">{t('sell.ui.catalog.card_label')}</label>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" aria-hidden="true" />
                <input
                  id="sell-catalog-card"
                  type="search"
                  value={cardQuery}
                  onChange={(e) => setCardQuery(e.target.value)}
                  placeholder={t('sell.ui.catalog.card_placeholder')}
                  autoComplete="off"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-[15px] text-white placeholder:text-white/30 focus:border-[#c6ff3d]/60 focus:outline-none focus:ring-2 focus:ring-[#c6ff3d]/20"
                />
              </div>
              <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/20">
                {loadingSet || picking ? (
                  <p className="flex items-center gap-2 px-3 py-4 text-sm text-white/50"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t('sell.ui.catalog.loading')}</p>
                ) : found.cards.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-white/50">{t('sell.ui.catalog.no_results')}</p>
                ) : (
                  <ul>
                    {found.cards.map((c) => (
                      <li key={c.external_id}>
                        <button type="button" onClick={() => chooseCard(c)} className={rowCls}>
                          {c.img_url ? <img src={c.img_url} alt="" loading="lazy" className="h-12 w-9 shrink-0 rounded object-cover" /> : <span className="h-12 w-9 shrink-0 rounded bg-white/5" aria-hidden="true" />}
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{c.name}</span>
                          {c.details?.variant ? <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/60">{t('sell.ui.catalog.variant', { n: c.details.variant })}</span> : null}
                          <span className="shrink-0 font-mono text-xs text-white/45">{cardNumberLabel(c.details?.localId, chosenSet?.card_count_official, game)}</span>
                        </button>
                      </li>
                    ))}
                    {found.total > found.cards.length ? (
                      <li className="px-3 py-2 text-center text-xs text-white/40">{t('sell.ui.catalog.refine', { count: found.total - found.cards.length })}</li>
                    ) : null}
                  </ul>
                )}
              </div>
              <p className="mt-2 text-xs text-white/40">{t('sell.ui.catalog.not_found_hint')}</p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
