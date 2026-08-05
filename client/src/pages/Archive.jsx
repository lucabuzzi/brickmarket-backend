import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api';
import ListingCard from '../components/ListingCard';
import { Archive as ArchiveIcon } from 'lucide-react';

export default function Archive() {
  const { t } = useTranslation();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadArchive() {
      try {
        const data = await apiFetch('/api/listings/archive');
        setListings(data);
      } catch (err) {
        setError(err.message || t('archive.fetch_error'));
      } finally {
        setLoading(false);
      }
    }
    loadArchive();
  }, [t]);

  return (
    <div className="page" style={{ padding: '2rem' }}>
      <div className="max-w-7xl mx-auto">
        <div style={{ marginBottom: '2rem', borderBottom: '1px solid #292524', paddingBottom: '1.5rem' }}>
          <div className="flex items-center gap-3 mb-2">
            <ArchiveIcon size={32} className="text-stone-400" />
            <h1 style={{ margin: 0, fontSize: '2.5rem', color: '#fff', fontWeight: '900', letterSpacing: '-0.05em' }}>
              {t('archive.title')}
            </h1>
          </div>
          <p style={{ margin: 0, color: '#a8a29e', fontSize: '1.1rem' }}>
            {t('archive.subtitle')}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-stone-500 animate-pulse text-lg font-bold">{t('archive.loading')}</p>
          </div>
        ) : error ? (
          <div className="error-banner">{error}</div>
        ) : listings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-stone-500">{t('archive.empty')}</p>
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
