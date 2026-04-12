import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api';

function listingImage(l) {
  if (Array.isArray(l.images) && l.images.length) return l.images;
  if (l.image_url) return [l.image_url];
  return ['https://picsum.photos/seed/detail/800/600'];
}

function formatPrice(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
}

export default function ListingDetail() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch(`/api/listings/${id}`);
        if (!cancelled) setListing(data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Annuncio non trovato');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p className="muted">Caricamento…</p>;
  if (error || !listing) return <p className="error-banner">{error || 'Non trovato'}</p>;

  const imgs = listingImage(listing);

  return (
    <div className="page listing-detail">
      <nav className="breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden> / </span>
        <span>{listing.title}</span>
      </nav>

      <div className="detail-layout">
        <div className="gallery">
          {imgs.map((src, i) => (
            <img key={`${src}-${i}`} src={src} alt="" />
          ))}
        </div>
        <div>
          <h1>{listing.title}</h1>
          <p className="price price--large">{formatPrice(listing.price)}</p>
          <dl className="facts">
            <div>
              <dt>Tema / categoria</dt>
              <dd>{listing.theme || listing.category || '—'}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{listing.type || '—'}</dd>
            </div>
            <div>
              <dt>Condizione</dt>
              <dd>{listing.condition || '—'}</dd>
            </div>
            {listing.set_number && (
              <div>
                <dt>Set</dt>
                <dd>{listing.set_number}</dd>
              </div>
            )}
            <div>
              <dt>Spedizione</dt>
              <dd>
                {formatPrice(listing.shipping_cost)}
                {listing.shipping_method ? ` · ${listing.shipping_method}` : ''}
              </dd>
            </div>
          </dl>
          <div className="description">
            <h2>Descrizione</h2>
            <p>{listing.description || 'Nessuna descrizione.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
