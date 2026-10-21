import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { Calendar, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Clock, Gavel, Loader2, Lock, Package, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { LISTING_ENDPOINTS, apiPostForm, apiFetch, SERVER_URL } from '../api';
import { useAuth } from '../auth/useAuth';
import SetLookupInput from '../components/SetLookupInput';
import Stepper from '../components/sell/Stepper';
import Field, { FieldGroup } from '../components/sell/FormField';
import { inputCls } from '../components/sell/inputClass';
import ChoiceTile from '../components/sell/ChoiceTile';
import PhotoSlots from '../components/sell/PhotoSlots';
import PhotoGuide from '../components/sell/PhotoGuide';
import usePhotoQuality from '../components/sell/analyzePhoto';
import MarketValueHint from '../components/sell/MarketValueHint';
import ReviewStep from '../components/sell/ReviewStep';
import Celebration from '../components/sell/Celebration';
import { PreviewBar, PreviewPanel } from '../components/sell/ListingPreview';
import OrientationPicker from '../components/sell/OrientationPicker';
import CropEditor from '../components/sell/CropEditor';
import CardDetails from '../components/sell/CardDetails';
import CardCatalogPicker from '../components/sell/CardCatalogPicker';
import CardShotGuide from '../components/sell/CardShotGuide';
import { ANNUNCI_CARD_GAMES } from '../config/annunciCategories';
import { CARRIERS } from './Sell';
import { INITIAL_FORM, MAX_PHOTOS, TCG_CONDITIONS, changeProductType, defaultImageOrientation, selectGame } from '../lib/auction/form';
import { hasCatalog } from '../lib/sell/catalog';
import { cardSummaryParts, languageName } from '../lib/sell/cards';
import { mergePhotos, movePhoto, removePhotoAt } from '../lib/sell/photos';
import { shotListFor } from '../lib/sell/shots';
import { FIELD_STEP, STEP_IDS, firstErrorField, validateAll, validateStep } from '../lib/auction/validate';
import { buildAuctionFields } from '../lib/auction/payload';
import { completeness } from '../lib/auction/score';
import { draftKey, isDraftWorthSaving, parseDraft, serializeDraft } from '../lib/auction/draft';
import { buildPreviewListing } from '../lib/auction/preview';
import { chosenCarrierIds, formatPrice, publishBlockers, publishedPath } from '../lib/auction/review';

const ACCENT = 'orange';
const NS = 'create_auction';
const ID_PREFIX = 'auction';

const CATEGORIES = [
  { value: '', label: '— Seleziona categoria —' },
  { value: 'Star Wars', label: 'Star Wars' },
  { value: 'City', label: 'City' },
  { value: 'Disney', label: 'Disney' },
  { value: 'Ideas', label: 'Ideas' },
  { value: 'Technic', label: 'Technic' },
  { value: 'Harry Potter', label: 'Harry Potter' },
  { value: 'Marvel', label: 'Marvel' },
  { value: 'Creator', label: 'Creator' },
  { value: 'Speed Champions', label: 'Speed Champions' },
  { value: 'Altro', label: 'Altro' },
];

const PRODUCT_TYPE_OPTIONS = [
  { id: 'lego', icon: '🧱' },
  { id: 'tcg', icon: '🎴' },
  { id: 'funko', icon: '🧸' },
];

const MAIN_CATEGORY_OPTIONS = [
  { id: 'sets', icon: '🧱' },
  { id: 'mocs', icon: '🏗️' },
  { id: 'minifigures', icon: '👤' },
];

const CONDITION_ICONS = {
  new: '✨', used: '🧱', complete: '📦', parts: '🔩',
  near_mint: '💎', slightly_played: '👍', moderately_played: '👌', heavy_played: '😬', poor_damaged: '🩹',
};

const STEP_ICONS = { what: Package, photos: Camera, condition: ShieldCheck, price: Gavel, review: ClipboardCheck };
const STEPS = STEP_IDS.map((id) => ({ id, Icon: STEP_ICONS[id] }));
const TOTAL_STEPS = STEPS.length;

const noStar = (s) => String(s).replace(/\s*\*\s*$/, '');

const BOX_LABEL_KEYS = { 'Mint (Perfetta)': 'box_condition_mint', 'Damaged (Danneggiata)': 'box_condition_damaged', 'None (Assente)': 'box_condition_none' };
const INSTRUCTIONS_LABEL_KEYS = { 'Yes (Presenti)': 'instructions_present', 'No (Assenti)': 'instructions_absent', 'Solo PDF': 'instructions_pdf_only' };

const emptyForm = () => ({ ...INITIAL_FORM, shippingOptions: {} });
const removeStepErrors = (errors, stepId) => Object.fromEntries(Object.entries(errors).filter(([field]) => FIELD_STEP[field] !== stepId));
const safeStorage = (fn) => { try { return fn(); } catch { return null; } };

// A server auction_end (UTC ISO) -> the local "YYYY-MM-DDTHH:mm" a <input type="datetime-local"> expects.
function toLocalDatetimeInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateAuction() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { user } = useAuth();
  const userId = user?.id;
  const reduceMotion = useReducedMotion();

  const isPro = user?.role === 'professional' || user?.role_name === 'professional' || user?.is_pro || user?.seller_type === 'professional';

  // ── State ────────────────────────────────────────────────────────────────
  const [form, setForm] = useState(emptyForm);
  const patch = useCallback((p) => setForm((f) => ({ ...f, ...p })), []);
  const [step, setStep] = useState(1);
  const [reached, setReached] = useState(1);
  const [files, setFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [photoNotices, setPhotoNotices] = useState([]);
  const [cropQueue, setCropQueue] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingListing, setLoadingListing] = useState(!!editId);
  const [lookupPieces, setLookupPieces] = useState(null);
  const [lookupPricing, setLookupPricing] = useState(null);
  const [restoredAtStep, setRestoredAtStep] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dimsOpen, setDimsOpen] = useState(false);
  const [focusReq, setFocusReq] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [published, setPublished] = useState(null);
  const [guideSeen, setGuideSeen] = useState(() => safeStorage(() => window.localStorage.getItem('cardbrix_auction_guide_seen')) === '1');
  // Once an auction is no longer a draft, the server locks its starting bid and end date for good.
  const [existingStatus, setExistingStatus] = useState(null);
  const bidLocked = !!editId && existingStatus != null && existingStatus !== 'draft';

  const draftReady = useRef(false);
  const lastSig = useRef('');
  const headingRef = useRef(null);
  const wizardTopRef = useRef(null);
  const firstRender = useRef(true);

  const isLego = form.productType === 'lego';
  const stepId = STEP_IDS[step - 1];
  const photoCount = files.length || (editId ? existingImages.length : 0);
  const guidedCards = form.productType === 'tcg' && !editId;
  const ctx = useMemo(
    () => ({ photoCount, editing: !!editId, guidedCards, isPro, bidLocked }),
    [photoCount, editId, guidedCards, isPro, bidLocked]
  );

  const shots = useMemo(() => shotListFor({ productType: form.productType, mainCategory: form.mainCategory }), [form.productType, form.mainCategory]);
  const photoQuality = usePhotoQuality(files);

  const previews = useMemo(() => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  const localizedCategories = useMemo(
    () => CATEGORIES.map((c) => ({
      ...c,
      label: c.value === '' ? t(`${NS}.category_placeholder`) : c.value === 'Altro' ? t(`${NS}.category_other`) : c.label,
    })),
    [t]
  );

  const meter = useMemo(() => completeness(form, { photoCount }), [form, photoCount]);
  const previewListing = useMemo(
    () => ({
      ...buildPreviewListing(form, { sellerName: user?.username || '', image: previews[0]?.url || '' }),
      title: form.title.trim() || t(`${NS}.ui.preview.title_fallback`),
    }),
    [form, user?.username, previews, t]
  );

  const carrierIds = useMemo(() => CARRIERS.map((c) => c.id), []);
  const blockers = useMemo(() => (stepId === 'review' ? publishBlockers(form, ctx) : []), [stepId, form, ctx]);

  const standardEndDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }, []);
  const standardDateFormatted = useMemo(
    () => standardEndDate.toLocaleString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    [standardEndDate, i18n.language]
  );
  const customDateFormatted = useMemo(() => {
    if (form.durationMode !== 'custom' || !form.customEndDate) return '';
    const d = new Date(form.customEndDate);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  }, [form.durationMode, form.customEndDate, i18n.language]);

  const summary = useMemo(() => {
    const isTcg = form.productType === 'tcg';
    const conditionOf = (c) => (c ? (isTcg ? t(`${NS}.condition_grade_${c}`) : t(`${NS}.condition_option_${c}`)) : '');
    const what = [
      t(`${NS}.product_type_${form.productType}`),
      form.productType === 'lego' && form.mainCategory ? t(`${NS}.category_${form.mainCategory}`) : form.category,
      form.setNumber.trim() ? `#${form.setNumber.trim()}` : '',
      form.productType === 'tcg' ? [form.cardSetName, form.cardNumber ? `#${form.cardNumber}` : ''].filter(Boolean).join(' ') : '',
      form.productType === 'lego' ? String(form.year || '').trim() : '',
    ].filter(Boolean);
    const cardExtras = isTcg
      ? cardSummaryParts(form, { language: (code) => languageName(code, i18n.language), otherCompany: t(`${NS}.ui.cards.grading_other`) })
      : [];
    const conditionExtras = isTcg ? cardExtras : form.productType === 'lego' ? [
      BOX_LABEL_KEYS[form.boxCondition] ? `${noStar(t(`${NS}.box_condition_label`))}: ${t(`${NS}.${BOX_LABEL_KEYS[form.boxCondition]}`)}` : '',
      INSTRUCTIONS_LABEL_KEYS[form.instructions] ? `${noStar(t(`${NS}.instructions_label`))}: ${t(`${NS}.${INSTRUCTIONS_LABEL_KEYS[form.instructions]}`)}` : '',
      form.isComplete ? t(`${NS}.complete_set_label`) : '',
    ].filter(Boolean) : [];
    const photos = previews.map((p) => p.url);
    const names = Object.fromEntries(CARRIERS.map((c) => [c.id, c.name]));
    const priceNote = form.durationMode === 'custom'
      ? (customDateFormatted ? t(`${NS}.auction_note_custom`, { date: customDateFormatted }) : '')
      : t(`${NS}.auction_note_standard`, { date: standardDateFormatted });
    return {
      title: form.title.trim(),
      what,
      photos,
      photoCount,
      maxPhotos: MAX_PHOTOS,
      condition: conditionOf(form.condition),
      conditionExtras,
      price: form.startingBid,
      priceNote,
      carriers: chosenCarrierIds(form.shippingOptions, carrierIds).map((id) => names[id]),
      description: form.description,
    };
  }, [form, previews, photoCount, carrierIds, t, i18n.language, customDateFormatted, standardDateFormatted]);

  // ── Edit mode: load the listing ──────────────────────────────────────────
  useEffect(() => {
    if (!editId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setLoadingListing(true);
        const data = await apiFetch(`/api/listings/${editId}`);
        if (cancelled) return;
        const c = (data.condition || '').toLowerCase();
        let condition = 'used';
        if (TCG_CONDITIONS.includes(c)) condition = c;
        else if (c === 'new' || c === 'sealed') condition = 'new';
        else if (c === 'complete') condition = 'complete';
        else if (c === 'parts') condition = 'parts';

        const shippingOptions = {};
        if (Array.isArray(data.shipping_options)) {
          data.shipping_options.forEach((opt) => { shippingOptions[opt.carrier] = { selected: true, price: opt.cost }; });
        }
        const hasEnd = !!data.auction_end;
        patch({
          productType: data.product_type || 'lego',
          game: data.game || '',
          title: data.title || '',
          setNumber: data.set_number || '',
          mainCategory: data.category || 'sets',
          category: data.theme || '',
          year: data.year || '',
          condition,
          boxCondition: data.box_condition || '',
          instructions: data.instructions || '',
          isComplete: !!data.is_complete,
          startingBid: data.auction_start != null ? String(data.auction_start) : '',
          durationMode: hasEnd ? 'custom' : 'standard',
          customEndDate: hasEnd ? toLocalDatetimeInput(data.auction_end) : '',
          shippingOptions,
          weightKg: data.weight_kg != null ? String(data.weight_kg) : '',
          lengthCm: data.length_cm != null ? String(data.length_cm) : '',
          widthCm: data.width_cm != null ? String(data.width_cm) : '',
          heightCm: data.height_cm != null ? String(data.height_cm) : '',
          description: data.description || '',
          proNotes: data.pro_notes || '',
          imageOrientation: data.image_orientation || '',
          cardLanguage: data.card_language || '',
          cardRarity: data.card_rarity || '',
          gradingCompany: data.card_grading_company || '',
          cardGrade: data.card_grade || '',
          cardSetId: data.card_set_id || '',
          cardSetName: '',
          cardNumber: data.card_number || '',
          cardExternalId: data.card_external_id || '',
        });
        setExistingImages(data.images || []);
        setExistingStatus(data.status || 'active');
      } catch {
        if (!cancelled) setServerError(t(`${NS}.error_generic`));
      } finally {
        if (!cancelled) setLoadingListing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId, t, patch]);

  // ── Automatic draft: restore once, then save while typing ────────────────
  useEffect(() => {
    if (editId || !userId) return;
    const saved = parseDraft(safeStorage(() => window.localStorage.getItem(draftKey(userId))));
    if (saved) {
      setForm({ ...emptyForm(), ...saved.form });
      setStep(saved.step);
      setReached(saved.step);
      setRestoredAtStep(saved.step);
      lastSig.current = serializeDraft(saved.form, saved.step, 0);
    }
    draftReady.current = true;
  }, [editId, userId]);

  useEffect(() => {
    if (editId || !userId || published || !draftReady.current || !isDraftWorthSaving(form)) return undefined;
    const sig = serializeDraft(form, step, 0);
    if (sig === lastSig.current) return undefined;
    const id = setTimeout(() => {
      const ok = safeStorage(() => { window.localStorage.setItem(draftKey(userId), serializeDraft(form, step)); return true; });
      if (ok) { lastSig.current = sig; setSavedFlash(true); }
    }, 700);
    return () => clearTimeout(id);
  }, [form, step, editId, userId, published]);

  useEffect(() => {
    if (!savedFlash) return undefined;
    const id = setTimeout(() => setSavedFlash(false), 2500);
    return () => clearTimeout(id);
  }, [savedFlash]);

  useEffect(() => {
    if (restoredAtStep != null && step !== restoredAtStep) setRestoredAtStep(null);
  }, [step, restoredAtStep]);

  const clearDraft = useCallback(() => {
    lastSig.current = '';
    if (userId) safeStorage(() => window.localStorage.removeItem(draftKey(userId)));
  }, [userId]);

  function discardDraft() {
    clearDraft();
    setForm(emptyForm());
    setFiles([]);
    setErrors({});
    setStep(1);
    setReached(1);
    setLookupPieces(null);
    setLookupPricing(null);
    setRestoredAtStep(null);
    setPhotoNotices([]);
    setPublished(null);
  }

  // ── Keep error messages honest ────────────────────────────────────────────
  useEffect(() => {
    setErrors((prev) => {
      const fields = Object.keys(prev);
      if (!fields.length) return prev;
      const next = {};
      for (const f of fields) {
        const mode = prev[f] === 'photo_required' ? 'publish' : 'next';
        const still = validateStep(FIELD_STEP[f], form, ctx, mode)[f];
        if (still) next[f] = still;
      }
      const same = Object.keys(next).length === fields.length && fields.every((f) => next[f] === prev[f]);
      return same ? prev : next;
    });
  }, [form, ctx]);

  useEffect(() => {
    if (errors.weightKg || errors.lengthCm || errors.widthCm || errors.heightCm) setDimsOpen(true);
  }, [errors]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus({ preventScroll: true });
    wizardTopRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [step, reduceMotion]);

  useEffect(() => {
    if (!focusReq) return;
    const el = document.getElementById(`${ID_PREFIX}-${focusReq.field}`);
    if (el) {
      const target = el.getAttribute('role') === 'radiogroup' || el.getAttribute('role') === 'group'
        ? el.querySelector('[aria-checked="true"]') || el.querySelector('button, input')
        : el;
      target?.focus();
    }
    setFocusReq(null);
  }, [focusReq]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const set = (name) => (e) => patch({ [name]: e.target.value });
  const err = (field) => (errors[field] ? t(`${NS}.ui.err.${errors[field]}`) : undefined);

  const handleSetFound = (setData) => {
    const next = {};
    if (setData.name) next.title = setData.name;
    if (setData.set_num) next.setNumber = setData.set_num;
    if (setData.year) next.year = String(setData.year);
    patch(next);
    if (setData.num_parts) setLookupPieces(setData.num_parts);
    if (setData.pricing) setLookupPricing(setData.pricing);
  };
  const handleLookupClear = () => { setLookupPieces(null); setLookupPricing(null); };

  function addPhotos(list) {
    const r = mergePhotos(files, list, MAX_PHOTOS);
    setFiles(r.files);
    const added = r.files.filter((f) => !files.includes(f));
    if (added.length) setCropQueue((q) => [...q, ...added]);
    setPhotoNotices([r.overflow ? 'limit' : null, r.notImage ? 'not_image' : null].filter(Boolean));
  }
  // the photo a card was recognised from becomes the first photo; a newer one replaces it (never cropped on the spot)
  const recognizedPhoto = useRef(null);
  function setRecognizedPhoto(file) {
    const previous = recognizedPhoto.current;
    const rest = files.filter((f) => f !== previous);
    if (rest.length >= MAX_PHOTOS) { setPhotoNotices(['limit']); return; }
    recognizedPhoto.current = file;
    setFiles(mergePhotos([], [file, ...rest], MAX_PHOTOS).files);
    setCropQueue((q) => q.filter((f) => f !== previous));
  }
  function movePhotoTo(from, to) {
    setFiles((f) => movePhoto(f, from, to));
  }
  const openGuide = () => {
    setGuideOpen(true);
    if (!guideSeen) {
      setGuideSeen(true);
      safeStorage(() => window.localStorage.setItem('cardbrix_auction_guide_seen', '1'));
    }
  };
  const closeGuide = useCallback(() => setGuideOpen(false), []);
  const finishCrop = useCallback((cropped) => {
    const current = cropQueue[0];
    if (cropped && current) setFiles((fs) => fs.map((f) => (f === current ? cropped : f)));
    setCropQueue((q) => q.slice(1));
  }, [cropQueue]);
  function removePhoto(i) {
    setCropQueue((q) => q.filter((f) => f !== files[i]));
    setFiles((f) => removePhotoAt(f, i));
    setPhotoNotices([]);
  }

  const jumpTo = (id) => {
    const index = STEP_IDS.indexOf(id) + 1;
    if (index < 1) return;
    setStep(index);
    setReached((r) => Math.max(r, index));
  };
  function fixBlocker(b) {
    setErrors(validateAll(form, ctx, 'publish').errors);
    jumpTo(b.step);
    setFocusReq({ field: b.field });
  }

  const toggleCarrier = (id, selected) => patch({ shippingOptions: { ...form.shippingOptions, [id]: { ...form.shippingOptions[id], selected } } });

  function goNext() {
    const errs = validateStep(stepId, form, ctx, 'next');
    setErrors((prev) => ({ ...removeStepErrors(prev, stepId), ...errs }));
    if (Object.keys(errs).length) {
      setFocusReq({ field: firstErrorField(stepId, errs) });
      return;
    }
    const next = Math.min(step + 1, TOTAL_STEPS);
    setStep(next);
    setReached((r) => Math.max(r, next));
  }

  async function submit(mode) {
    setServerError('');
    const { errors: errs, firstStep } = validateAll(form, ctx, mode);
    if (firstStep) {
      const currentHasErrors = Object.keys(errs).some((f) => FIELD_STEP[f] === stepId);
      const target = currentHasErrors ? stepId : firstStep;
      const index = STEP_IDS.indexOf(target) + 1;
      setErrors(errs);
      setStep(index);
      setReached((r) => Math.max(r, index));
      setFocusReq({ field: firstErrorField(target, errs) });
      return;
    }
    setErrors({});

    const fd = new FormData();
    buildAuctionFields(form, mode, { isPro, editing: !!editId, bidLocked }).forEach(([name, value]) => fd.append(name, value));
    files.forEach((f) => fd.append('images', f));

    setBusy(true);
    try {
      let created = null;
      if (editId) {
        const token = localStorage.getItem('cardbrix_token');
        const res = await fetch(`${SERVER_URL}/api/listings/${editId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || t(`${NS}.error_generic`));
        }
      } else {
        created = await apiPostForm(LISTING_ENDPOINTS.create, fd);
      }
      clearDraft();
      if (mode === 'publish' && !editId) {
        const path = publishedPath(created);
        setPublished({ path, listing: created?.id != null ? { ...previewListing, id: created.id } : previewListing });
      } else {
        navigate('/my-listings', { replace: true });
      }
    } catch (e) {
      setServerError(e.message || t(`${NS}.error_generic`));
    } finally {
      setBusy(false);
    }
  }

  const StepIcon = STEP_ICONS[stepId];
  const tcgGameLabel = (g) => g.name;
  const conditionOptions = form.productType === 'tcg' ? TCG_CONDITIONS : ['new', 'used', 'complete', 'parts'];
  const conditionLabelOf = (c) => (form.productType === 'tcg' ? t(`${NS}.condition_grade_${c}`) : t(`${NS}.condition_option_${c}`));

  if (loadingListing) {
    return (
      <div className="lx-page flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="animate-spin text-pillar-auctions" size={34} aria-label={t(`${NS}.ui.eyebrow_edit`)} />
      </div>
    );
  }

  if (published) {
    return (
      <div className="lx-page min-h-[calc(100vh-4rem)]">
        <div className="lx-bleed lx-grid pointer-events-none absolute inset-y-0 opacity-30" aria-hidden="true" />
        <div className="pointer-events-none absolute left-1/2 top-16 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-pillar-auctions/15 blur-[130px]" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1100px] px-4 pb-24 pt-28 sm:px-6">
          <Celebration listing={published.listing} path={published.path} onAnother={discardDraft} accent={ACCENT} ns={NS} />
        </div>
      </div>
    );
  }

  return (
    <div className="lx-page min-h-[calc(100vh-4rem)]">
      <div className="lx-bleed lx-grid pointer-events-none absolute inset-y-0 opacity-30" aria-hidden="true" />
      <div className="pointer-events-none absolute left-1/2 top-16 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-pillar-auctions/10 blur-[130px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 top-80 h-[380px] w-[380px] rounded-full bg-[#8b5cf6]/12 blur-[120px]" aria-hidden="true" />

      <div className="relative mx-auto max-w-[1100px] px-4 pb-24 pt-24 sm:px-6">
        {/* ── Hero ── */}
        <motion.header
          className="mb-8"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-pillar-auctions/30 bg-pillar-auctions/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-pillar-auctions">
              <Gavel size={13} aria-hidden="true" /> {editId ? t(`${NS}.ui.eyebrow_edit`) : t(`${NS}.ui.eyebrow_new`)}
            </span>
            <Link to="/my-listings" className="rounded-xl border border-white/15 px-3.5 py-1.5 text-sm font-semibold text-white/70 transition-colors hover:border-white/30 hover:text-white">
              {t(`${NS}.cancel`)}
            </Link>
          </div>
          <h1 className="mt-4 text-[clamp(2rem,6.5vw,3.6rem)] font-black leading-[1] tracking-[-0.045em] text-white [text-shadow:0_0_60px_rgba(255,90,54,0.22)]">
            {editId ? t(`${NS}.ui.hero_title_edit`) : t(`${NS}.ui.hero_title_new`)}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/60">
            {editId ? t(`${NS}.ui.hero_sub_edit`) : t(`${NS}.ui.hero_sub_new`)}
          </p>
        </motion.header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <div ref={wizardTopRef} className="scroll-mt-24 pb-1">
              <Stepper steps={STEPS} current={step} reached={reached} onSelect={setStep} accent={ACCENT} ns={NS} />
            </div>

            {stepId !== 'review' ? <PreviewBar listing={previewListing} percent={meter.percent} hint={meter.hint} accent={ACCENT} ns={NS} /> : null}

            {lookupPricing && lookupPricing.marketValue != null && step > 1 ? (
              <MarketValueHint pricing={lookupPricing} condition={form.condition} setNumber={form.setNumber} accent={ACCENT} ns={NS} />
            ) : null}

            {restoredAtStep != null ? (
              <div role="status" className="flex flex-col gap-2.5 rounded-2xl border border-pillar-auctions/25 bg-pillar-auctions/[0.06] px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
                <p className="flex items-start gap-2.5">
                  <Check size={16} className="mt-0.5 shrink-0 text-pillar-auctions" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-white">{t(`${NS}.ui.draft.restored`)}</span>{' '}
                    <span className="text-white/55">{t(`${NS}.ui.draft.photos_note`)}</span>
                  </span>
                </p>
                <button type="button" onClick={discardDraft} className="inline-flex items-center gap-1.5 self-end whitespace-nowrap text-xs font-bold text-pillar-auctions underline-offset-4 hover:underline sm:ml-auto sm:self-auto">
                  <RotateCcw size={13} aria-hidden="true" /> {t(`${NS}.ui.draft.discard`)}
                </button>
              </div>
            ) : null}

            {serverError ? (
              <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm font-semibold text-red-200">
                {serverError}
              </div>
            ) : null}

            {/* ── Wizard card ── */}
            <section className="rounded-[2rem] border border-white/10 bg-[#0d0c12]/90 p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-8">
              <div className="mb-6 flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pillar-auctions/12 text-pillar-auctions">
                  <StepIcon size={22} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-black tracking-tight text-white focus:outline-none">
                    {t(`${NS}.ui.step_title.${stepId}`)}
                  </h2>
                  <p className="mt-1 text-sm text-white/55">{t(`${NS}.ui.step_sub.${stepId}`)}</p>
                </div>
              </div>

              <motion.div
                key={stepId}
                className="space-y-6"
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* STEP 1 — what */}
                {stepId === 'what' && (
                  <>
                    <FieldGroup id={`${ID_PREFIX}-productType`} label={noStar(t(`${NS}.product_type_label`))} accent={ACCENT} ns={NS}>
                      <div className="grid grid-cols-3 gap-2.5">
                        {PRODUCT_TYPE_OPTIONS.map((pt) => (
                          <ChoiceTile
                            key={pt.id}
                            accent={ACCENT}
                            icon={pt.icon}
                            label={t(`${NS}.product_type_${pt.id}`)}
                            selected={form.productType === pt.id}
                            onClick={() => setForm((f) => changeProductType(f, pt.id))}
                          />
                        ))}
                      </div>
                    </FieldGroup>

                    {form.productType === 'tcg' && (
                      <FieldGroup id={`${ID_PREFIX}-game`} label={noStar(t(`${NS}.select_game_label`))} required error={err('game')} accent={ACCENT} ns={NS}>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                          {ANNUNCI_CARD_GAMES.map((g) => (
                            <ChoiceTile
                              key={g.slug}
                              compact
                              accent={ACCENT}
                              icon={g.emoji}
                              label={tcgGameLabel(g)}
                              selected={form.game === g.slug}
                              onClick={() => setForm((f) => selectGame(f, g.slug, g.name))}
                            />
                          ))}
                        </div>
                      </FieldGroup>
                    )}

                    {form.productType === 'tcg' && hasCatalog(form.game) && (
                      <CardCatalogPicker key={form.game} form={form} patch={patch} game={form.game} accent={ACCENT} ns={NS} idPrefix={ID_PREFIX} onPhoto={editId ? undefined : setRecognizedPhoto} />
                    )}

                    {isLego && (
                      <div className="rounded-2xl border border-pillar-auctions/15 bg-pillar-auctions/[0.04] p-4">
                        <SetLookupInput onSetFound={handleSetFound} onClear={handleLookupClear} condition={form.condition} pillar="auctions" />
                      </div>
                    )}

                    <Field id={`${ID_PREFIX}-title`} label={noStar(isLego ? t(`${NS}.title_label_lego`) : t(`${NS}.title_label_other`))} required error={err('title')} hint={t(`${NS}.ui.title_hint`)} accent={ACCENT} ns={NS}>
                      <input
                        id={`${ID_PREFIX}-title`}
                        type="text"
                        value={form.title}
                        onChange={set('title')}
                        maxLength={300}
                        autoComplete="off"
                        aria-invalid={errors.title ? true : undefined}
                        aria-describedby={errors.title ? `${ID_PREFIX}-title-err` : `${ID_PREFIX}-title-hint`}
                        placeholder={isLego ? t(`${NS}.title_placeholder_lego`) : t(`${NS}.title_placeholder_other`)}
                        className={inputCls(!!errors.title, ACCENT)}
                      />
                    </Field>

                    {isLego && (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field id={`${ID_PREFIX}-setNumber`} label={t(`${NS}.set_number_label`)} optional error={err('setNumber')} accent={ACCENT} ns={NS}>
                          <input
                            id={`${ID_PREFIX}-setNumber`}
                            type="text"
                            value={form.setNumber}
                            onChange={set('setNumber')}
                            aria-invalid={errors.setNumber ? true : undefined}
                            placeholder={t(`${NS}.set_number_placeholder`)}
                            className={inputCls(!!errors.setNumber, ACCENT)}
                          />
                        </Field>
                        {lookupPieces != null && (
                          <div className="flex flex-col justify-end pb-1">
                            <span className="text-xs text-white/45">{t(`${NS}.pieces_total_label`)}</span>
                            <span className="text-2xl font-black text-pillar-auctions">{lookupPieces.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isLego && (
                      <FieldGroup id={`${ID_PREFIX}-mainCategory`} label={noStar(t(`${NS}.main_category_label`))} required error={err('mainCategory')} accent={ACCENT} ns={NS}>
                        <div className="grid grid-cols-3 gap-2.5">
                          {MAIN_CATEGORY_OPTIONS.map((cat) => (
                            <ChoiceTile
                              key={cat.id}
                              accent={ACCENT}
                              icon={cat.icon}
                              label={t(`${NS}.category_${cat.id}`)}
                              selected={form.mainCategory === cat.id}
                              onClick={() => patch({ mainCategory: cat.id })}
                            />
                          ))}
                        </div>
                      </FieldGroup>
                    )}

                    {(isLego || form.productType === 'funko') && (
                      <div className={`grid grid-cols-1 gap-4 ${isLego ? 'sm:grid-cols-2' : ''}`}>
                        {isLego ? (
                          <Field id={`${ID_PREFIX}-category`} label={t(`${NS}.theme_label`).replace(/\s*\(.*\)\s*$/, '')} optional accent={ACCENT} ns={NS}>
                            <select id={`${ID_PREFIX}-category`} value={form.category} onChange={set('category')} className={inputCls(false, ACCENT)}>
                              {localizedCategories.map((c) => <option key={c.value === '' ? '_none' : c.value} value={c.value}>{c.label}</option>)}
                            </select>
                          </Field>
                        ) : (
                          <Field id={`${ID_PREFIX}-category`} label={t(`${NS}.series_franchise_label`).replace(/\s*\(.*\)\s*$/, '')} optional accent={ACCENT} ns={NS}>
                            <input id={`${ID_PREFIX}-category`} type="text" value={form.category} onChange={set('category')} placeholder={t(`${NS}.series_franchise_placeholder`)} className={inputCls(false, ACCENT)} />
                          </Field>
                        )}
                        {isLego && (
                          <Field id={`${ID_PREFIX}-year`} label={t(`${NS}.year_label`)} optional error={err('year')} accent={ACCENT} ns={NS}>
                            <input
                              id={`${ID_PREFIX}-year`}
                              type="number"
                              inputMode="numeric"
                              value={form.year}
                              onChange={set('year')}
                              aria-invalid={errors.year ? true : undefined}
                              placeholder={t(`${NS}.year_placeholder`)}
                              className={inputCls(!!errors.year, ACCENT)}
                            />
                          </Field>
                        )}
                      </div>
                    )}
                  </>
                )}
                {cropQueue.length > 0 && (
                  <CropEditor
                    key={`${cropQueue[0].name}|${cropQueue[0].size}|${cropQueue[0].lastModified}`}
                    file={cropQueue[0]}
                    imageOrientation={form.imageOrientation || defaultImageOrientation(form.productType)}
                    onDone={finishCrop}
                    accent={ACCENT}
                    ns={NS}
                  />
                )}

                {/* STEP 2 — photos */}
                {stepId === 'photos' && (
                  <>
                  <OrientationPicker
                    value={form.imageOrientation || defaultImageOrientation(form.productType)}
                    onChange={(imageOrientation) => patch({ imageOrientation })}
                    accent={ACCENT}
                    ns={NS}
                  />
                  {guidedCards && <CardShotGuide photoCount={files.length} shots={shots} onAdd={addPhotos} accent={ACCENT} ns={NS} />}
                  <PhotoSlots
                    previews={previews}
                    existingImages={existingImages}
                    editing={!!editId}
                    error={err('photos')}
                    notices={photoNotices}
                    max={MAX_PHOTOS}
                    shots={shots}
                    quality={photoQuality}
                    guideSeen={guideSeen}
                    onAdd={addPhotos}
                    onRemove={removePhoto}
                    onMove={movePhotoTo}
                    onCrop={(i) => setCropQueue([files[i]])}
                    onOpenGuide={openGuide}
                    accent={ACCENT}
                    ns={NS}
                    idPrefix={ID_PREFIX}
                    resolveExisting={(img) => (img.startsWith('http') ? img : `${SERVER_URL}/${img.startsWith('/') ? img.substring(1) : img}`)}
                  />
                  </>
                )}

                {/* STEP 5 — review */}
                {stepId === 'review' && (
                  <ReviewStep summary={summary} blockers={blockers} hint={meter.hint} onEdit={jumpTo} onFix={fixBlocker} accent={ACCENT} ns={NS} />
                )}

                {/* STEP 3 — condition */}
                {stepId === 'condition' && (
                  <>
                    <FieldGroup id={`${ID_PREFIX}-condition`} label={t(`${NS}.ui.condition_label`)} required error={err('condition')} accent={ACCENT} ns={NS}>
                      <div className={`grid grid-cols-2 gap-2.5 ${form.productType === 'tcg' ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
                        {conditionOptions.map((c) => (
                          <ChoiceTile
                            key={c}
                            compact
                            accent={ACCENT}
                            icon={CONDITION_ICONS[c]}
                            label={conditionLabelOf(c)}
                            selected={form.condition === c}
                            onClick={() => patch({ condition: c })}
                          />
                        ))}
                      </div>
                    </FieldGroup>

                    {form.productType === 'tcg' && <CardDetails form={form} patch={patch} err={err} accent={ACCENT} ns={NS} idPrefix={ID_PREFIX} />}

                    {isLego && (
                      <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field id={`${ID_PREFIX}-boxCondition`} label={t(`${NS}.box_condition_label`)} optional accent={ACCENT} ns={NS}>
                            <select id={`${ID_PREFIX}-boxCondition`} value={form.boxCondition} onChange={set('boxCondition')} className={inputCls(false, ACCENT)}>
                              <option value="">{t(`${NS}.select_placeholder`)}</option>
                              <option value="Mint (Perfetta)">{t(`${NS}.box_condition_mint`)}</option>
                              <option value="Damaged (Danneggiata)">{t(`${NS}.box_condition_damaged`)}</option>
                              <option value="None (Assente)">{t(`${NS}.box_condition_none`)}</option>
                            </select>
                          </Field>
                          <Field id={`${ID_PREFIX}-instructions`} label={t(`${NS}.instructions_label`)} optional accent={ACCENT} ns={NS}>
                            <select id={`${ID_PREFIX}-instructions`} value={form.instructions} onChange={set('instructions')} className={inputCls(false, ACCENT)}>
                              <option value="">{t(`${NS}.select_placeholder`)}</option>
                              <option value="Yes (Presenti)">{t(`${NS}.instructions_present`)}</option>
                              <option value="No (Assenti)">{t(`${NS}.instructions_absent`)}</option>
                              <option value="Solo PDF">{t(`${NS}.instructions_pdf_only`)}</option>
                            </select>
                          </Field>
                        </div>

                        <label className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-colors ${form.isComplete ? 'border-pillar-auctions/50 bg-pillar-auctions/[0.07]' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}>
                          <input type="checkbox" checked={form.isComplete} onChange={(e) => patch({ isComplete: e.target.checked })} className="peer sr-only" />
                          <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/15 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-pillar-auctions peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-pillar-auctions/60 motion-reduce:after:transition-none" aria-hidden="true" />
                          <span>
                            <span className="block font-bold text-white">{t(`${NS}.complete_set_label`)}</span>
                            <span className="text-[13px] text-white/55">{t(`${NS}.complete_set_desc`)}</span>
                          </span>
                        </label>
                      </>
                    )}
                  </>
                )}

                {/* STEP 4 — starting bid, duration, shipping, details */}
                {stepId === 'price' && (
                  <>
                    {bidLocked ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/40">{noStar(t(`${NS}.starting_bid_label`))}</p>
                        <p className="mt-1 text-2xl font-black text-pillar-auctions">€ {formatPrice(form.startingBid)}</p>
                        {summary.priceNote ? <p className="mt-2 text-sm text-white/60">{summary.priceNote}</p> : null}
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-white/40">
                          <Lock size={12} aria-hidden="true" /> {t(`${NS}.ui.price_locked_note`)}
                        </p>
                      </div>
                    ) : (
                      <>
                        <Field id={`${ID_PREFIX}-startingBid`} label={noStar(t(`${NS}.starting_bid_label`))} required error={err('startingBid')} hint={t(`${NS}.starting_bid_note`)} accent={ACCENT} ns={NS}>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-pillar-auctions" aria-hidden="true">€</span>
                            <input
                              id={`${ID_PREFIX}-startingBid`}
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={form.startingBid}
                              onChange={(e) => patch({ startingBid: e.target.value.replace(/[^\d.,]/g, '') })}
                              aria-invalid={errors.startingBid ? true : undefined}
                              aria-describedby={errors.startingBid ? `${ID_PREFIX}-startingBid-err` : `${ID_PREFIX}-startingBid-hint`}
                              placeholder={t(`${NS}.starting_bid_placeholder`)}
                              className={`${inputCls(!!errors.startingBid, ACCENT)} py-3.5 pl-11 text-2xl font-black`}
                            />
                          </div>
                        </Field>

                        <FieldGroup id={`${ID_PREFIX}-durationMode`} label={t(`${NS}.duration_label`)} required error={err('customEndDate')} accent={ACCENT} ns={NS}>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              role="radio"
                              aria-checked={form.durationMode === 'standard'}
                              onClick={() => patch({ durationMode: 'standard' })}
                              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${form.durationMode === 'standard' ? 'border-pillar-auctions/70 bg-pillar-auctions/[0.08]' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 text-sm font-bold text-white">
                                  <Clock size={16} className={form.durationMode === 'standard' ? 'text-pillar-auctions' : 'text-white/45'} aria-hidden="true" /> {t(`${NS}.duration_standard_title`)}
                                </span>
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${form.durationMode === 'standard' ? 'border-pillar-auctions' : 'border-white/25'}`} aria-hidden="true">
                                  {form.durationMode === 'standard' ? <span className="h-2 w-2 rounded-full bg-pillar-auctions" /> : null}
                                </span>
                              </div>
                              <p className="text-[13px] leading-relaxed text-white/55">
                                {t(`${NS}.duration_standard_desc`)}<br /><strong className="text-white/80">{standardDateFormatted}</strong>
                              </p>
                              <span className="mt-3 inline-block rounded bg-pillar-auctions/15 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-pillar-auctions">{t(`${NS}.promo_badge`)}</span>
                            </button>

                            <div
                              role="radio"
                              aria-checked={form.durationMode === 'custom'}
                              tabIndex={0}
                              onClick={() => patch({ durationMode: 'custom' })}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); patch({ durationMode: 'custom' }); } }}
                              className={`cursor-pointer rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-auctions/50 ${form.durationMode === 'custom' ? 'border-pillar-auctions/70 bg-pillar-auctions/[0.08]' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 text-sm font-bold text-white">
                                  <Calendar size={16} className={form.durationMode === 'custom' ? 'text-pillar-auctions' : 'text-white/45'} aria-hidden="true" /> {t(`${NS}.duration_custom_title`)}
                                </span>
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${form.durationMode === 'custom' ? 'border-pillar-auctions' : 'border-white/25'}`} aria-hidden="true">
                                  {form.durationMode === 'custom' ? <span className="h-2 w-2 rounded-full bg-pillar-auctions" /> : null}
                                </span>
                              </div>
                              <p className="text-[13px] leading-relaxed text-white/55">{t(`${NS}.duration_custom_desc`)}</p>
                              {form.durationMode === 'custom' ? (
                                <input
                                  id={`${ID_PREFIX}-customEndDate`}
                                  type="datetime-local"
                                  value={form.customEndDate}
                                  onChange={(e) => patch({ customEndDate: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  min={new Date().toISOString().slice(0, 16)}
                                  aria-invalid={errors.customEndDate ? true : undefined}
                                  className={`${inputCls(!!errors.customEndDate, ACCENT)} mt-3`}
                                />
                              ) : null}
                            </div>
                          </div>
                        </FieldGroup>
                      </>
                    )}

                    <FieldGroup id={`${ID_PREFIX}-shipping`} role="group" label={t(`${NS}.ui.shipping_label`)} required error={err('shipping')} hint={t(`${NS}.shipping_cost_note`)} accent={ACCENT} ns={NS}>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {CARRIERS.map((c) => {
                          const active = !!form.shippingOptions[c.id]?.selected;
                          return (
                            <label key={c.id} className={`relative flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pillar-auctions/50 ${active ? 'border-pillar-auctions/60 bg-pillar-auctions/[0.07]' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}>
                              <input type="checkbox" checked={active} onChange={(e) => toggleCarrier(c.id, e.target.checked)} className="peer sr-only" />
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${active ? 'border-pillar-auctions bg-pillar-auctions text-white' : 'border-white/25'}`} aria-hidden="true">
                                {active ? <Check size={13} strokeWidth={3.5} /> : null}
                              </span>
                              <img src={c.icon} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="h-6 w-14 shrink-0 rounded bg-white object-contain p-0.5" />
                              <span className={`text-sm font-bold ${active ? 'text-white' : 'text-white/65'}`}>{c.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </FieldGroup>

                    {form.productType !== 'tcg' && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
                        <button
                          type="button"
                          onClick={() => setDimsOpen((v) => !v)}
                          aria-expanded={dimsOpen}
                          className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-auctions/50"
                        >
                          <span className="flex items-center gap-2 text-sm font-bold text-white/80">
                            {t(`${NS}.ui.dims_toggle`)}
                            <span className="text-[11px] font-medium text-white/35">{t(`${NS}.ui.optional`)}</span>
                          </span>
                          <ChevronDown size={18} className={`text-white/50 transition-transform duration-300 motion-reduce:transition-none ${dimsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                        {dimsOpen && (
                          <div className="space-y-4 px-4 pb-4">
                            <Field id={`${ID_PREFIX}-weightKg`} label={t(`${NS}.weight_kg_label`)} error={err('weightKg')} accent={ACCENT} ns={NS}>
                              <input id={`${ID_PREFIX}-weightKg`} type="number" inputMode="decimal" step="0.01" min="0" value={form.weightKg} onChange={set('weightKg')} aria-invalid={errors.weightKg ? true : undefined} placeholder={t(`${NS}.weight_kg_placeholder`)} className={inputCls(!!errors.weightKg, ACCENT)} />
                            </Field>
                            <div>
                              <p className="mb-1.5 text-[13px] font-bold text-white/80">{t(`${NS}.dimensions_cm_label`)}</p>
                              <div className="grid grid-cols-3 gap-2.5">
                                {[['lengthCm', 'length_placeholder'], ['widthCm', 'width_placeholder'], ['heightCm', 'height_placeholder']].map(([name, ph]) => (
                                  <div key={name}>
                                    <input id={`${ID_PREFIX}-${name}`} type="number" inputMode="numeric" step="1" min="0" value={form[name]} onChange={set(name)} aria-label={t(`${NS}.${ph}`)} aria-invalid={errors[name] ? true : undefined} placeholder={t(`${NS}.${ph}`)} className={inputCls(!!errors[name], ACCENT)} />
                                    {errors[name] ? <p role="alert" className="mt-1 text-xs font-semibold text-red-300">{err(name)}</p> : null}
                                  </div>
                                ))}
                              </div>
                              <p className="mt-2 text-xs text-white/45">{t(`${NS}.dimensions_note`)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <Field id={`${ID_PREFIX}-description`} label={noStar(t(`${NS}.description_label`))} optional error={err('description')} accent={ACCENT} ns={NS}>
                      <textarea
                        id={`${ID_PREFIX}-description`}
                        rows={4}
                        value={form.description}
                        onChange={set('description')}
                        aria-invalid={errors.description ? true : undefined}
                        placeholder={t(`${NS}.description_placeholder`)}
                        className={`${inputCls(!!errors.description, ACCENT)} resize-y`}
                      />
                    </Field>

                    {isPro && (
                      <div className="rounded-2xl border border-indigo-400/30 bg-indigo-950/40 p-4">
                        <label htmlFor={`${ID_PREFIX}-proNotes`} className="mb-2 flex items-center gap-2 text-sm font-bold text-indigo-200">
                          <span className="rounded bg-yellow-400 px-1.5 py-0.5 text-[10px] font-black text-black">PRO</span>
                          {t(`${NS}.pro_notes_label`)}
                        </label>
                        <textarea id={`${ID_PREFIX}-proNotes`} rows={2} value={form.proNotes} onChange={set('proNotes')} placeholder={t(`${NS}.pro_notes_placeholder`)} className={`${inputCls(!!errors.proNotes, ACCENT)} resize-y`} />
                        {errors.proNotes ? <p role="alert" className="mt-1.5 text-xs font-semibold text-red-300">{err('proNotes')}</p> : null}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            </section>

            {/* ── Navigation ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(s - 1, 1))}
                disabled={busy}
                className={`order-last inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3.5 text-sm font-bold text-white/80 transition-colors hover:border-white/30 hover:text-white sm:order-first ${step === 1 ? 'invisible' : ''}`}
              >
                <ChevronLeft size={18} aria-hidden="true" /> {t(`${NS}.back_btn`)}
              </button>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => submit('draft')}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-5 py-3.5 text-sm font-bold text-white/85 transition-colors hover:border-white/30 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={17} aria-hidden="true" /> {t(`${NS}.save_draft_btn`)}
                </button>

                {step < TOTAL_STEPS ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="lx-shine group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-pillar-auctions px-7 py-3.5 text-[15px] font-black text-white shadow-[0_10px_30px_-10px_rgba(255,90,54,0.6)] transition-transform hover:-translate-y-0.5"
                  >
                    {step === TOTAL_STEPS - 1 ? t(`${NS}.ui.review_btn`) : t(`${NS}.next_btn`)} <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => submit('publish')}
                    disabled={busy}
                    className="lx-shine relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-br from-gold-300 via-gold-400 to-gold-600 px-7 py-3.5 text-[15px] font-black text-[#100d07] shadow-[0_10px_30px_-8px_rgba(212,175,55,0.55)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : null}
                    {busy ? (editId ? t(`${NS}.updating`) : t(`${NS}.publishing`)) : editId ? t(`${NS}.update_auction_btn`) : t(`${NS}.create_auction_btn`)}
                  </button>
                )}
              </div>
            </div>

            <p aria-live="polite" className="flex h-5 items-center justify-end gap-1.5 text-xs font-medium text-white/40">
              {savedFlash ? <><Check size={13} className="text-pillar-auctions" aria-hidden="true" /> {t(`${NS}.ui.draft.saved`)}</> : null}
            </p>
          </div>

          <PreviewPanel listing={previewListing} percent={meter.percent} hint={meter.hint} accent={ACCENT} ns={NS} />
        </div>
      </div>

      <PhotoGuide open={guideOpen} onClose={closeGuide} shots={shots} accent={ACCENT} ns={NS} idPrefix={ID_PREFIX} />
    </div>
  );
}
