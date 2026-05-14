import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LISTING_ENDPOINTS, apiPostForm, apiFetch, SERVER_URL } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Camera, CheckCircle, Package, Edit, ChevronRight, ChevronLeft, Save, Loader, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';
import SetLookupInput from '../components/SetLookupInput';

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

export const CARRIERS = [
  { id: 'DHL', name: 'DHL Express', icon: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/DHL_Logo.svg' },
  { id: 'BRT', name: 'BRT Corriere', icon: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Brt_logo.svg' },
  { id: 'UPS', name: 'UPS', icon: 'https://upload.wikimedia.org/wikipedia/commons/1/18/UPS_Logo_2014.svg' },
  { id: 'SDA', name: 'SDA', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/SDA_Express_Courier_logo.svg' },
  { id: 'POSTE', name: 'Poste Italiane', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Poste_Italiane_logo_2015.svg/120px-Poste_Italiane_logo_2015.svg.png' },
];

export default function Sell() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const { user } = useAuth();
  
  const isPro = user?.role === 'professional' || user?.role_name === 'professional' || user?.is_pro || user?.seller_type === 'professional';

  // Wizard State
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  // Form State
  const [title, setTitle] = useState('');
  const [setNumber, setSetNumber] = useState('');
  const [mainCategory, setMainCategory] = useState(''); // mandatory: sets, mocs, minifigures
  const [category, setCategory] = useState(''); // this is "theme" in DB
  const [year, setYear] = useState('');
  
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
        setError('Impossibile caricare i dati dell\'annuncio per la modifica.');
      } finally {
        setLoadingListing(false);
      }
    };

    fetchListing();
  }, [editId]);

  function onFilesChange(e) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles(list.slice(0, 5));
  }

  function removeFileAt(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  const nextStep = () => {
    setError('');
    if (step === 1 && (!title || !mainCategory)) {
      setError('Titolo e Categoria Principale sono obbligatori.');
      return;
    }
    if (step === 2 && !condition) {
      setError('La Condizione principale è obbligatoria.');
      return;
    }
    if (step === 3) {
      if (!price) {
        setError('Il Prezzo è obbligatorio.');
        return;
      }
      const selectedShippings = Object.values(shippingOptions).filter(o => o.selected);
      if (selectedShippings.length === 0) {
        setError('Devi selezionare almeno un metodo di spedizione.');
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
      setError('Carica almeno una foto per pubblicare l\'annuncio.');
      return;
    }

    const fd = new FormData();
    fd.append('title', title.trim());
    if (setNumber) fd.append('setNumber', setNumber.trim());
    fd.append('category', mainCategory);
    if (category) fd.append('theme', category);
    if (year) fd.append('year', year);
    
    const conditionMap = { 'new': 'new', 'used': 'used', 'complete': 'complete', 'parts': 'parts' };
    const mappedType = condition === 'new' ? 'sealed' : 'used';
    fd.append('type', mappedType);
    fd.append('condition', conditionMap[condition] || 'used');
    if (boxCondition) fd.append('boxCondition', boxCondition);
    if (instructions) fd.append('instructions', instructions);
    fd.append('isComplete', String(isComplete));

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
          throw new Error(d.error || 'Errore aggiornamento');
        }
      } else {
        await apiPostForm(LISTING_ENDPOINTS.create, fd);
      }
      navigate('/my-listings', { replace: true });
    } catch (e) {
      setError(e.message || 'Errore durante l\'operazione.');
    } finally {
      setBusy(false);
    }
  }

  if (loadingListing) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader className="animate-spin" size={32} color="#38bdf8" />
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
          backgroundColor: isPast ? '#059669' : isActive ? '#38bdf8' : '#334155',
          color: isActive || isPast ? '#fff' : '#94a3b8',
          border: isActive ? '2px solid #bae6fd' : 'none'
        }}>
          {isPast ? <CheckCircle size={20} /> : <IconComponent size={20} />}
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 'bold' : 'normal', color: isActive ? '#bae6fd' : '#94a3b8' }}>
          {['Info', 'Condizioni', 'Dettagli', 'Foto'][index - 1]}
        </span>
      </div>
    );
  };

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, color: '#f8fafc' }}>
          {editId ? 'Modifica Annuncio' : 'Vendi il tuo Set'}
        </h1>
        <Link to="/my-listings" style={{ 
          padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #475569', color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', transition: 'all 0.2s' 
        }}>
          Annulla
        </Link>
      </div>

      {/* Progress Bar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: '3rem', padding: '0 1rem' }}>
        <div style={{ position: 'absolute', top: '20px', left: '10%', right: '10%', height: '2px', backgroundColor: '#334155', zIndex: 0 }}>
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
        const condLabels = { new: 'Sigillato', used: 'Usato', complete: 'Completo', parts: 'Pezzi' };
        const appPct = lookupPricing.appreciationPct;
        const TIcon = appPct >= 15 ? TrendingUp : appPct < 0 ? TrendingDown : Minus;
        const tColor = appPct >= 50 ? '#10b981' : appPct >= 15 ? '#38bdf8' : appPct < 0 ? '#f87171' : '#64748b';

        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            marginBottom: '1.25rem',
            padding: '0.75rem 1.25rem',
            backgroundColor: 'rgba(15,23,42,0.95)',
            border: `1px solid ${lookupPricing.isTrending ? 'rgba(16,185,129,0.35)' : 'rgba(56,189,248,0.2)'}`,
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
              backgroundColor: lookupPricing.isTrending ? 'rgba(16,185,129,0.12)' : 'rgba(56,189,248,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={16} color={lookupPricing.isTrending ? '#10b981' : '#38bdf8'} />
            </div>

            {/* Label */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.08em', color: '#475569', textTransform: 'uppercase', marginBottom: '0.1rem' }}>
                Valore di Mercato Stimato
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {setNumber || 'Set'} · <span style={{ color: '#94a3b8' }}>{condLabels[condKey]}</span>
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
              <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: '0.1rem' }}>
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
      <div style={{ backgroundColor: '#0f172a', padding: '2.5rem', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
        
        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '1.4rem' }}>1. Informazioni Base</h2>

            {/* ── Rebrickable Set Lookup ── */}
            {!editId && (
              <div style={{ padding: '1rem 1.25rem', backgroundColor: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '12px' }}>
                <SetLookupInput
                  onSetFound={handleSetFound}
                  onClear={handleLookupClear}
                  condition={condition}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Nome del Set / Titolo *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Millennium Falcon UCS"
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Numero Set</label>
                <input type="text" value={setNumber} onChange={(e) => setSetNumber(e.target.value)} placeholder="es. 75192"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }} />
              </div>
              <div>
                {lookupPieces != null && (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Pezzi Totali (da Rebrickable)</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#38bdf8' }}>{lookupPieces.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 'bold' }}>Categoria Principale *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem', marginBottom: '1rem' }}>
                {[
                  { id: 'sets', label: 'Set', icon: '🧱' },
                  { id: 'mocs', label: 'MOCs', icon: '🏗️' },
                  { id: 'minifigures', label: 'Minifigures', icon: '👤' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setMainCategory(cat.id)}
                    style={{
                      padding: '1rem 0.5rem',
                      borderRadius: '12px',
                      border: '2px solid',
                      borderColor: mainCategory === cat.id ? '#38bdf8' : '#334155',
                      backgroundColor: mainCategory === cat.id ? '#0c4a6e' : '#1e293b',
                      color: mainCategory === cat.id ? '#fff' : '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Tema (opzionale)</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }}>
                  {CATEGORIES.map((c) => <option key={c.value === '' ? '_none' : c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Anno Rilascio</label>
                <input type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="es. 2017"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '1.4rem' }}>2. Stato e Condizioni</h2>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Condizione Principale *</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }}>
                <option value="">— Seleziona —</option>
                <option value="new">Nuovo (Sigillato)</option>
                <option value="used">Usato</option>
                <option value="complete">Usato - Parzialmente Montato</option>
                <option value="parts">Sfuso / Pezzi</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Condizione Scatola</label>
                <select value={boxCondition} onChange={(e) => setBoxCondition(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }}>
                  <option value="">— Seleziona —</option>
                  <option value="Mint (Perfetta)">Mint (Perfetta)</option>
                  <option value="Damaged (Danneggiata)">Danneggiata</option>
                  <option value="None (Assente)">Assente</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Istruzioni</label>
                <select value={instructions} onChange={(e) => setInstructions(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }}>
                  <option value="">— Seleziona —</option>
                  <option value="Yes (Presenti)">Presenti</option>
                  <option value="No (Assenti)">Assenti</option>
                  <option value="Solo PDF">Solo PDF</option>
                </select>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.5rem', padding: '1rem', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', cursor: 'pointer' }}>
              <input type="checkbox" checked={isComplete} onChange={(e) => setIsComplete(e.target.checked)} style={{ width: '1.2rem', height: '1.2rem', accentColor: '#38bdf8' }} />
              <div>
                <span style={{ color: '#f8fafc', fontWeight: 'bold', display: 'block' }}>Set Completo 100%</span>
                <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Dichiaro che non manca nessun pezzo, minifigure o accessorio.</span>
              </div>
            </label>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '1.4rem' }}>3. Prezzo e Dettagli</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Prezzo (EUR) *</label>
                <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="es. 149.99"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #38bdf8', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Metodi di Spedizione Offerti *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                {CARRIERS.map(c => {
                  const isActive = shippingOptions[c.id]?.selected;
                  
                  return (
                    <div 
                      key={c.id} 
                      style={{ 
                        border: isActive ? '2px solid #38bdf8' : '1px solid #334155', 
                        borderRadius: '12px', 
                        padding: '1rem', 
                        backgroundColor: isActive ? 'rgba(56,189,248,0.05)' : '#1e293b',
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
                          style={{ width: '1.2rem', height: '1.2rem', accentColor: '#38bdf8' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <img src={c.icon} alt={c.name} style={{ height: '20px', width: 'auto', maxWidth: '40px', objectFit: 'contain', backgroundColor: '#fff', padding: '2px', borderRadius: '4px' }} />
                          <span style={{ color: isActive ? '#fff' : '#94a3b8', fontWeight: 'bold', fontSize: '0.9rem' }}>{c.name}</span>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
              <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                I costi di spedizione verranno calcolati automaticamente per l'acquirente in base alla sua posizione.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Dimensione del Pacco *</label>
                <select value={packageSize} onChange={(e) => setPackageSize(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }}>
                  <option value="small">Piccolo (&lt; 2kg)</option>
                  <option value="medium">Medio (&lt; 5kg)</option>
                  <option value="large">Grande (&gt; 5kg)</option>
                </select>
                <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                  Serve a determinare con precisione la tariffa calcolata per l'acquirente.
                </p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Descrizione dell'Annuncio</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Aggiungi altri dettagli specifici..." rows={4}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '0.95rem', resize: 'vertical' }} />
            </div>

            {isPro && (
               <div style={{ padding: '1rem', backgroundColor: '#1e1b4b', border: '1px solid #4338ca', borderRadius: '8px' }}>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#a5b4fc', fontSize: '0.9rem', fontWeight: 'bold' }}>
                   <span style={{ backgroundColor: '#eab308', color: '#000', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.65rem' }}>PRO</span>
                   Note Interne Aziendali
                 </label>
                 <textarea value={proNotes} onChange={(e) => setProNotes(e.target.value)} placeholder="Scaffale magazzino, note di stock..." rows={2}
                   style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#312e81', border: 'none', color: '#e0e7ff', fontSize: '0.9rem', resize: 'vertical' }} />
               </div>
            )}
            
          </div>
        )}

        {/* STEP 4 */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '1.4rem' }}>4. Carica Immagini</h2>
            
            <div style={{ border: '2px dashed #475569', borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', backgroundColor: '#1e293b', position: 'relative' }}>
              <Camera size={40} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#f8fafc', fontSize: '1.1rem', fontWeight: '600' }}>Seleziona o Trascina fino a 5 foto</label>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Usa immagini chiare. La prima sarà la copertina dell'annuncio.</p>
              
              <input type="file" id="file-upload" accept="image/*" multiple onChange={onFilesChange} style={{ display: 'none' }} />
              <button type="button" onClick={() => document.getElementById('file-upload').click()} 
                style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background-color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#0369a1'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#0284c7'}>
                 {editId ? 'Carica Nuove Foto (Opzionale)' : 'Sfoglia File...'}
              </button>
            </div>

            {editId && existingImages.length > 0 && files.length === 0 && (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Immagini attuali:</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                   {existingImages.map((img, i) => (
                     <div key={i} style={{ width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #334155' }}>
                       <img src={img.startsWith('http') ? img : `${SERVER_URL}/${img.startsWith('/') ? img.substring(1) : img}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                     </div>
                   ))}
                </div>
              </div>
            )}

            {previews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                {previews.map((p, i) => (
                  <div key={p.url} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: i === 0 ? '3px solid #38bdf8' : '1px solid #334155' }}>
                    {i === 0 && <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(56,189,248,0.9)', color: '#000', fontSize: '0.6rem', fontWeight: 'bold', textAlign: 'center', padding: '0.1rem 0' }}>COPERTINA</span>}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
        <button type="button" onClick={prevStep} disabled={step === 1 || busy} style={{ 
          display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.8rem 1.5rem', borderRadius: '8px', backgroundColor: 'transparent', border: '1px solid #475569', color: '#e2e8f0', cursor: step === 1 ? 'not-allowed' : 'pointer', opacity: step === 1 ? 0 : 1 
        }}>
          <ChevronLeft size={18} /> Indietro
        </button>

        <div style={{ display: 'flex', gap: '1rem' }}>
          {step === totalSteps && (
            <button type="button" onClick={() => submit('draft')} disabled={busy} style={{ 
              padding: '0.8rem 1.5rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #64748b', color: '#cbd5e1', cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' 
            }}>
              <Save size={18} /> Salva Bozza
            </button>
          )}
          
          {step < totalSteps ? (
            <button type="button" onClick={nextStep} style={{ 
              padding: '0.8rem 2rem', borderRadius: '8px', backgroundColor: '#38bdf8', border: 'none', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)' 
            }}>
              Avanti <ChevronRight size={18} />
            </button>
          ) : (
            <button type="button" onClick={() => submit('publish')} disabled={busy} style={{ 
              padding: '0.8rem 2rem', borderRadius: '8px', backgroundColor: '#10b981', border: 'none', color: '#fff', fontWeight: 'bold', cursor: busy ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' 
            }}>
              {busy ? (editId ? 'Aggiornamento...' : 'Pubblicazione...') : (editId ? 'Aggiorna Annuncio' : 'Pubblica ORA')}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
