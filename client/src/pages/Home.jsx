import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';

function listingImage(l) {
  if (Array.isArray(l.images) && l.images.length) return l.images[0];
  if (l.image_url) return l.image_url;
  return 'https://picsum.photos/seed/placeholder/800/600';
}

function formatPrice(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function Home() {
  const [listings, setListings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/listings?status=all');
        if (!cancelled) setListings(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Impossibile caricare gli annunci');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page home">
      <section className="hero-block">
        <h1>Trova il tuo prossimo set</h1>
        <p className="lede">
          Annunci da collezionisti: nuovi, usati e MOC. Accedi per vendere o acquistare quando il backend
          è collegato ai pagamenti.
        </p>
      </section>

      {loading && <p className="muted">Caricamento annunci…</p>}
      {error && <p className="error-banner">{error}</p>}

      {!loading && !error && listings.length === 0 && (
        <p className="muted">Nessun annuncio. Esegui <code>npm run seed</code> nel backend.</p>
      )}

      <ul className="grid">
        {listings.map((l) => (
          <li key={l.id}>
            <article className="card">
              <Link to={`/listing/${l.id}`} className="card__media">
                <img src={listingImage(l)} alt="" loading="lazy" />
              </Link>
              <div className="card__body">
                <h2>
                  <Link to={`/listing/${l.id}`}>{l.title}</Link>
                </h2>
                <p className="meta">
                  {l.theme || l.category || 'Generico'} · {l.type || '—'}
                </p>
                <p className="price">{formatPrice(l.price)}</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
