import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Register() {
  const { register } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tab, setTab] = useState('private'); // 'private' o 'professional'

  // Generic
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  // Private Only
  const [privateFullName, setPrivateFullName] = useState('');

  // Merchant Only (Specifico per il profilo professionale)
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // Indirizzo (Per entrambi i profili)
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');

  // Merchant Only (Verifiche documenti)
  const [idScan, setIdScan] = useState(null);
  const [businessLicense, setBusinessLicense] = useState(null);

  // Checkboxes (Obbligatorie per entrambi)
  const [acceptTos, setAcceptTos] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptRevocation, setAcceptRevocation] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');

    // Controllo Password
    if (password !== repeatPassword) {
      return setError(t('errors.passwords_dont_match'));
    }

    // Validazione consensi legali obbligatoria per tutti 
    if (!acceptTos || !acceptPrivacy || !acceptRevocation) {
      return setError(t('errors.accept_legal'));
    }

    // Validazione specifica documenti per Merchant
    if (tab === 'professional') {
      if (!idScan || !businessLicense) {
        return setError(t('errors.upload_required'));
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('username', username.trim());
      formData.append('email', email.trim());
      formData.append('password', password);

      // Dati indirizzo inclusi per entrambi i tipi di account 
      formData.append('street', street.trim());
      formData.append('houseNumber', houseNumber.trim());
      formData.append('zipCode', zipCode.trim());
      formData.append('city', city.trim());
      formData.append('country', country.trim());
      formData.append('phone', phone.trim());

      if (tab === 'private') {
        formData.append('role', 'buyer');
        formData.append('sellerType', 'private');
        if (privateFullName.trim()) formData.append('fullName', privateFullName.trim());
      } else {
        formData.append('role', 'seller');
        formData.append('sellerType', 'professional');
        formData.append('companyName', companyName.trim());
        formData.append('fullName', `${firstName.trim()} ${lastName.trim()}`);
        formData.append('id_scan', idScan);
        formData.append('business_license', businessLicense);
      }

      await register(formData);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || t('errors.registration_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page auth-page pt-24">
      <h1 style={{ textAlign: 'center' }}>{t('auth.register_title')}</h1>

      {/* Selezione Tipo Account */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <button
          type="button"
          className={`btn ${tab === 'private' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setTab('private')}
        >
          Private User
        </button>
        <button
          type="button"
          className={`btn ${tab === 'professional' ? 'btn--primary' : 'btn--ghost'}`}
          onClick={() => setTab('professional')}
        >
          Merchant
        </button>
      </div>

      <form className="form" onSubmit={onSubmit} style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* 1. Info Aziendali (Solo Merchant) */}
        {tab === 'professional' && (
          <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '8px', marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>{t('auth.company_info')}</h3>
            <label>
              {t('auth.company_name')}
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} required />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label>{t('auth.first_name')} <input value={firstName} onChange={e => setFirstName(e.target.value)} required /></label>
              <label>{t('auth.last_name')} <input value={lastName} onChange={e => setLastName(e.target.value)} required /></label>
            </div>
          </div>
        )}

        {/* 2. Credenziali di accesso (Ora prima dell'indirizzo)  */}
        <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #1e293b' }}>
          <h3 style={{ marginTop: 0 }}>{t('auth.login_credentials')}</h3>
          <label>Email <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>Username <input value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" minLength={3} /></label>

          {tab === 'private' && (
            <label>{t('auth.full_name_optional')} <input value={privateFullName} onChange={e => setPrivateFullName(e.target.value)} /></label>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <label>{t('auth.password')} <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /></label>
            <label>{t('auth.password_repeat')} <input type="password" value={repeatPassword} onChange={e => setRepeatPassword(e.target.value)} required minLength={6} /></label>
          </div>
        </div>

        {/* 3. Sezione Indirizzo (Sotto le credenziali)  */}
        <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '8px', marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>{t('auth.address')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '0.5rem' }}>
            <label>{t('auth.street')} <input value={street} onChange={e => setStreet(e.target.value)} required /></label>
            <label>{t('auth.house_number')} <input value={houseNumber} onChange={e => setHouseNumber(e.target.value)} required /></label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
            <label>{t('auth.zip')} <input value={zipCode} onChange={e => setZipCode(e.target.value)} required /></label>
            <label>{t('auth.city')} <input value={city} onChange={e => setCity(e.target.value)} required /></label>
          </div>
          <label>
            {t('auth.country')} <input value={country} onChange={e => setCountry(e.target.value)} required />
          </label>
          <label>
            {t('auth.phone')} <input value={phone} onChange={e => setPhone(e.target.value)} required />
          </label>
        </div>

        {/* 4. Verifiche documenti (Solo Merchant) */}
        {tab === 'professional' && (
          <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '8px', marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>{t('auth.verifications')}</h3>
            <label>
              {t('auth.id_scan')}
              <input type="file" accept="image/*,application/pdf" onChange={e => setIdScan(e.target.files[0])} required />
            </label>
            <label>
              {t('auth.business_license')}
              <input type="file" accept="image/*,application/pdf" onChange={e => setBusinessLicense(e.target.files[0])} required />
            </label>
            <p className="muted" style={{ fontSize: '0.8rem' }}>{t('auth.gdpr_note')}</p>
          </div>
        )}

        {/* 5. Consensi Legali (Obbligatori per tutti)  */}
        <div style={{ padding: '1rem', background: '#1e293b', borderRadius: '8px', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={acceptTos} onChange={e => setAcceptTos(e.target.checked)} />
            {t('auth.accept_tos')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={acceptPrivacy} onChange={e => setAcceptPrivacy(e.target.checked)} />
            {t('auth.accept_privacy')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'normal', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={acceptRevocation} onChange={e => setAcceptRevocation(e.target.checked)} />
            {t('auth.accept_revocation')}
          </label>
        </div>

        {error && <p className="error-banner">{error}</p>}

        <button
          type="submit"
          className="btn btn--primary"
          style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
          disabled={submitting}
        >
          {submitting ? t('auth.registering') : t('auth.register_btn')}
        </button>
      </form>

      <p className="muted" style={{ textAlign: 'center', marginTop: '1rem' }}>
        {t('auth.have_account')} <Link to="/login">{t('nav.login')}</Link>
      </p>
    </div>
  );
}