import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Camera, ImagePlus, ExternalLink, Check } from 'lucide-react';
import { apiPostForm, LISTING_ENDPOINTS } from '../../api';
import { formatEUR } from '../../components/landing/landingUtils';
import { analyzePhoto } from '../../components/sell/analyzePhoto';
import { useLocalizedNav } from '../../routing/useLocalizedNav';
import { printLabel, photoProblem } from '../../lib/sell/recognize';
import { cropOutputSize } from '../../lib/sell/crop';
import { publishedPath } from '../../lib/sell/review';
import {
  availableKinds, kindName, conditionsFor, cardForm, afterRecognition, priceOf, buyerPays, publishBlocker, listingFields, errorKey,
} from '../../lib/game/sellFlow';
import { PanelStatus } from './ItemList';
import { useApiData, useMoneyLocale } from './hooks';

/** The photo, upright and at most 1600 px on its long side (JPEG): light to send, sharp enough for the listing. */
async function shrinkPhoto(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = cropOutputSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file; // the server resizes anyway
  }
}

const conditionLabel = (t, kind, c) => t(kind === 'lego' ? `sell.condition_option_${c}` : `sell.condition_grade_${c}`);

/**
 * The player's shop: pick what to sell, photograph it, pick the exact print, set the price, publish. Everything but
 * the price comes from the photo and the catalog (lib/game/sellFlow.js); the listing goes through POST /api/listings
 * like the sell page's. `onMine()` opens the player's listings.
 */
export default function SellView({ color, onMine }) {
  const { t } = useTranslation();
  const locale = useMoneyLocale();
  const navTo = useLocalizedNav();
  const status = useApiData('/api/cards/recognize/status');
  const [s, setS] = useState({ step: 'kind' });
  const camRef = useRef(null);
  const fileRef = useRef(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  // the preview of the photo is released when it changes or the view goes away
  useEffect(() => () => { if (s.preview) URL.revokeObjectURL(s.preview); }, [s.preview]);

  const update = (patch) => { if (live.current) setS((cur) => ({ ...cur, ...patch })); };
  const kinds = availableKinds(status.data);

  async function onPhoto(e) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    update({ step: 'reading', error: null, retry: null }); // checking and shrinking a big photo takes a moment
    const problem = photoProblem(await analyzePhoto(picked));
    if (problem === 'too_small') { update({ step: 'photo', error: 'too_small' }); return; }
    const photo = await shrinkPhoto(picked);
    update({ photo, preview: URL.createObjectURL(photo) });
    const fd = new FormData();
    fd.append('game', s.kind);
    fd.append('image', photo, photo.name || 'foto.jpg');
    try {
      const answer = await apiPostForm('/api/cards/recognize', fd);
      const next = afterRecognition(s.kind, answer);
      if (next.step === 'retry') update({ step: 'photo', retry: next.reason });
      else update({ ...next, answer, price: '' });
    } catch (err) {
      update({ step: 'photo', error: errorKey(err) });
    }
  }

  async function publish() {
    const price = priceOf(s.price);
    if (publishBlocker(s.form, price, s.photo)) return;
    update({ step: 'publishing', error: null });
    const fd = new FormData();
    listingFields(s.form, price).forEach(([name, value]) => fd.append(name, value));
    fd.append('images', s.photo, s.photo.name || 'foto.jpg');
    try {
      const created = await apiPostForm(LISTING_ENDPOINTS.create, fd);
      update({ step: 'done', path: publishedPath(created) });
    } catch (err) {
      update({ step: 'summary', error: err?.status === 401 ? 'login' : 'publish', serverError: err?.data?.error || null });
    }
  }

  const restart = () => setS({ step: 'kind' });

  // ── which product ────────────────────────────────────────────────────────────
  if (s.step === 'kind') {
    if (status.status !== 'ready') return <PanelStatus status={status.status} onRetry={status.retry} />;
    if (!kinds.length) {
      return (
        <div className="flex flex-col gap-3 p-3">
          <p className="text-sm leading-relaxed text-white/80">{t('game.sell.unavailable')}</p>
          <Link to={navTo('/sell')} className="cbg-btn w-full" style={{ background: color }}>{t('game.sell.open_sell')} <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 p-3">
        <h3 className="cbg-pixel text-[0.6rem] leading-relaxed" style={{ color }}>{t('game.sell.kind_title')}</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {kinds.map((k) => (
            <button key={k} type="button" className="cbg-option text-center" onClick={() => setS({ step: 'photo', kind: k })}>{kindName(k)}</button>
          ))}
        </div>
      </div>
    );
  }

  // ── the photo ────────────────────────────────────────────────────────────────
  if (s.step === 'photo') {
    return (
      <div className="flex flex-col gap-3 p-3">
        <h3 className="cbg-pixel text-[0.6rem] leading-relaxed" style={{ color }}>{kindName(s.kind)}</h3>
        {s.retry && <p className="cbg-alert text-sm leading-relaxed">{t(`game.sell.retry_${s.retry}`)}</p>}
        {s.error && <p className="cbg-alert text-sm leading-relaxed">{t(`game.sell.error.${s.error}`)}</p>}
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
        <button type="button" className="cbg-btn w-full" style={{ background: color }} onClick={() => camRef.current?.click()}>
          <Camera className="h-4 w-4" aria-hidden /> {t('game.sell.photo_take')}
        </button>
        <p className="text-xs leading-relaxed text-white/60">{t(s.kind === 'lego' ? 'game.sell.photo_hint_lego' : 'game.sell.photo_hint_card')}</p>
        <button type="button" className="cbg-btn cbg-btn--ghost w-full" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-4 w-4" aria-hidden /> {t('game.sell.photo_pick')}
        </button>
        <p className="text-xs leading-relaxed text-white/50">{t('game.sell.photo_note')}</p>
        {s.retry && <Link to={navTo('/sell')} className="text-xs font-bold text-[#22d3ee] hover:underline">{t('game.sell.open_sell')}</Link>}
        <button type="button" className="text-xs font-bold text-white/60 hover:text-white" onClick={restart}>{t('game.sell.change_kind')}</button>
      </div>
    );
  }

  if (s.step === 'reading' || s.step === 'publishing') {
    return (
      <div className="flex flex-col items-center gap-3 p-4 text-center">
        {s.preview && <img src={s.preview} alt="" className="max-h-40 rounded border-2 border-black/60 object-contain" />}
        <p className="cbg-pixel text-[0.6rem] leading-relaxed text-white/70">{t(s.step === 'reading' ? 'game.sell.reading' : 'game.sell.publishing')}</p>
      </div>
    );
  }

  // ── which print ──────────────────────────────────────────────────────────────
  if (s.step === 'pick') {
    return (
      <div className="flex flex-col gap-3 p-3">
        {s.preview && <img src={s.preview} alt="" className="mx-auto max-h-32 rounded border-2 border-black/60 object-contain" />}
        <p className="cbg-dialog-text">{t('game.sell.pick_title')}</p>
        <ul className="flex flex-col gap-1.5">
          {s.prints.map((p) => {
            const label = printLabel(p, s.kind);
            const title = label.kind ? t(`sell.recognize.kind.${label.kind}`, { n: label.n }) : label.title;
            return (
              <li key={p.external_id}>
                <button type="button" className="cbg-item w-full text-left" onClick={() => update({ step: 'summary', form: cardForm(s.kind, p, s.answer?.reading), price: '' })}>
                  <span className="cbg-thumb h-16 w-12 shrink-0">{p.img_url ? <img src={p.img_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-white">{p.name}</span>
                    <span className="block truncate text-[0.7rem] text-white/80">{title}</span>
                    <span className="block truncate text-[0.7rem] text-white/55">{label.sub}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="text-xs font-bold text-white/60 hover:text-white" onClick={() => update({ step: 'photo', retry: null })}>{t('game.sell.retake')}</button>
      </div>
    );
  }

  // ── published ────────────────────────────────────────────────────────────────
  if (s.step === 'done') {
    return (
      <div className="flex flex-col gap-3 p-3">
        <p className="cbg-pixel inline-flex items-center gap-2 text-[0.65rem]" style={{ color }}><Check className="h-4 w-4" aria-hidden />{t('game.sell.done_title')}</p>
        <p className="text-sm leading-relaxed text-white/80">{t('game.sell.done_text')}</p>
        {s.path && <Link to={navTo(s.path)} className="cbg-btn w-full" style={{ background: color }}>{t('game.sell.open_listing')} <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>}
        <button type="button" className="cbg-btn cbg-btn--ghost w-full" onClick={restart}>{t('game.sell.sell_another')}</button>
        <button type="button" className="cbg-btn cbg-btn--ghost w-full" onClick={onMine}>{t('game.sell.my_listings')}</button>
      </div>
    );
  }

  // ── summary and price ────────────────────────────────────────────────────────
  const { form } = s;
  const lego = form.productType === 'lego';
  const price = priceOf(s.price);
  const blocker = publishBlocker(form, price, s.photo);
  const set = s.answer?.set;
  const value = s.answer?.pricing?.marketValue;
  const rows = (lego
    ? [['set_number', form.setNumber], ['year', form.year], ['pieces', set?.num_parts ? String(set.num_parts) : '']]
    : [['game', kindName(s.kind)], ['set', form.cardSetName], ['number', form.cardNumber], ['language', form.cardLanguage ? form.cardLanguage.toUpperCase() : ''], ['rarity', form.cardRarity]]
  ).filter(([, v]) => v);
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex gap-3">
        {s.preview && <img src={s.preview} alt="" className="h-24 w-20 shrink-0 rounded border-2 border-black/60 object-cover" />}
        <h3 className="text-sm font-black leading-snug text-white">{form.title}</h3>
      </div>
      <dl className="cbg-stats">
        {rows.map(([k, v]) => <div key={k}><dt>{t(`game.sell.field.${k}`)}</dt><dd>{v}</dd></div>)}
        <div><dt>{t('game.sell.field.shipping')}</dt><dd>{t('game.sell.shipping_value')}</dd></div>
      </dl>
      <p className="text-xs leading-relaxed text-white/55">{t('game.sell.shipping_note')}</p>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="cbg-pixel mb-1.5 text-[0.55rem]" style={{ color }}>{t('game.sell.field.condition')}</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {conditionsFor(lego ? 'lego' : 'tcg').map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={form.condition === c}
              className="cbg-option text-center"
              style={form.condition === c ? { borderColor: color, color } : undefined}
              onClick={() => update({ form: { ...form, condition: c } })}
            >
              {conditionLabel(t, lego ? 'lego' : 'tcg', c)}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-white/55">{t(form.condition ? 'game.sell.condition_hint' : 'game.sell.condition_pick')}</p>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="cbg-pixel text-[0.55rem]" style={{ color }}>{t('game.sell.price_label')}</span>
        <input
          className="cbg-input text-base"
          inputMode="decimal"
          autoComplete="off"
          placeholder={t('game.sell.price_placeholder')}
          value={s.price || ''}
          onChange={(e) => update({ price: e.target.value })}
        />
      </label>
      {value ? <p className="text-xs text-white/60">{t('game.sell.market_value', { amount: formatEUR(value, locale) })}</p> : null}
      {price ? <p className="text-xs leading-relaxed text-white/70">{t('game.sell.buyer_pays', { amount: formatEUR(buyerPays(price), locale) })}</p> : null}

      {s.error && <p className="cbg-alert text-sm leading-relaxed">{s.serverError && s.error === 'publish' ? s.serverError : t(`game.sell.error.${s.error}`)}</p>}
      <button type="button" className="cbg-btn w-full" style={{ background: color }} disabled={Boolean(blocker)} onClick={publish}>{t('game.sell.publish')}</button>
      {blocker && blocker !== 'photo' && <p className="text-center text-xs text-white/55">{t(`game.sell.blocker.${blocker}`)}</p>}
      <button type="button" className="text-xs font-bold text-white/60 hover:text-white" onClick={() => update({ step: 'photo', retry: null, error: null })}>{t('game.sell.retake')}</button>
    </div>
  );
}
