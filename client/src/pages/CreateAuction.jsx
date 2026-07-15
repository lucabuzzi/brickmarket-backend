import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LISTING_ENDPOINTS, apiPostForm, SERVER_URL } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Camera, CheckCircle, Edit, ChevronRight, ChevronLeft, Save, Gavel, Clock } from 'lucide-react';

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

export default function CreateAuction() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPro = user?.role === 'professional' || user?.role_name === 'professional' || user?.is_pro || user?.seller_type === 'professional';

  // Wizard State
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Form State - Info
  const [title, setTitle] = useState('');
  const [setNumber, setSetNumber] = useState('');
  const [mainCategory, setMainCategory] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');

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

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const standardDateObj = new Date();
  standardDateObj.setDate(standardDateObj.getDate() + 7);
  const standardDateFormatted = standardDateObj.toLocaleString('it-IT', { 
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
    if (step === 1 && (!title || !mainCategory || !condition)) {
      setError('Titolo, Categoria Principale e Condizione sono obbligatori.');
      return;
    }
    if (step === 2) {
      if (!startingBid) {
        setError('Il Prezzo Base (Base d\'asta) è obbligatorio.');
        return;
      }
      if (durationMode === 'custom' && !customEndDate) {
        setError('Seleziona una data di fine per la durata personalizzata.');
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
      setError('Carica almeno una foto per pubblicare l\'asta.');
      return;
    }

    const fd = new FormData();
    fd.append('title', title.trim());
    if (setNumber) fd.append('setNumber', setNumber.trim());
    fd.append('category', mainCategory);
    if (category) fd.append('theme', category);
    
    const conditionMap = { 'new': 'new', 'used': 'used', 'complete': 'complete', 'parts': 'parts' };
    const mappedType = condition === 'new' ? 'sealed' : 'used';
    fd.append('type', 'auction'); // Auction specific
    fd.append('is_auction', 'true'); // Flag for backend compatibility
    fd.append('condition', conditionMap[condition] || 'used');

    if (description) fd.append('description', description.trim());
    
    if (!Number.isNaN(p) && p > 0) fd.append('price', String(p)); // Price is starting bid
    fd.append('status', mode === 'draft' ? 'draft' : 'active');

    // Handle end date
    let endDate;
    if (durationMode === 'standard') {
      endDate = standardDateObj.toISOString();
    } else {
      endDate = new Date(customEndDate).toISOString();
    }
    fd.append('end_date', endDate);

    files.forEach((f) => fd.append('images', f));

    setBusy(true);
    try {
      await apiPostForm(LISTING_ENDPOINTS.create, fd);
      navigate('/my-listings', { replace: true });
    } catch (e) {
      setError(e.message || 'Errore durante la creazione dell\'asta.');
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
          backgroundColor: isPast ? '#059669' : isActive ? '#f59e0b' : '#334155',
          color: isActive || isPast ? '#fff' : '#94a3b8',
          border: isActive ? '2px solid #fde68a' : 'none'
        }}>
          {isPast ? <CheckCircle size={20} /> : <IconComponent size={20} />}
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: isActive ? 'bold' : 'normal', color: isActive ? '#fcd34d' : '#94a3b8' }}>
          {['Info', 'Dettagli Asta', 'Foto'][index - 1]}
        </span>
      </div>
    );
  };

  return (
    <div className="page" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem', paddingTop: '6rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gavel className="text-amber-500" size={32} /> Crea Nuova Asta
        </h1>
        <Link to="/my-listings" style={{ 
          padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #475569', color: '#cbd5e1', textDecoration: 'none', fontSize: '0.9rem', transition: 'all 0.2s' 
        }}>
          Annulla
        </Link>
      </div>

      {/* Progress Bar Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: '3rem', padding: '0 2rem' }}>
        <div style={{ position: 'absolute', top: '20px', left: '15%', right: '15%', height: '2px', backgroundColor: '#334155', zIndex: 0 }}>
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
      <div style={{ backgroundColor: '#0f172a', padding: '2.5rem', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
        
        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b', fontSize: '1.4rem' }}>1. Informazioni Base</h2>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Titolo dell'Asta *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. Millennium Falcon UCS - Raro"
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Numero Set</label>
                <input type="text" value={setNumber} onChange={(e) => setSetNumber(e.target.value)} placeholder="es. 75192"
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Condizione *</label>
                <select value={condition} onChange={(e) => setCondition(e.target.value)}
                  style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }}>
                  <option value="">— Seleziona —</option>
                  <option value="new">Nuovo (Sigillato)</option>
                  <option value="used">Usato</option>
                  <option value="complete">Usato - Parzialmente Montato</option>
                  <option value="parts">Sfuso / Pezzi</option>
                </select>
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
                      borderColor: mainCategory === cat.id ? '#f59e0b' : '#334155',
                      backgroundColor: mainCategory === cat.id ? '#78350f' : '#1e293b',
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

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Tema (opzionale)</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '1rem' }}>
                {CATEGORIES.map((c) => <option key={c.value === '' ? '_none' : c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b', fontSize: '1.4rem' }}>2. Dettagli Asta</h2>
            
            {/* Durata Asta */}
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <label style={{ display: 'block', marginBottom: '1rem', color: '#fff', fontSize: '1rem', fontWeight: 'bold' }}>Durata dell'Asta</label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Standard Mode */}
                <div 
                  onClick={() => setDurationMode('standard')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${durationMode === 'standard' ? 'border-emerald-500 bg-emerald-900/20' : 'border-slate-700 bg-slate-800'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-white flex items-center gap-2">
                      <Clock size={16} className={durationMode === 'standard' ? 'text-emerald-400' : 'text-slate-400'} /> 
                      Standard (7 Giorni)
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 border-slate-500 flex items-center justify-center">
                      {durationMode === 'standard' && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    L'asta terminerà automaticamente tra 7 giorni esatti:<br/>
                    <strong className="text-slate-300">{standardDateFormatted}</strong>
                  </p>
                  <div className="inline-block bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider">
                    PROMO: Gratis per le tue prime 10 aste
                  </div>
                </div>

                {/* Custom Mode */}
                <div 
                  onClick={() => setDurationMode('custom')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${durationMode === 'custom' ? 'border-amber-500 bg-amber-900/20' : 'border-slate-700 bg-slate-800'}`}
                >
                   <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-white flex items-center gap-2">
                      <Edit size={16} className={durationMode === 'custom' ? 'text-amber-400' : 'text-slate-400'} /> 
                      Personalizzata
                    </div>
                    <div className="w-4 h-4 rounded-full border-2 border-slate-500 flex items-center justify-center">
                      {durationMode === 'custom' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                    Scegli la data e l'ora esatta di fine asta per massimizzare la visibilità.
                  </p>
                  <div className="inline-block bg-amber-500/20 text-amber-400 text-[10px] font-black px-2 py-1 rounded uppercase tracking-wider mb-3 border border-amber-500/30">
                    COSTO: 1 Token
                  </div>
                  
                  {durationMode === 'custom' && (
                    <div className="mt-2">
                      <input 
                        type="datetime-local" 
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full bg-slate-900 border border-amber-500/50 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-amber-500"
                        min={new Date().toISOString().slice(0, 16)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Base d'Asta (EUR) *</label>
              <input type="number" step="0.01" value={startingBid} onChange={(e) => setStartingBid(e.target.value)} placeholder="es. 1.00"
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #f59e0b', color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }} />
              <p className="text-xs text-slate-400 mt-1">L'importo minimo da cui partiranno le offerte.</p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.9rem' }}>Descrizione dell'Annuncio</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Aggiungi dettagli sulle condizioni, spedizione..." rows={4}
                style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '8px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '0.95rem', resize: 'vertical' }} />
            </div>
            
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b', fontSize: '1.4rem' }}>3. Carica Immagini</h2>
            
            <div style={{ border: '2px dashed #475569', borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', backgroundColor: '#1e293b', position: 'relative' }}>
              <Camera size={40} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#f8fafc', fontSize: '1.1rem', fontWeight: '600' }}>Seleziona o Trascina fino a 5 foto</label>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Usa immagini chiare. La prima sarà la copertina dell'asta.</p>
              
              <input type="file" id="file-upload" accept="image/*" multiple onChange={onFilesChange} style={{ display: 'none' }} />
              <button type="button" onClick={() => document.getElementById('file-upload').click()} 
                style={{ backgroundColor: '#d97706', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background-color 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#b45309'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#d97706'}>
                 Sfoglia File...
              </button>
            </div>

            {previews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                {previews.map((p, i) => (
                  <div key={p.url} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: i === 0 ? '3px solid #f59e0b' : '1px solid #334155' }}>
                    {i === 0 && <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(245,158,11,0.9)', color: '#000', fontSize: '0.6rem', fontWeight: 'bold', textAlign: 'center', padding: '0.1rem 0' }}>COPERTINA</span>}
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
              padding: '0.8rem 2rem', borderRadius: '8px', backgroundColor: '#f59e0b', border: 'none', color: '#0f172a', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)' 
            }}>
              Avanti <ChevronRight size={18} />
            </button>
          ) : (
            <button type="button" onClick={() => submit('publish')} disabled={busy} style={{ 
              padding: '0.8rem 2rem', borderRadius: '8px', backgroundColor: '#10b981', border: 'none', color: '#fff', fontWeight: 'bold', cursor: busy ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' 
            }}>
              {busy ? 'Pubblicazione...' : 'Crea Asta ORA'}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
