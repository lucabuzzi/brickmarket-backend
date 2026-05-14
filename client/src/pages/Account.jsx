import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Link, Navigate } from 'react-router-dom';
import { apiPostForm } from '../api';

export default function Account() {
  const { user, loading, refreshMe } = useAuth();
  
  const [role, setRole] = useState('buyer');
  const [city, setCity] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setRole(user.role || 'buyer');
      setCity(user.city || '');
      setFullName(user.full_name || '');
      setAvatarPreview(user.avatar_url || '');
    }
  }, [user]);

  if (loading) return <p className="muted">Caricamento profilo…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: { pathname: '/account' } }} />;

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('role', role);
      formData.append('full_name', fullName);
      if (role === 'seller' || role === 'both') {
        formData.append('city', city);
      }
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      await apiPostForm('/api/auth/me', formData, { method: 'PATCH' });
      await refreshMe(); // Aggiorna il contesto e fa apparire/scomparire il bottone Nuovo Annuncio
      
      setSuccess('Profilo aggiornato con successo!');
      setAvatarFile(null);
    } catch (err) {
      setError(err.message || 'Errore durante l\'aggiornamento del profilo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page narrow">
      <h1>Il tuo Profilo</h1>
      
      <form className="form" onSubmit={handleSubmit}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#444', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#888', fontSize: '0.8rem' }}>Nessuna<br/>Immagine</span>
            )}
          </div>
          <div>
            <label>
              <span className="btn btn--small btn--ghost" style={{ cursor: 'pointer' }}>Carica Avatar</span>
              <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleAvatarChange} />
            </label>
          </div>
        </div>

        <dl className="facts" style={{ marginBottom: '1rem', padding: '1rem', background: '#1c1c1c', borderRadius: '8px' }}>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Username</dt>
            <dd>{user.username}</dd>
          </div>
        </dl>

        <label>
          Ruolo
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="buyer">Acquirente</option>
            <option value="seller">Venditore</option>
            <option value="both">Entrambi</option>
          </select>
        </label>

        <label>
          Nome / Ragione Sociale
          <input 
            type="text" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>

        {(role === 'seller' || role === 'both') && (
          <label>
            Città (opzionale)
            <input 
              type="text" 
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>
        )}

        {error && <p className="error-banner">{error}</p>}
        {success && <p className="success-banner" style={{ color: '#4ade80', background: '#14532d', padding: '0.75rem', borderRadius: '0.25rem', marginTop: '1rem' }}>{success}</p>}

        <button type="submit" className="btn btn--primary" disabled={submitting} style={{ marginTop: '1rem' }}>
          {submitting ? 'Caricamento...' : 'Salva Modifiche'}
        </button>
      </form>
      
      <p className="muted" style={{ marginTop: '2rem' }}>
        <Link to="/">← Torna alla Home</Link>
      </p>
    </div>
  );
}
