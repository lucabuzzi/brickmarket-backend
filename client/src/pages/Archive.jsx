import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import ListingCard from '../components/ListingCard';
import { Archive as ArchiveIcon } from 'lucide-react';

export default function Archive() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadArchive() {
      try {
        const data = await apiFetch('/api/listings/archive');
        setListings(data);
      } catch (err) {
        setError(err.message || "Errore nel recupero dell'archivio");
      } finally {
        setLoading(false);
      }
    }
    loadArchive();
  }, []);

  return (
    <div className="page" style={{ padding: '2rem' }}>
      <div className="max-w-7xl mx-auto">
        <div style={{ marginBottom: '2rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
          <div className="flex items-center gap-3 mb-2">
            <ArchiveIcon size={32} className="text-slate-400" />
            <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#fff', fontWeight: '900', letterSpacing: '-0.05em' }}>
              The Archive
            </h1>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '1.1rem' }}>
            Esplora le aste concluse e le migliori occasioni vendute sulla piattaforma.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-500 animate-pulse text-lg font-bold">Caricamento archivio...</p>
          </div>
        ) : error ? (
          <div className="error-banner">{error}</div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Nessun annuncio archiviato al momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 lg:gap-5">
            {listings?.map(l => (
              <div key={l.id} className="grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                <ListingCard l={l} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
