import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import { Search, X, ArrowLeft, PackageSearch } from 'lucide-react';
import ListingCard from '../components/ListingCard';

/* ─── skeleton card ───────────────────────────────────────── */
function SkeletonCard() {
  return (
    <li>
      <div className="card" style={{ height: '340px' }}>
        <div style={{
          height: '190px', backgroundColor: '#292524',
          animation: 'pulse 1.6s ease-in-out infinite',
        }} />
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ height: '16px', width: '80%', borderRadius: '6px', backgroundColor: '#292524', animation: 'pulse 1.6s ease-in-out infinite' }} />
          <div style={{ height: '12px', width: '40%', borderRadius: '6px', backgroundColor: '#292524', animation: 'pulse 1.6s ease-in-out infinite 0.1s' }} />
          <div style={{ height: '20px', width: '55%', borderRadius: '6px', backgroundColor: '#292524', marginTop: '0.5rem', animation: 'pulse 1.6s ease-in-out infinite 0.2s' }} />
        </div>
      </div>
    </li>
  );
}

/* ─── main page ────────────────────────────────────────────── */
export default function SearchResults() {
  const { t } = useTranslation();
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
        if (!cancelled) setError(e.message || t('search_results.generic_search_error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [q, t]);

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
            color: '#a8a29e', fontSize: '0.9rem', textDecoration: 'none',
            padding: '0.4rem 0.75rem', borderRadius: '8px',
            border: '1px solid #44403c', transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#a8a29e'; }}
          onMouseOut={e => { e.currentTarget.style.color = '#a8a29e'; e.currentTarget.style.borderColor = '#44403c'; }}
        >
          <ArrowLeft size={15} /> {t('search_results.back_to_home')}
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
            placeholder={t('search_results.refine_placeholder')}
            style={{
              width: '100%', padding: '0.7rem 1.2rem', paddingRight: '5.5rem',
              fontSize: '1rem', borderRadius: '30px',
              border: '2px solid #44403c', backgroundColor: '#120f0a',
              color: '#fff', outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.target.style.borderColor = '#d4af37'; }}
            onBlur={e => { e.target.style.borderColor = '#44403c'; }}
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                position: 'absolute', right: '52px', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: '#a8a29e',
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
              backgroundColor: '#d4af37', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', cursor: 'pointer', transition: 'background-color 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#bf9a2e'; }}
            onMouseOut={e => { e.currentTarget.style.backgroundColor = '#d4af37'; }}
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
            {t('search_results.results_for_label')}{' '}
            <span style={{
              color: '#d4af37',
              background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))',
              padding: '0.1rem 0.6rem', borderRadius: '8px',
              border: '1px solid rgba(212,175,55,0.3)',
            }}>
              "{q}"
            </span>
          </h1>

          {!loading && !error && (
            <p style={{ margin: 0, color: '#a8a29e', fontSize: '0.95rem' }}>
              {results.length === 0
                ? t('search_results.no_results')
                : results.length === 1
                ? t('search_results.one_result')
                : t('search_results.multiple_results', { count: results.length })}
            </p>
          )}
        </div>
      )}

      {/* ── Catalog Reference (SEO / Reference Highlight) ── */}
      {catalogRef && (
        <div style={{
          marginBottom: '2.5rem',
          background: 'linear-gradient(135deg, #120f0a, #292524)',
          borderRadius: '24px',
          border: '1px solid #44403c',
          padding: '2rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2rem',
          alignItems: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          <div style={{
            width: '120px', height: '120px', backgroundColor: '#120f0a',
            borderRadius: '16px', padding: '0.5rem', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <img src={catalogRef.img_url} alt={catalogRef.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          
          <div style={{ flex: 1, minWidth: '200px' }}>
            <span style={{ color: '#d4af37', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '2px', display: 'block', marginBottom: '0.25rem' }}>{t('search_results.catalog_reference_label')}</span>
            <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: '900', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>{catalogRef.name}</h2>
            <div style={{ display: 'flex', gap: '1.5rem', color: '#a8a29e', fontSize: '0.9rem', fontWeight: 'bold' }}>
               <span>#{catalogRef.set_num}</span>
               <span>{catalogRef.year}</span>
               <span>{t('search_results.parts_suffix', { count: catalogRef.num_parts })}</span>
            </div>
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: '1rem',
            borderLeft: '1px solid #44403c', paddingLeft: '2rem'
          }}>
             <div style={{ textAlign: 'right' }}>
               <span style={{ color: '#78716c', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}>{t('search_results.market_value_label')}</span>
               <p style={{ color: '#fff', fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>€{catalogRef.pricing?.marketValue || '---'}</p>
             </div>
             <Link
               to={`/catalog/lego/${catalogRef.set_num}`}
               style={{
                 padding: '0.6rem 1.2rem', backgroundColor: '#d4af37', color: '#fff',
                 borderRadius: '30px', fontWeight: '900', fontSize: '0.8rem',
                 textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center',
                 transition: 'transform 0.2s'
               }}
               onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
               onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
             >
               {t('search_results.view_tech_sheet')}
             </Link>
          </div>
        </div>
      )}

      {/* ── No query state ─────────────────────────────────── */}
      {!q && !loading && (
        <div style={{ textAlign: 'center', padding: '5rem 2rem' }}>
          <PackageSearch size={64} color="#44403c" style={{ marginBottom: '1.5rem' }} />
          <p style={{ color: '#a8a29e', fontSize: '1.1rem', margin: 0 }}>
            {t('search_results.empty_query_prompt')}
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
          <ul className="cards-grid">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </ul>
        </>
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {!loading && !error && q && results.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '5rem 2rem',
          backgroundColor: '#120f0a', borderRadius: '16px',
          border: '1px solid #292524',
        }}>
          <PackageSearch size={72} color="#44403c" style={{ marginBottom: '1.5rem' }} />
          <h2 style={{ color: '#e7e5e4', margin: '0 0 0.75rem 0', fontSize: '1.4rem' }}>
            {t('search_results.no_results_title', { query: q })}
          </h2>
          <p style={{ color: '#a8a29e', margin: '0 0 2rem 0', maxWidth: '400px', marginInline: 'auto' }}>
            {t('search_results.no_results_desc')}
          </p>
          <Link
            to="/"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              backgroundColor: '#d4af37', color: '#fff',
              padding: '0.8rem 1.8rem', borderRadius: '30px',
              fontWeight: '700', fontSize: '1rem', textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(212,175,55,0.35)',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.backgroundColor = '#bf9a2e'; }}
            onMouseOut={e => { e.currentTarget.style.backgroundColor = '#d4af37'; }}
          >
            <ArrowLeft size={18} /> {t('search_results.back_to_home')}
          </Link>
        </div>
      )}

      {/* ── Results grid ──────────────────────────────────── */}
      {!loading && !error && results.length > 0 && (
        <ul className="cards-grid">
          {results.map(l => <ListingCard key={l.id} l={l} />)}
        </ul>
      )}

    </div>
  );
}
