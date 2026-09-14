import { useState, useEffect } from 'react';
import { useAuth } from '../auth/useAuth';
import { Link, Navigate } from 'react-router-dom';
import { apiPostForm } from '../api';
import { useTranslation } from 'react-i18next';

export default function Account() {
  const { user, loading, refreshMe } = useAuth();
  const { t } = useTranslation();
  
  const [role, setRole] = useState('buyer');
  const [city, setCity] = useState('');
  const [fullName, setFullName] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
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
      setStreet(user.address_street || '');
      setHouseNumber(user.address_house_number || '');
      setZipCode(user.address_zip_code || '');
      setCountry(user.address_country || '');
      setPhone(user.phone || '');
      setAvatarPreview(user.avatar_url || '');
    }
  }, [user]);

  if (loading) return <p className="muted">{t('profile.account_loading')}</p>;
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
        formData.append('street', street);
        formData.append('houseNumber', houseNumber);
        formData.append('zipCode', zipCode);
        formData.append('country', country);
        formData.append('phone', phone);
      }
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      await apiPostForm('/api/auth/me', formData, { method: 'PATCH' });
      await refreshMe(); // Aggiorna il contesto e fa apparire/scomparire il bottone Nuovo Annuncio
      
      setSuccess(t('profile.update_success'));
      setAvatarFile(null);
    } catch (err) {
      setError(err.message || t('profile.update_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page narrow">
      <h1>{t('profile.account_title')}</h1>
      
      <form className="form" onSubmit={handleSubmit}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#444', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: '#888', fontSize: '0.8rem' }}>{t('profile.no_avatar')}</span>
            )}
          </div>
          <div>
            <label>
              <span className="btn btn--small btn--ghost" style={{ cursor: 'pointer' }}>{t('profile.upload_avatar')}</span>
              <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleAvatarChange} />
            </label>
          </div>
        </div>

        <dl className="facts" style={{ marginBottom: '1rem', padding: '1rem', background: '#1c1c1c', borderRadius: '8px' }}>
          <div>
            <dt>{t('profile.email_label')}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{t('profile.username_label')}</dt>
            <dd>{user.username}</dd>
          </div>
        </dl>

        <label>
          {t('profile.role_label')}
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="buyer">{t('profile.role_buyer')}</option>
            <option value="seller">{t('profile.role_seller')}</option>
            <option value="both">{t('profile.role_both')}</option>
          </select>
        </label>

        <label>
          {t('profile.full_name_label')}
          <input
            type="text" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>

        {(role === 'seller' || role === 'both') && (
          <>
            <label>
              {t('auth.city')} {t('review.comment_optional')}
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>

            <p className="muted" style={{ margin: '1rem 0 0.5rem' }}>{t('profile.seller_address_note')}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.75rem' }}>
              <label>
                {t('auth.street')}
                <input type="text" value={street} onChange={(e) => setStreet(e.target.value)} />
              </label>
              <label>
                {t('auth.house_number')}
                <input type="text" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '0.75rem' }}>
              <label>
                {t('auth.zip')}
                <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
              </label>
              <label>
                {t('auth.country')}
                <input
                  type="text" maxLength={2} placeholder="IT"
                  value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())}
                />
              </label>
            </div>

            <label>
              {t('auth.phone')}
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </>
        )}

        {error && <p className="error-banner">{error}</p>}
        {success && <p className="success-banner" style={{ color: '#4ade80', background: '#14532d', padding: '0.75rem', borderRadius: '0.25rem', marginTop: '1rem' }}>{success}</p>}

        <button type="submit" className="btn btn--primary" disabled={submitting} style={{ marginTop: '1rem' }}>
          {submitting ? t('ui.loading') : t('profile.save_changes_button')}
        </button>
      </form>

      <p className="muted" style={{ marginTop: '2rem' }}>
        <Link to="/">← {t('profile.back_to_home')}</Link>
      </p>
    </div>
  );
}
