import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LISTING_ENDPOINTS, apiPostForm, SERVER_URL } from '../api';
import { useAuth } from '../auth/useAuth';
import { Camera, CheckCircle, Edit, ChevronRight, ChevronLeft, Save, Gavel, Clock } from 'lucide-react';
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

export default function CreateAuction() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPro = user?.role === 'professional' || user?.role_name === 'professional' || user?.is_pro || user?.seller_type === 'professional';

  // Wizard State
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Form State - Info
  const [productType, setProductType] = useState('lego'); // lego | funko | tcg
  const [game, setGame] = useState(''); // only when productType === 'tcg'
  const [title, setTitle] = useState('');
  const [setNumber, setSetNumber] = useState('');
  const [mainCategory, setMainCategory] = useState('');
  const [category, setCategory] = useState('');
  const [year, setYear] = useState('');
  const [condition, setCondition] = useState('');

  const isLego = productType === 'lego';

  // TCG: auto-fill the generic "theme" field with the selected game's display name
  useEffect(() => {
    if (productType === 'tcg' && game) {
      const g = getAnnunciCardGame(game);
      if (g) setCategory(g.name);
    }
  }, [productType, game]);

  // Lookup state (from SetLookupInput)
  const [lookupPieces, setLookupPieces] = useState(null);

  const handleSetFound = (setData) => {
    if (setData.name) setTitle(setData.name);
    if (setData.set_num) setSetNumber(setData.set_num);
    if (setData.year) setYear(String(setData.year));
    if (setData.num_parts) setLookupPieces(setData.num_parts);
  };

  const handleLookupClear = () => {
    setLookupPieces(null);
  };

  // Form State - Auction Details
  const [startingBid, setStartingBid] = useState('');
  const [description, setDescription] = useState('');
  const [durationMode, setDurationMode] = useState('standard'); // 'standard' | 'custom'
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Photos
  const [files, setFiles] = useState([]);
  
  // UI States
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files]
  );

  const localizedCategories = useMemo(
    () => CATEGORIES.map((c) => ({
      ...c,
      label: c.value === '' ? t('create_auction.category_placeholder') : c.value === 'Altro' ? t('create_auction.category_other') : c.label,
    })),
    [t]
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const standardDateObj = new Date();
  standardDateObj.setDate(standardDateObj.getDate() + 7);
  const standardDateFormatted = standardDateObj.toLocaleString(i18n.language, {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  });

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
      if (!title || !condition) {
        setError(t('create_auction.error_title_condition_required'));
        return;
      }
      if (isLego && !mainCategory) {
        setError(t('create_auction.error_title_category_condition_required'));
        return;
      }
      if (productType === 'tcg' && !game) {
        setError(t('create_auction.error_select_game'));
        return;
      }
    }
    if (step === 2) {
      if (!startingBid) {
        setError(t('create_auction.error_starting_bid_required'));
        return;
      }
      if (durationMode === 'custom' && !customEndDate) {
        setError(t('create_auction.error_custom_end_date_required'));
        return;
      }
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };
  
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  async function submit(mode) {
    setError('');
    

    if (durationMode === 'custom') {
      /* Next step: block if tokens < 1 */
    }

    const p = parseFloat(String(startingBid).replace(',', '.'));
    
    if (mode === 'publish' && files.length === 0) {
      setError(t('create_auction.error_photo_required'));
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
    fd.append('type', 'auction'); // Auction specific
    fd.append('is_auction', 'true'); // Flag for backend compatibility
    fd.append('condition', conditionMap[condition] || 'used');

    if (description) fd.append('description', description.trim());
    
    // Auction-specific fields — must match backend Joi schema keys exactly
    if (!Number.isNaN(p) && p > 0) fd.append('auctionStart', String(p)); // starting bid
    fd.append('status', mode === 'draft' ? 'draft' : 'active');

    // Required fields for backend validation
    fd.append('packageSize', 'medium');       // default package size for auctions

    // Handle end date — key must be 'auctionEnd' to match Joi schema
    let auctionEndDate;
    if (durationMode === 'standard') {
      auctionEndDate = standardDateObj.toISOString();
    } else {
      auctionEndDate = new Date(customEndDate).toISOString();
    }
    fd.append('auctionEnd', auctionEndDate);

    files.forEach((f) => fd.append('images', f));

    setBusy(true);
    try {
      await apiPostForm(LISTING_ENDPOINTS.create, fd);
      navigate('/my-listings', { replace: true });
    } catch (e) {
      setError(e.message || t('create_auction.error_generic'));
    } finally {
      setBusy(false);
    }
  }

  const renderStepIcon = (index, current, IconComponent) => {
    const isActive = index === current;
    const isPast = index < current;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', opacity: isActive || isPast ? 1 : 0.4 }}>
        <div style={{ 
          width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          backgroundColor: isPast ? '#059669' : isActive ? '#bf9a2e' : '#44403c',
          color: isActive || isPast ? '#fff' : '#a8a29e',
          border: isActive ? '2px solid #fde68a' : 'none'
        }}>
          {isPast ? <CheckCircle size={20} /> : <IconComponent size={20} />}
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 'bold' : 'normal', color: isActive ? '#fcd34d' : '#a8a29e' }}>
          {[t('create_auction.step_label_info'), t('create_auction.step_label_auction_details'), t('create_auction.step_label_photos')][index - 1]}
        </span>
      </div>
    );
  };

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem', paddingTop: '6rem' }}>
      
      <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: '2rem' }}>
        <h1 className="text-2xl sm:text-3xl" style={{ fontWeight: '900', margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gavel className="text-gold-500" size={32} /> {t('create_auction.page_title')}
        </h1>
        <Link to="/my-listings" style={{
          padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #57534e', color: '#d6d3d1', textDecoration: 'none', fontSize: '0.9rem', transition: 'all 0.2s'
        }}>
          {t('create_auction.cancel')}
        </Link>
      </div>

      {/* Progress Bar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: '3rem', padding: '0 2rem' }}>
        <div style={{ position: 'absolute', top: '20px', left: '15%', right: '15%', height: '2px', backgroundColor: '#44403c', zIndex: 0 }}>
          <div style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%`, height: '100%', backgroundColor: '#059669', transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ zIndex: 1, position: 'relative' }}>{renderStepIcon(1, step, Edit)}</div>
        <div style={{ zIndex: 1, position: 'relative' }}>{renderStepIcon(2, step, Gavel)}</div>
        <div style={{ zIndex: 1, position: 'relative' }}>{renderStepIcon(3, step, Camera)}</div>
      </div>

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
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#bf9a2e', fontSize: '1.4rem' }}>{t('create_auction.step1_heading')}</h2>

            {/* ── Tipo Prodotto ── */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem', fontWeight: 'bold' }}>{t('create_auction.product_type_label')}</label>
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
                      borderColor: productType === pt.id ? '#bf9a2e' : '#44403c',
                      backgroundColor: productType === pt.id ? '#78350f' : '#292524',
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
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{t(`create_auction.product_type_${pt.id}`)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Selezione Gioco (solo Carte Collezionabili) ── */}
            {productType === 'tcg' && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem', fontWeight: 'bold' }}>{t('create_auction.select_game_label')}</label>
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
                        borderColor: game === g.slug ? '#bf9a2e' : '#44403c',
                        backgroundColor: game === g.slug ? '#78350f' : '#292524',
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

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{isLego ? t('create_auction.title_label_lego') : t('create_auction.title_label_other')}</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isLego ? t('create_auction.title_placeholder_lego') : t('create_auction.title_placeholder_other')}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }} />
            </div>

            {/* ── Rebrickable Set Lookup (solo LEGO) ── */}
            {isLego && (
              <div style={{ padding: '1rem 1.25rem', backgroundColor: 'rgba(191,154,46,0.06)', border: '1px solid rgba(191,154,46,0.2)', borderRadius: '12px' }}>
                <SetLookupInput
                  onSetFound={handleSetFound}
                  onClear={handleLookupClear}
                  condition={condition}
                />
              </div>
            )}

            {isLego && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('create_auction.set_number_label')}</label>
                  <input type="text" value={setNumber} onChange={(e) => setSetNumber(e.target.value)} placeholder={t('create_auction.set_number_placeholder')}
                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }} />
                </div>
                <div>
                  {lookupPieces != null && (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#78716c', marginBottom: '0.25rem' }}>{t('create_auction.pieces_total_label')}</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#bf9a2e' }}>{lookupPieces.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('create_auction.condition_label')}</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }}>
                <option value="">{t('create_auction.select_placeholder')}</option>
                <option value="new">{t('create_auction.condition_option_new')}</option>
                <option value="used">{t('create_auction.condition_option_used')}</option>
                <option value="complete">{t('create_auction.condition_option_complete')}</option>
                <option value="parts">{t('create_auction.condition_option_parts')}</option>
              </select>
            </div>

            {isLego && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem', fontWeight: 'bold' }}>{t('create_auction.main_category_label')}</label>
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
                        borderColor: mainCategory === cat.id ? '#bf9a2e' : '#44403c',
                        backgroundColor: mainCategory === cat.id ? '#78350f' : '#292524',
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
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{t(`create_auction.category_${cat.id}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLego ? (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('create_auction.theme_label')}</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }}>
                  {localizedCategories.map((c) => <option key={c.value === '' ? '_none' : c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            ) : productType === 'funko' ? (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('create_auction.series_franchise_label')}</label>
                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('create_auction.series_franchise_placeholder')}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '1rem' }} />
              </div>
            ) : null}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#bf9a2e', fontSize: '1.4rem' }}>{t('create_auction.step2_heading')}</h2>

            {/* Durata Asta */}
            <div className="bg-stone-800/50 p-4 rounded-xl border border-stone-700">
              <label style={{ display: 'block', marginBottom: '1rem', color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}>{t('create_auction.duration_label')}</label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Standard Mode */}
                <div
                  onClick={() => setDurationMode('standard')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${durationMode === 'standard' ? 'border-emerald-500 bg-emerald-900/20' : 'border-stone-700 bg-stone-800'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-white flex items-center gap-2">
                      <Clock size={16} className={durationMode === 'standard' ? 'text-emerald-400' : 'text-stone-400'} />
                      {t('create_auction.duration_standard_title')}
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 border-stone-500 flex items-center justify-center">
                      {durationMode === 'standard' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </div>
                  </div>
                  <p className="text-xs text-stone-400 mb-3 leading-relaxed">
                    {t('create_auction.duration_standard_desc')}<br/>
                    <strong className="text-stone-300">{standardDateFormatted}</strong>
                  </p>
                  <div className="inline-block bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">
                    {t('create_auction.promo_badge')}
                  </div>
                </div>

                {/* Custom Mode */}
                <div
                  onClick={() => setDurationMode('custom')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${durationMode === 'custom' ? 'border-gold-500 bg-gold-900/20' : 'border-stone-700 bg-stone-800'}`}
                >
                   <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-white flex items-center gap-2">
                      <Edit size={16} className={durationMode === 'custom' ? 'text-gold-400' : 'text-stone-400'} />
                      {t('create_auction.duration_custom_title')}
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 border-stone-500 flex items-center justify-center">
                      {durationMode === 'custom' && <div className="w-2 h-2 rounded-full bg-gold-500" />}
                    </div>
                  </div>
                  <p className="text-xs text-stone-400 mb-3 leading-relaxed">
                    {t('create_auction.duration_custom_desc')}
                  </p>
                  <div className="inline-block bg-gold-500/20 text-gold-400 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider mb-3 border border-gold-500/30">
                    {t('create_auction.cost_token_badge')}
                  </div>

                  {durationMode === 'custom' && (
                    <div className="mt-2">
                      <input 
                        type="datetime-local" 
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full bg-stone-900 border border-gold-500/50 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-gold-500"
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('create_auction.starting_bid_label')}</label>
              <input type="number" step="0.01" value={startingBid} onChange={(e) => setStartingBid(e.target.value)} placeholder={t('create_auction.starting_bid_placeholder')}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #bf9a2e', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }} />
              <p className="text-xs text-stone-400 mt-1">{t('create_auction.starting_bid_note')}</p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d6d3d1', fontSize: '0.9rem' }}>{t('create_auction.description_label')}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('create_auction.description_placeholder')} rows={4}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #44403c', color: '#fff', fontSize: '0.95rem', resize: 'vertical' }} />
            </div>

          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#bf9a2e', fontSize: '1.4rem' }}>{t('create_auction.step3_heading')}</h2>

            <div style={{ border: '2px dashed #57534e', borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', backgroundColor: '#292524', position: 'relative' }}>
              <Camera size={40} color="#a8a29e" style={{ margin: '0 auto 1rem auto' }} />
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#f8fafc', fontSize: '1.1rem', fontWeight: '600' }}>{t('create_auction.upload_dropzone_title')}</label>
              <p style={{ color: '#a8a29e', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{t('create_auction.upload_dropzone_desc')}</p>

              <input type="file" id="file-upload" accept="image/*" multiple onChange={onFilesChange} style={{ display: 'none' }} />
              <button type="button" onClick={() => document.getElementById('file-upload').click()}
                style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background-color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#b45309'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#d97706'}>
                 {t('create_auction.upload_btn_browse')}
              </button>
            </div>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-4" style={{ marginTop: '1rem' }}>
                {previews.map((p, i) => (
                  <div key={p.url} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: i === 0 ? '3px solid #bf9a2e' : '1px solid #44403c' }}>
                    {i === 0 && <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(191,154,46,0.9)', color: '#000', fontSize: '0.6rem', fontWeight: 'bold', textAlign: 'center', padding: '0.1rem 0' }}>{t('create_auction.cover_badge')}</span>}
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
          <ChevronLeft size={18} /> {t('create_auction.back_btn')}
        </button>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {step === totalSteps && (
            <button type="button" onClick={() => submit('draft')} disabled={busy} className="w-full sm:w-auto justify-center" style={{
              padding: '0.8rem 1.5rem', borderRadius: '8px', backgroundColor: '#292524', border: '1px solid #78716c', color: '#d6d3d1', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <Save size={18} /> {t('create_auction.save_draft_btn')}
            </button>
          )}

          {step < totalSteps ? (
            <button type="button" onClick={nextStep} className="w-full sm:w-auto justify-center" style={{
              padding: '0.8rem 2rem', borderRadius: '8px', backgroundColor: '#bf9a2e', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(191,154,46, 0.3)'
            }}>
              {t('create_auction.next_btn')} <ChevronRight size={18} />
            </button>
          ) : (
            <button type="button" onClick={() => submit('publish')} disabled={busy} className="w-full sm:w-auto justify-center" style={{
              padding: '0.8rem 2rem', borderRadius: '8px', backgroundColor: '#10b981', border: 'none', color: '#fff', fontWeight: 'bold', cursor: busy ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)', display: 'flex', alignItems: 'center'
            }}>
              {busy ? t('create_auction.publishing') : t('create_auction.create_auction_btn')}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
