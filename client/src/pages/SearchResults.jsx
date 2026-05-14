import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { Search, X, ArrowLeft, PackageSearch } from 'lucide-react';
import ListingCard from '../components/ListingCard';

/* ─── skeleton card ───────────────────────────────────────── */
function SkeletonCard() {
  return (
    <li>
      <div className="card" style={{ height: '340px' }}>
        <div style={{
          height: '190px', backgroundColor: '#1e293b',
          animation: 'pulse 1.6s ease-in-out infinite',
        }} />
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ height: '16px', width: '80%', borderRadius: '6px', backgroundColor: '#1e293b', animation: 'pulse 1.6s ease-in-out infinite' }} />
          <div style={{ height: '12px', width: '40%', borderRadius: '6px', backgroundColor: '#1e293b', animation: 'pulse 1.6s ease-in-out infinite 0.1s' }} />
          <div style={{ height: '20px', width: '55%', borderRadius: '6px', backgroundColor: '#1e293b', marginTop: '0.5rem', animation: 'pulse 1.6s ease-in-out infinite 0.2s' }} />
        </div>
      </div>
    </li>
  );
}

/* ─── main page ────────────────────────────────────────────── */
export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const q = (searchParams.get('q') || '').trim();

  const [results, setResults] = useState([]);
  const [catalogRef, setCatalogRef] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputValue, setInputValue] = useState(q);

  // Keep input in sync if URL param changes (browser back/forward)
  useEffect(() => { setInputValue(q); }, [q]);

  // Fetch whenever the URL query changes
  useEffect(() => {
    if (!q) {
      setResults([]);
      setCatalogRef(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setResults([]);
    setCatalogRef(null);

    (async () => {
      try {
        // 1. Check if it's a set number to show catalog reference
        if (/^\d{4,7}(-\d+)?$/.test(q)) {
          const catalogData = await apiFetch(`/api/catalog/${q}`).catch(() => null);
          if (!cancelled && catalogData) setCatalogRef(catalogData);
        }

        // 2. Fetch marketplace listings
        const data = await apiFetch(`/api/listings/search?q=${encodeURIComponent(q)}`);
        if (!cancelled) {
          setResults(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Errore durante la ricerca');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [q]);

  /* Refine search from the in-page bar */
  const handleRefineSearch = (e) => {
    e.preventDefault();
    const term = inputValue.trim();
    if (!term) return;
    navigate(`/search-results?q=${encodeURIComponent(term)}`);
  };

  const handleClear = () => {
    setInputValue('');
    navigate('/search-results');
  };

  return (
    <div className="page" style={{ paddingTop: '0.5rem' }}>

      {/* ── Header strip ──────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        marginBottom: '2rem', flexWrap: 'wrap',
      }}>
        <Link
          to="/"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            color: '#94a3b8', fontSize: '0.9rem', textDecoration: 'none',
            padding: '0.4rem 0.75rem', borderRadius: '8px',
            border: '1px solid #334155', transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#94a3b8'; }}
          onMouseOut={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#334155'; }}
        >
          <ArrowLeft size={15} /> Torna alla Home
        </Link>

        {/* Refine search bar */}
        <form
          onSubmit={handleRefineSearch}
          style={{ flex: 1, minWidth: '260px', position: 'relative', display: 'flex' }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Raffina la ricerca…"
            style={{
              width: '100%', padding: '0.7rem 1.2rem', paddingRight: '5.5rem',
              fontSize: '1rem', borderRadius: '30px',
              border: '2px solid #334155', backgroundColor: '#0f172a',
              color: '#fff', outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.target.style.borderColor = '#38bdf8'; }}
            onBlur={e => { e.target.style.borderColor = '#334155'; }}
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                position: 'absolute', right: '52px', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#94a3b8',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <X size={18} />
            </button>
          )}
          <button
            type="submit"
            style={{
              position: 'absolute', right: '6px', top: '6px', bottom: '6px',
              width: '42px', borderRadius: '50%',
              backgroundColor: '#38bdf8', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#0f172a', cursor: 'pointer', transition: 'background-color 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#0ea5e9'; }}
            onMouseOut={e => { e.currentTarget.style.backgroundColor = '#38bdf8'; }}
          >
            <Search size={18} strokeWidth={2.5} />
          </button>
        </form>
      </div>

      {/* ── Title + Count ──────────────────────────────────── */}
      {q && (
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '1.8rem', fontWeight: '800', color: '#f8fafc',
            margin: '0 0 0.4rem 0',
          }}>
            Risultati per:{' '}
            <span style={{
              color: '#38bdf8',
              background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(56,189,248,0.05))',
              padding: '0.1rem 0.6rem', borderRadius: '8px',
              border: '1px solid rgba(56,189,248,0.3)',
            }}>
              "{q}"
            </span>
          </h1>

          {!loading && !error && (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.95rem' }}>
              {results.length === 0
                ? 'Nessun annuncio trovato'
                : results.length === 1
                ? 'Trovato 1 annuncio'
                : `Trovati ${results.length} annunci`}
            </p>
          )}
        </div>
      )}

      {/* ── Catalog Reference (SEO / Reference Highlight) ── */}
      {catalogRef && (
        <div style={{
          marginBottom: '2.5rem',
          background: 'linear-gradient(135deg, #0f172a, #1e293b)',
          borderRadius: '24px',
          border: '1px solid #334155',
          padding: '2rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2rem',
          alignItems: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: '120px', height: '120px', backgroundColor: '#0f172a',
            borderRadius: '16px', padding: '0.5rem', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <img src={catalogRef.img_url} alt={catalogRef.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          
          <div style={{ flex: 1, minWidth: '200px' }}>
            <span style={{ color: '#38bdf8', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.25rem' }}>Catalog Reference</span>
            <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: '900', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>{catalogRef.name}</h2>
            <div style={{ display: 'flex', gap: '1.5rem', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold' }}>
               <span>#{catalogRef.set_num}</span>
               <span>{catalogRef.year}</span>
               <span>{catalogRef.num_parts} Pezzi</span>
            </div>
          </div>

          <div style={{ 
            display: 'flex', flexDirection: 'column', gap: '1rem',
            borderLeft: '1px solid #334155', paddingLeft: '2rem'
          }}>
             <div style={{ textAlign: 'right' }}>
               <span style={{ color: '#64748b', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}>Market Value</span>
               <p style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>€{catalogRef.pricing?.marketValue || '---'}</p>
             </div>
             <Link 
               to={`/catalog/${catalogRef.set_num}`}
               style={{
                 padding: '0.6rem 1.2rem', backgroundColor: '#38bdf8', color: '#0f172a',
                 borderRadius: '30px', fontWeight: '900', fontSize: '0.8rem',
                 textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center',
                 transition: 'transform 0.2s'
               }}
               onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
               onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
             >
               Vedi Scheda Tecnica
             </Link>
          </div>
        </div>
      )}

      {/* ── No query state ─────────────────────────────────── */}
      {!q && !loading && (
        <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
          <PackageSearch size={64} color="#334155" style={{ marginBottom: '1.5rem' }} />
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0 }}>
            Inserisci un termine di ricerca per trovare set LEGO.
          </p>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────── */}
      {error && (
        <div style={{
          backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '2rem', color: '#fca5a5',
        }}>
          {error}
        </div>
      )}

      {/* ── Loading skeletons ──────────────────────────────── */}
      {loading && (
        <>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
          `}</style>
          <ul className="grid">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </ul>
        </>
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {!loading && !error && q && results.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '5rem 2rem',
          backgroundColor: '#0f172a', borderRadius: '16px',
          border: '1px solid #1e293b',
        }}>
          <PackageSearch size={72} color="#334155" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ color: '#e2e8f0', margin: '0 0 0.75rem 0', fontSize: '1.4rem' }}>
            Nessun risultato trovato per "{q}"
          </h2>
          <p style={{ color: '#94a3b8', margin: '0 0 2rem 0', maxWidth: '400px', marginInline: 'auto' }}>
            Prova a cambiare i termini di ricerca o sfoglia tutti gli annunci attivi.
          </p>
          <Link
            to="/"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: '#38bdf8', color: '#0f172a',
              padding: '0.8rem 1.8rem', borderRadius: '30px',
              fontWeight: '700', fontSize: '1rem', textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(56,189,248,0.35)',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#0ea5e9'; }}
            onMouseOut={e => { e.currentTarget.style.backgroundColor = '#38bdf8'; }}
          >
            <ArrowLeft size={18} /> Torna alla Home
          </Link>
        </div>
      )}

      {/* ── Results grid ──────────────────────────────────── */}
      {!loading && !error && results.length > 0 && (
        <ul className="grid">
          {results.map(l => <ListingCard key={l.id} l={l} />)}
        </ul>
      )}

    </div>
  );
}
