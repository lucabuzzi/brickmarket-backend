import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LISTING_ENDPOINTS, apiPostForm, apiFetch, SERVER_URL } from '../api';
import { useAuth } from '../auth/useAuth';
import { Camera, CheckCircle, Package, Edit, ChevronRight, ChevronLeft, Save, Loader, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import SetLookupInput from '../components/SetLookupInput';
import { ANNUNCI_CARD_GAMES, getAnnunciCardGame } from '../config/annunciCategories';

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

export const CARRIERS = [
  { id: 'DHL', name: 'DHL Express', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/DHL_Logo.svg' },
  { id: 'BRT', name: 'BRT Corriere', icon: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Brt_logo.svg' },
  { id: 'UPS', name: 'UPS', icon: 'https://upload.wikimedia.org/wikipedia/commons/1/18/UPS_Logo_2014.svg' },
  { id: 'SDA', name: 'SDA', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/SDA_Express_Courier_logo.svg' },
  { id: 'POSTE', name: 'Poste Italiane', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Poste_Italiane_logo_2015.svg/120px-Poste_Italiane_logo_2015.svg.png' },
];

export default function Sell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { user } = useAuth();
  
  const isPro = user?.role === 'professional' || user?.role_name === 'professional' || user?.is_pro || user?.seller_type === 'professional';

  // Wizard State
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Form State
  const [productType, setProductType] = useState('lego'); // lego | funko | tcg
  const [game, setGame] = useState(''); // only when productType === 'tcg'
  const [title, setTitle] = useState('');
  const [setNumber, setSetNumber] = useState('');
  const [mainCategory, setMainCategory] = useState(''); // mandatory: sets, mocs, minifigures (LEGO only)
  const [category, setCategory] = useState(''); // this is "theme" in DB — LEGO theme select / Funko free text / TCG auto-filled
  const [year, setYear] = useState('');

  const isLego = productType === 'lego';

  // TCG: auto-fill the generic "theme" field with the selected game's display name
  useEffect(() => {
    if (productType === 'tcg' && game) {
      const g = getAnnunciCardGame(game);
      if (g) setCategory(g.name);
    }
  }, [productType, game]);
  
  const [condition, setCondition] = useState('');
  const [boxCondition, setBoxCondition] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  const [price, setPrice] = useState('');
  const [shippingOptions, setShippingOptions] = useState({});
  const [packageSize, setPackageSize] = useState('medium');
  const [description, setDescription] = useState('');
  const [proNotes, setProNotes] = useState('');
  
  const [files, setFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  
  // UI States
  const [busy, setBusy] = useState(false);
  const [loadingListing, setLoadingListing] = useState(!!editId);
  const [error, setError] = useState('');
  const [lookupPieces, setLookupPieces] = useState(null);
  const [lookupPricing, setLookupPricing] = useState(null); // pricing from Rebrickable lookup

  const handleSetFound = (setData) => {
    if (setData.name) setTitle(setData.name);
    if (setData.set_num) setSetNumber(setData.set_num);
    if (setData.year) setYear(String(setData.year));
    if (setData.num_parts) setLookupPieces(setData.num_parts);
    if (setData.pricing) setLookupPricing(setData.pricing);
  };

  const handleLookupClear = () => {
    setLookupPieces(null);
    setLookupPricing(null);
  };

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files]
  );

  const localizedCategories = useMemo(
    () => CATEGORIES.map((c) => ({
      ...c,
      label: c.value === '' ? t('sell.category_placeholder') : c.value === 'Altro' ? t('sell.category_other') : c.label,
    })),
    [t]
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  // Hydrate form if in edit mode
  useEffect(() => {
    if (!editId) return;

    const fetchListing = async () => {
      try {
        setLoadingListing(true);
        const data = await apiFetch(`/api/listings/${editId}`);
        setProductType(data.product_type || 'lego');
        setGame(data.game || '');
        setTitle(data.title || '');
        setSetNumber(data.set_number || '');
        setMainCategory(data.category || 'sets');
        setCategory(data.theme || '');
        setYear(data.year || '');
        
        const c = (data.condition || '').toLowerCase();
        if (c === 'new' || c === 'sealed') setCondition('new');
        else if (c === 'complete') setCondition('complete');
        else if (c === 'parts') setCondition('parts');
        else setCondition('used');

        setBoxCondition(data.box_condition || '');
        setInstructions(data.instructions || '');
        setIsComplete(!!data.is_complete);
        setPrice(data.price || '');
        
        const existingShipping = {};
        if (data.shipping_options && Array.isArray(data.shipping_options)) {
          data.shipping_options.forEach(opt => {
             existingShipping[opt.carrier] = { selected: true, price: opt.cost };
          });
        }
        setShippingOptions(existingShipping);
        setPackageSize(data.package_size || 'medium');

        setDescription(data.description || '');
        setProNotes(data.pro_notes || '');
        setExistingImages(data.images || []);
      } catch (err) {
        setError(t('sell.error_load_listing'));
      } finally {
        setLoadingListing(false);
      }
    };

    fetchListing();
  }, [editId, t]);

  function onFilesChange(e) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles(list.slice(0, 5));
  }

  function removeFileAt(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!title) {
        setError(t('sell.error_title_required'));
        return;
      }
      if (isLego && !mainCategory) {
        setError(t('sell.error_title_category_required'));
        return;
      }
      if (productType === 'tcg' && !game) {
        setError(t('sell.error_select_game'));
        return;
      }
    }
    if (step === 2 && !condition) {
      setError(t('sell.error_condition_required'));
      return;
    }
    if (step === 3) {
      if (!price) {
        setError(t('sell.error_price_required'));
        return;
      }
      const selectedShippings = Object.values(shippingOptions).filter(o => o.selected);
      if (selectedShippings.length === 0) {
        setError(t('sell.error_shipping_required'));
        return;
      }
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };
  
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  async function submit(mode) {
    setError('');
    const p = parseFloat(String(price).replace(',', '.'));
    
    if (!editId && mode === 'publish' && files.length === 0) {
      setError(t('sell.error_photo_required'));
      return;
    }

    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('productType', productType);
    if (productType === 'tcg' && game) fd.append('game', game);
    if (isLego && setNumber) fd.append('setNumber', setNumber.trim());
    fd.append('category', isLego ? mainCategory : 'sets');
    if (category) fd.append('theme', category);
    if (isLego && year) fd.append('year', year);

    const conditionMap = { 'new': 'new', 'used': 'used', 'complete': 'complete', 'parts': 'parts' };
    const mappedType = condition === 'new' ? 'sealed' : 'used';
    fd.append('type', mappedType);
    fd.append('condition', conditionMap[condition] || 'used');
    if (isLego && boxCondition) fd.append('boxCondition', boxCondition);
    if (isLego && instructions) fd.append('instructions', instructions);
    if (isLego) fd.append('isComplete', String(isComplete));

    if (description) fd.append('description', description.trim());
    if (isPro && proNotes) fd.append('proNotes', proNotes.trim());
    
    const activeShipping = Object.entries(shippingOptions)
      .filter(([_, o]) => o.selected)
      .map(([id, o]) => ({ carrier: id }));
    fd.append('shippingOptions', JSON.stringify(activeShipping));
    
    fd.append('packageSize', packageSize);
    fd.append('shippingCost', '0');
    
    if (!Number.isNaN(p) && p > 0) fd.append('price', String(p));
    fd.append('status', mode === 'draft' ? 'draft' : 'active');

    files.forEach((f) => fd.append('images', f));

    setBusy(true);
    try {
      if (editId) {
        // Direct PATCH with FormData
        const token = localStorage.getItem('brickmarket_token');
        const res = await fetch(`${SERVER_URL}/api/listings/${editId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || t('sell.error_update_generic'));
        }
      } else {
        await apiPostForm(LISTING_ENDPOINTS.create, fd);
      }
      navigate('/my-listings', { replace: true });
    } catch (e) {
      setError(e.message || t('sell.error_generic_operation'));
    } finally {
      setBusy(false);
    }
  }

  if (loadingListing) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader className="animate-spin" size={32} color="#d4af37" />
      </div>
    );
  }

  const renderStepIcon = (index, current, IconComponent) => {
    const isActive = index === current;
    const isPast = index < current;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', opacity: isActive || isPast ? 1 : 0.4 }}>
        <div style={{ 
          width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          backgroundColor: isPast ? '#059669' : isActive ? '#d4af37' : '#44403c',
          color: isActive || isPast ? '#fff' : '#a8a29e',
          border: isActive ? '2px solid #eed690' : 'none'
        }}>
          {isPast ? <CheckCircle size={20} /> : <IconComponent size={20} />}
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 'bold' : 'normal', color: isActive ? '#eed690' : '#a8a29e' }}>
          {[t('sell.step_label_info'), t('sell.step_label_condition'), t('sell.step_label_details'), t('sell.step_label_photos')][index - 1]}
        </span>
      </div>
    );
  };

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      
      <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: '2rem' }}>
        <h1 className="text-2xl sm:text-3xl" style={{ fontWeight: '800', margin: 0, color: '#f8fafc' }}>
          {editId ? t('sell.title_edit') : t('sell.title_new')}
        </h1>
        <Link to="/my-listings" style={{
          padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #57534e', color: '#d6d3d1', textDecoration: 'none', fontSize: '0.9rem', transition: 'all 0.2s'
        }}>
          {t('sell.cancel')}
        </Link>
      </div>

      {/* Progress Bar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: '3rem', padding: '0 1rem' }}>
        <div style={{ position: 'absolute', top: '20px', left: '10%', right: '10%', height: '2px', backgroundColor: '#44403c', zIndex: 0 }}>
          <div style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%`, height: '100%', backgroundColor: '#059669', transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ zIndex: 1, position: 'relative' }}>{renderStepIcon(1, step, Edit)}</div>
        <div style={{ zIndex: 1, position: 'relative' }}>{renderStepIcon(2, step, Package)}</div>
        <div style={{ zIndex: 1, position: 'relative' }}>{renderStepIcon(3, step, Edit)}</div>
        <div style={{ zIndex: 1, position: 'relative' }}>{renderStepIcon(4, step, Camera)}</div>
      </div>

      {/* ── Floating Price Pill ── visible on steps 2-4 when a set has been looked up */}
      {lookupPricing && lookupPricing.marketValue != null && step > 1 && (() => {
        const condKey = condition && ['new','used','complete','parts'].includes(condition) ? condition : 'used';
        const condMultipliers = lookupPricing.conditionMultipliers || { new: 1, used: 0.65, complete: 0.55, parts: 0.30 };
        const mult = condMultipliers[condKey] ?? 0.65;
        const adjusted = Math.round(lookupPricing.marketValue * mult);
        const condLabels = {
          new: t('sell.pricing_cond_new'),
          used: t('sell.pricing_cond_used'),
          complete: t('sell.pricing_cond_complete'),
          parts: t('sell.pricing_cond_parts'),
        };
        const appPct = lookupPricing.appreciationPct;
        const TIcon = appPct >= 15 ? TrendingUp : appPct < 0 ? TrendingDown : Minus;
        const tColor = appPct >= 50 ? '#10b981' : appPct >= 15 ? '#d4af37' : appPct < 0 ? '#f87171' : '#78716c';

        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            marginBottom: '1.25rem',
            padding: '0.75rem 1.25rem',
            backgroundColor: 'rgba(12, 10, 8,0.95)',
            border: `1px solid ${lookupPricing.isTrending ? 'rgba(16,185,129,0.35)' : 'rgba(212,175,55,0.2)'}`,
            borderRadius: '12px',
            backdropFilter: 'blur(12px)',
            boxShadow: lookupPricing.isTrending
              ? '0 0 24px rgba(16,185,129,0.1), inset 0 1px 0 rgba(255,255,255,0.04)'
              : '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
            animation: 'fadeIn 0.4s ease',
          }}>
            {/* Zap icon */}
            <div style={{
              width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
              backgroundColor: lookupPricing.isTrending ? 'rgba(16,185,129,0.12)' : 'rgba(212,175,55,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={16} color={lookupPricing.isTrending ? '#10b981' : '#d4af37'} />
            </div>

            {/* Label */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.08em', color: '#57534e', textTransform: 'uppercase', marginBottom: '0.1rem' }}>
                {t('sell.market_value_estimated')}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#78716c' }}>
                {setNumber || t('sell.set_fallback')} · <span style={{ color: '#a8a29e' }}>{condLabels[condKey]}</span>
              </div>
            </div>

            {/* Trend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
              <TIcon size={13} color={tColor} />
              <span style={{ fontSize: '0.7rem', color: tColor, fontWeight: '600' }}>
                {appPct != null ? (appPct >= 0 ? `+${appPct}%` : `${appPct}%`) : ''}
              </span>
            </div>

            {/* Price */}
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '900', color: '#f8fafc', letterSpacing: '-0.02em', lineHeight: 1 }}>
                €{adjusted.toLocaleString('it-IT')}
              </div>
              <div style={{ fontSize: '0.6rem', color: '#57534e', marginTop: '0.1rem' }}>
                €{Math.round(lookupPricing.low * mult).toLocaleString('it-IT')} – €{Math.round(lookupPricing.high * mult).toLocaleString('it-IT')}
              </div>
            </div>
          </div>
        );
      })()}

      {error && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '8px', color: '#fca5a5', fontWeight: '500' }}>
          {error}
        </div>
      )}

      {/* Form Wizard Container */}
      <div style={{ backgroundColor: '#120f0a', padding: '2.5rem', borderRadius: '16px', border: '1px solid #292524', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
        
        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#d4af37', fontSize: '1.4rem' }}>{t('sell.step1_heading')}</h2>

            {/* ── Tipo Prodotto ── */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem', fontWeight: 'bold' }}>{t('sell.product_type_label')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem' }}>
                {PRODUCT_TYPE_OPTIONS.map(pt => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => { setProductType(pt.id); if (pt.id !== 'tcg') setGame(''); if (pt.id !== 'lego') { setMainCategory(''); setSetNumber(''); setYear(''); } if (pt.id !== 'tcg') setCategory(''); }}
                    style={{
                      padding: '1rem 0.5rem',
                      borderRadius: '12px',
                      border: '2px solid',
                      borderColor: productType === pt.id ? '#d4af37' : '#44403c',
                      backgroundColor: productType === pt.id ? '#0c4a6e' : '#292524',
                      color: productType === pt.id ? '#fff' : '#a8a29e',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{pt.icon}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{t(`sell.product_type_${pt.id}`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Selezione Gioco (solo Carte Collezionabili) ── */}
            {productType === 'tcg' && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem', fontWeight: 'bold' }}>{t('sell.select_game_label')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                  {ANNUNCI_CARD_GAMES.map(g => (
                    <button
                      key={g.slug}
                      type="button"
                      onClick={() => setGame(g.slug)}
                      style={{
                        padding: '0.75rem 0.4rem',
                        borderRadius: '10px',
                        border: '2px solid',
                        borderColor: game === g.slug ? '#d4af37' : '#44403c',
                        backgroundColor: game === g.slug ? '#0c4a6e' : '#292524',
                        color: game === g.slug ? '#fff' : '#a8a29e',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.3rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontSize: '1.3rem' }}>{g.emoji}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 'bold', textAlign: 'center' }}>{g.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Rebrickable Set Lookup (solo LEGO) ── */}
            {!editId && isLego && (
              <div style={{ padding: '1rem 1.25rem', backgroundColor: 'rgba(191,154,46,0.06)', border: '1px solid rgba(191,154,46,0.2)', borderRadius: '12px' }}>
                <SetLookupInput
                  onSetFound={handleSetFound}
                  onClear={handleLookupClear}
                  condition={condition}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{isLego ? t('sell.title_label_lego') : t('sell.title_label_other')}</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isLego ? t('sell.title_placeholder_lego') : t('sell.title_placeholder_other')}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }} />
            </div>

            {isLego && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.set_number_label')}</label>
                  <input type="text" value={setNumber} onChange={(e) => setSetNumber(e.target.value)} placeholder={t('sell.set_number_placeholder')}
                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }} />
                </div>
                <div>
                  {lookupPieces != null && (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#78716c', marginBottom: '0.25rem' }}>{t('sell.pieces_total_label')}</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#d4af37' }}>{lookupPieces.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isLego && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem', fontWeight: 'bold' }}>{t('sell.main_category_label')}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem', marginBottom: '1rem' }}>
                  {MAIN_CATEGORY_OPTIONS.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setMainCategory(cat.id)}
                      style={{
                        padding: '1rem 0.5rem',
                        borderRadius: '12px',
                        border: '2px solid',
                        borderColor: mainCategory === cat.id ? '#d4af37' : '#44403c',
                        backgroundColor: mainCategory === cat.id ? '#0c4a6e' : '#292524',
                        color: mainCategory === cat.id ? '#fff' : '#a8a29e',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{t(`sell.category_${cat.id}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: isLego ? '1fr 1fr' : '1fr', gap: '1rem' }}>
              {isLego ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.theme_label')}</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }}>
                    {localizedCategories.map((c) => <option key={c.value === '' ? '_none' : c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              ) : productType === 'funko' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.series_franchise_label')}</label>
                  <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('sell.series_franchise_placeholder')}
                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }} />
                </div>
              ) : null}
              {isLego && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.year_label')}</label>
                  <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder={t('sell.year_placeholder')}
                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#d4af37', fontSize: '1.4rem' }}>{t('sell.step2_heading')}</h2>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.condition_label')}</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }}>
                <option value="">{t('sell.select_placeholder')}</option>
                <option value="new">{t('sell.condition_option_new')}</option>
                <option value="used">{t('sell.condition_option_used')}</option>
                <option value="complete">{t('sell.condition_option_complete')}</option>
                <option value="parts">{t('sell.condition_option_parts')}</option>
              </select>
            </div>

            {isLego && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.box_condition_label')}</label>
                    <select value={boxCondition} onChange={(e) => setBoxCondition(e.target.value)}
                      style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }}>
                      <option value="">{t('sell.select_placeholder')}</option>
                      <option value="Mint (Perfetta)">{t('sell.box_condition_mint')}</option>
                      <option value="Damaged (Danneggiata)">{t('sell.box_condition_damaged')}</option>
                      <option value="None (Assente)">{t('sell.box_condition_none')}</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.instructions_label')}</label>
                    <select value={instructions} onChange={(e) => setInstructions(e.target.value)}
                      style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }}>
                      <option value="">{t('sell.select_placeholder')}</option>
                      <option value="Yes (Presenti)">{t('sell.instructions_present')}</option>
                      <option value="No (Assenti)">{t('sell.instructions_absent')}</option>
                      <option value="Solo PDF">{t('sell.instructions_pdf_only')}</option>
                    </select>
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.5rem', padding: '1rem', backgroundColor: '#292524', borderRadius: '8px', border: '1px solid #44403c', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isComplete} onChange={(e) => setIsComplete(e.target.checked)} style={{ width: '1.2rem', height: '1.2rem', accentColor: '#d4af37' }} />
                  <div>
                    <span style={{ color: '#f8fafc', fontWeight: 'bold', display: 'block' }}>{t('sell.complete_set_label')}</span>
                    <span style={{ color: '#a8a29e', fontSize: '0.8rem' }}>{t('sell.complete_set_desc')}</span>
                  </div>
                </label>
              </>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#d4af37', fontSize: '1.4rem' }}>{t('sell.step3_heading')}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.price_label')}</label>
                <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('sell.price_placeholder')}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #d4af37', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.shipping_methods_label')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {CARRIERS.map(c => {
                  const isActive = shippingOptions[c.id]?.selected;
                  
                  return (
                    <div 
                      key={c.id} 
                      style={{ 
                        border: isActive ? '2px solid #d4af37' : '1px solid #44403c', 
                        borderRadius: '12px', 
                        padding: '1rem', 
                        backgroundColor: isActive ? 'rgba(212,175,55,0.05)' : '#292524',
                        transition: 'all 0.2s',
                        display: 'flex', flexDirection: 'column', gap: '0.8rem'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={!!isActive} 
                          onChange={(e) => setShippingOptions(prev => ({ 
                            ...prev, 
                            [c.id]: { ...prev[c.id], selected: e.target.checked } 
                          }))}
                          style={{ width: '1.2rem', height: '1.2rem', accentColor: '#d4af37' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <img src={c.icon} alt={c.name} style={{ height: '20px', width: 'auto', maxWidth: '40px', objectFit: 'contain', backgroundColor: '#fff', padding: '2px', borderRadius: '4px' }} />
                          <span style={{ color: isActive ? '#fff' : '#a8a29e', fontWeight: 'bold', fontSize: '0.9rem' }}>{c.name}</span>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
              <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#78716c', fontStyle: 'italic' }}>
                {t('sell.shipping_cost_note')}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.package_size_label')}</label>
                <select value={packageSize} onChange={(e) => setPackageSize(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }}>
                  <option value="small">{t('sell.package_size_small')}</option>
                  <option value="medium">{t('sell.package_size_medium')}</option>
                  <option value="large">{t('sell.package_size_large')}</option>
                </select>
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#78716c' }}>
                  {t('sell.package_size_note')}
                </p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('sell.description_label')}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('sell.description_placeholder')} rows={4}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '0.95rem', resize: 'vertical' }} />
            </div>

            {isPro && (
               <div style={{ padding: '1rem', backgroundColor: '#1e1b4b', border: '1px solid #4338ca', borderRadius: '8px' }}>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#a5b4fc', fontSize: '0.9rem', fontWeight: 'bold' }}>
                   <span style={{ backgroundColor: '#eab308', color: '#000', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.65rem' }}>PRO</span>
                   {t('sell.pro_notes_label')}
                 </label>
                 <textarea value={proNotes} onChange={(e) => setProNotes(e.target.value)} placeholder={t('sell.pro_notes_placeholder')} rows={2}
                   style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#312e81', border: 'none', color: '#e0e7ff', fontSize: '0.9rem', resize: 'vertical' }} />
               </div>
            )}

          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#d4af37', fontSize: '1.4rem' }}>{t('sell.step4_heading')}</h2>

            <div style={{ border: '2px dashed #57534e', borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', backgroundColor: '#292524', position: 'relative' }}>
              <Camera size={40} color="#a8a29e" style={{ margin: '0 auto 1rem auto' }} />
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#f8fafc', fontSize: '1.1rem', fontWeight: '600' }}>{t('sell.upload_dropzone_title')}</label>
              <p style={{ color: '#a8a29e', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{t('sell.upload_dropzone_desc')}</p>

              <input type="file" id="file-upload" accept="image/*" multiple onChange={onFilesChange} style={{ display: 'none' }} />
              <button type="button" onClick={() => document.getElementById('file-upload').click()}
                style={{ backgroundColor: '#a17e22', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background-color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#0369a1'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#a17e22'}>
                 {editId ? t('sell.upload_btn_new_photos') : t('sell.upload_btn_browse')}
              </button>
            </div>

            {editId && existingImages.length > 0 && files.length === 0 && (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ color: '#a8a29e', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{t('sell.existing_images_label')}</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                   {existingImages.map((img, i) => (
                     <div key={i} style={{ width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #44403c' }}>
                       <img src={img.startsWith('http') ? img : `${SERVER_URL}/${img.startsWith('/') ? img.substring(1) : img}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                     </div>
                   ))}
                </div>
              </div>
            )}

            {previews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4" style={{ marginTop: '1rem' }}>
                {previews.map((p, i) => (
                  <div key={p.url} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: i === 0 ? '3px solid #d4af37' : '1px solid #44403c' }}>
                    {i === 0 && <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(212,175,55,0.9)', color: '#000', fontSize: '0.6rem', fontWeight: 'bold', textAlign: 'center', padding: '0.1rem 0' }}>{t('sell.cover_badge')}</span>}
                    <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button type="button" onClick={() => removeFileAt(i)} style={{ position: 'absolute', right: '4px', top: '4px', backgroundColor: '#dc2626', color: '#fff', border: 'none', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Navigation Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-8">
        <button type="button" onClick={prevStep} disabled={step === 1 || busy} className="w-full sm:w-auto justify-center" style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.5rem', borderRadius: '8px', backgroundColor: 'transparent', border: '1px solid #57534e', color: '#e7e5e4', cursor: step === 1 ? 'not-allowed' : 'pointer', opacity: step === 1 ? 0 : 1
        }}>
          <ChevronLeft size={18} /> {t('sell.back_btn')}
        </button>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {step === totalSteps && (
            <button type="button" onClick={() => submit('draft')} disabled={busy} className="w-full sm:w-auto justify-center" style={{
              padding: '0.8rem 1.5rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #78716c', color: '#d6d3d1', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <Save size={18} /> {t('sell.save_draft_btn')}
            </button>
          )}

          {step < totalSteps ? (
            <button type="button" onClick={nextStep} className="w-full sm:w-auto justify-center" style={{
              padding: '0.8rem 2rem', borderRadius: '8px', backgroundColor: '#d4af37', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(212,175,55, 0.3)'
            }}>
              {t('sell.next_btn')} <ChevronRight size={18} />
            </button>
          ) : (
            <button type="button" onClick={() => submit('publish')} disabled={busy} className="w-full sm:w-auto justify-center" style={{
              padding: '0.8rem 2rem', borderRadius: '8px', backgroundColor: '#10b981', border: 'none', color: '#fff', fontWeight: 'bold', cursor: busy ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)', display: 'flex', alignItems: 'center'
            }}>
              {busy ? (editId ? t('sell.updating') : t('sell.publishing')) : (editId ? t('sell.update_listing_btn') : t('sell.publish_now_btn'))}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
