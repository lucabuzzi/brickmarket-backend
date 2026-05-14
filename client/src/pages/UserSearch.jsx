import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { Users, MapPin, Search, ChevronDown, ChevronRight, Crown } from 'lucide-react';
import BrickRating from '../components/BrickRating';

export default function UserSearch() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [openCountries, setOpenCountries] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await apiFetch('/api/users/list');
        if (!cancelled) {
          setUsers(data);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Errore caricamento directory');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleCountry = (code) => {
    const next = new Set(openCountries);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setOpenCountries(next);
  };

  // Filtering
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Grouping
  const groupedUsers = filteredUsers.reduce((acc, u) => {
    const country = u.country ? u.country.toLowerCase() : 'unknown';
    if (!acc[country]) acc[country] = [];
    acc[country].push(u);
    return acc;
  }, {});

  const countryNames = {
    it: 'Italia',
    ch: 'Svizzera',
    sm: 'San Marino',
    de: 'Germania',
    fr: 'Francia',
    es: 'Spagna',
    nl: 'Paesi Bassi',
    at: 'Austria',
    gb: 'Regno Unito',
    unknown: 'Altro'
  };

  if (loading) return (
    <div className="page" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <p className="muted animate-pulse">Caricamento directory...</p>
    </div>
  );

  if (error) return (
    <div className="page" style={{ padding: '2rem' }}>
      <div className="error-banner">{error}</div>
    </div>
  );

  return (
    <div className="page user-search" style={{ paddingTop: '1rem', maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '0.5rem', color: '#fff' }}>
          Directory Community
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '1.5rem' }}>
          Consultazione rapida dei collezionisti BrickMarket Europe.
        </p>

        {/* Search Bar */}
        <div style={{ position: 'relative', maxWidth: '450px', margin: '0 auto' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={18} />
          <input 
            type="text"
            placeholder="Filtra per username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2.8rem', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '0.95rem', outline: 'none' }}
          />
        </div>
      </div>

      {Object.keys(groupedUsers).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', border: '1px dashed #334155', borderRadius: '12px' }}>
          <Users size={48} color="#334155" style={{ marginBottom: '1rem' }} />
          <p style={{ color: '#94a3b8' }}>Nessun utente trovato.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Object.entries(groupedUsers).map(([countryCode, countryUsers]) => {
            const isOpen = openCountries.has(countryCode);
            return (
              <section key={countryCode} style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
                {/* Accordion Header */}
                <div 
                  onClick={() => toggleCountry(countryCode)}
                  style={{ padding: '0.8rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', backgroundColor: '#0f172a', transition: 'background-color 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}
                >
                  <span className={`fi fi-${countryCode}`} style={{ fontSize: '1.2rem', borderRadius: '2px' }}></span>
                  <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: '700', color: '#e2e8f0', flex: 1 }}>
                    {countryNames[countryCode] || countryCode.toUpperCase()}
                  </h2>
                  <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 'bold', marginRight: '0.5rem' }}>
                    {countryUsers.length} MEMBERS
                  </span>
                  {isOpen ? <ChevronDown size={18} color="#64748b" /> : <ChevronRight size={18} color="#64748b" />}
                </div>

                {/* List Body */}
                {isOpen && (
                  <div style={{ backgroundColor: '#020617' }}>
                    {countryUsers.map((u, i) => (
                      <Link 
                        to={`/user/${encodeURIComponent(u.username)}`}
                        key={i} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          padding: '0.6rem 1.25rem', 
                          textDecoration: 'none', 
                          color: 'inherit',
                          borderTop: '1px solid #1e293b',
                          transition: 'background-color 0.2s',
                          fontSize: '0.9rem'
                        }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* [Username + Badge] */}
                        <div style={{ width: '25%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: '700', color: '#fff' }}>{u.username}</span>
                          {u.is_pro && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#eab308', fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase' }}>
                              <Crown size={12} strokeWidth={3} /> PRO
                            </div>
                          )}
                        </div>

                        {/* [City + Flag] */}
                        <div style={{ width: '30%', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8' }}>
                          <MapPin size={14} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.city}</span>
                          <span className={`fi fi-${countryCode}`} style={{ fontSize: '0.9rem', opacity: 0.6, marginLeft: 'auto', marginRight: '1rem' }}></span>
                        </div>

                        {/* [BrickRating] */}
                        <div style={{ width: '25%', display: 'flex', justifyContent: 'center' }}>
                          <BrickRating value={parseFloat(u.rating_avg) || 0} interactive={false} size={12} />
                        </div>

                        {/* [Feedback Count] */}
                        <div style={{ width: '20%', textAlign: 'right', color: '#475569', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          ({u.rating_count} FEEDBACK)
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
